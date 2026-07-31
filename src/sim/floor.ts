import { enemyDef } from "../data/enemies";
import { CALIBERS, floorDef, LAST_FLOOR } from "../data/floors";
import { WEAPONS, weaponDef, type Caliber } from "../data/weapons";
import { generateMap } from "./mapgen";
import { recomputeFov } from "./fov";
import { createSimRng, type SimRNG } from "./rng";
import {
  isFloor,
  pushLog,
  spawnEnemy,
  PLAYER_MAX_AP,
  PLAYER_MAX_HP,
  type Entity,
  type GameMap,
  type GameState,
  type GroundItem,
} from "./state";

export { LAST_FLOOR };

/**
 * Floor content depends only on (seed, floor) — never on sim history —
 * so a shared seed reproduces the entire tower.
 */
function hashSeed(seed: number, floor: number, salt = 0): number {
  let h = (seed >>> 0) ^ Math.imul(floor + 1, 0x9e3779b9) ^ Math.imul(salt + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface FloorBuild {
  map: GameMap;
  entrance: { x: number; y: number };
  stairs: { x: number; y: number };
  enemies: Entity[];
  items: GroundItem[];
  nextId: number;
}

export function buildFloor(
  seed: number,
  floor: number,
  startId: number,
  carriedCalibers: Caliber[],
): FloorBuild {
  const def = floorDef(floor);
  const gen = generateMap(hashSeed(seed, floor));
  const rng = createSimRng(hashSeed(seed, floor, 1));
  const entrance = gen.playerStart;

  let stairs = entrance;
  let bestDist = -1;
  for (const room of gen.rooms) {
    const d = Math.hypot(room.x - entrance.x, room.y - entrance.y);
    if (d > bestDist) {
      bestDist = d;
      stairs = { x: room.x, y: room.y };
    }
  }

  const occupied = new Set<string>([`${entrance.x},${entrance.y}`, `${stairs.x},${stairs.y}`]);
  let nextId = startId;
  const enemies: Entity[] = [];
  const items: GroundItem[] = [];

  // Encounter groups over non-start rooms (§4.6).
  const spawnRooms = shuffle(gen.rooms.slice(1), rng);
  const groupCount = randInt(rng, def.groups.min, def.groups.max);
  for (let g = 0; g < groupCount && spawnRooms.length > 0; g++) {
    const room = spawnRooms[g % spawnRooms.length]!;
    const group = [pickWeighted(rng, def.weights)];
    if (rng.next() < 0.5) group.push(pickWeighted(rng, def.weights));
    // Support enemies never spawn alone — cameras get a ranged escort.
    if (group.includes("camera") && !group.some((id) => id !== "camera" && enemyDef(id).weaponId)) {
      group.push("rentacop");
    }
    for (const defId of group) {
      const spot = freeTileNear(gen.map, occupied, room.x, room.y);
      if (!spot) continue;
      occupied.add(`${spot[0]},${spot[1]}`);
      enemies.push(spawnEnemy(nextId++, defId, spot[0], spot[1]));
    }
  }

  // Loot room: the unused (or last) spawn room gets a weapon + its ammo.
  const lootRoom = spawnRooms[groupCount % spawnRooms.length] ?? spawnRooms[spawnRooms.length - 1];
  if (lootRoom) {
    const weaponId = def.lootWeapons[Math.floor(rng.next() * def.lootWeapons.length)]!;
    const weapon = weaponDef(weaponId);
    const spot = freeTileNear(gen.map, occupied, lootRoom.x, lootRoom.y);
    if (spot) {
      occupied.add(`${spot[0]},${spot[1]}`);
      items.push({ id: nextId++, x: spot[0], y: spot[1], kind: "weapon", weaponId, ammoInMag: weapon.magSize });
      const ammoSpot = freeTileNear(gen.map, occupied, lootRoom.x, lootRoom.y);
      if (ammoSpot) {
        occupied.add(`${ammoSpot[0]},${ammoSpot[1]}`);
        items.push({
          id: nextId++,
          x: ammoSpot[0],
          y: ammoSpot[1],
          kind: "ammo",
          caliber: weapon.caliber,
          amount: randInt(rng, def.lootAmmo.min, def.lootAmmo.max),
        });
      }
    }
  }

  // Scattered piles, 60% biased toward calibers the player carries (§4.3).
  for (let i = 0; i < def.scatterPiles && spawnRooms.length > 0; i++) {
    const room = spawnRooms[randInt(rng, 0, spawnRooms.length - 1)]!;
    const caliber =
      carriedCalibers.length > 0 && rng.next() < 0.6
        ? carriedCalibers[Math.floor(rng.next() * carriedCalibers.length)]!
        : CALIBERS[Math.floor(rng.next() * CALIBERS.length)]!;
    const spot = freeTileNear(gen.map, occupied, room.x, room.y);
    if (!spot) continue;
    occupied.add(`${spot[0]},${spot[1]}`);
    items.push({
      id: nextId++,
      x: spot[0],
      y: spot[1],
      kind: "ammo",
      caliber,
      amount: randInt(rng, def.scatterAmount.min, def.scatterAmount.max),
    });
  }

  // Plates and carriers. Placed after ammo so adding them cannot shift the
  // scatter rolls above, keeping older seeds' ammo layout intact.
  for (let i = 0; i < (def.platePiles ?? 0) && spawnRooms.length > 0; i++) {
    const room = spawnRooms[randInt(rng, 0, spawnRooms.length - 1)]!;
    const spot = freeTileNear(gen.map, occupied, room.x, room.y);
    if (!spot) continue;
    occupied.add(`${spot[0]},${spot[1]}`);
    items.push({ id: nextId++, x: spot[0], y: spot[1], kind: "plate" });
  }
  if (def.carrier && spawnRooms.length > 0) {
    const room = spawnRooms[randInt(rng, 0, spawnRooms.length - 1)]!;
    const spot = freeTileNear(gen.map, occupied, room.x, room.y);
    if (spot) {
      occupied.add(`${spot[0]},${spot[1]}`);
      items.push({ id: nextId++, x: spot[0], y: spot[1], kind: "carrier", carrierId: def.carrier });
    }
  }

  return { map: gen.map, entrance, stairs, enemies, items, nextId };
}

/** Rebuild state for a floor, preserving the player, reserves, and log. */
export function applyFloor(state: GameState, floor: number): void {
  const build = buildFloor(state.seed, floor, state.nextId, carriedCalibers(state.player));
  state.floor = floor;
  state.map = build.map;
  state.entrance = build.entrance;
  state.stairs = build.stairs;
  state.enemies = build.enemies;
  state.items = build.items;
  state.nextId = build.nextId;
  state.player.x = build.entrance.x;
  state.player.y = build.entrance.y;
  state.visible = new Array(build.map.tiles.length).fill(false);
  state.explored = new Array(build.map.tiles.length).fill(false);
  pushLog(state, `${floorDef(floor).name} — floor ${floor} of the tower.`);
  recomputeFov(state);
}

export function newGame(seed: number): GameState {
  // XOR keeps the sim stream distinct from the map/spawn streams.
  const rng = createSimRng((seed ^ 0x9e3779b9) >>> 0);
  const player: Entity = {
    id: 0,
    defId: "player",
    name: "You",
    glyph: "@",
    color: "#ffffff",
    x: 0,
    y: 0,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    ap: PLAYER_MAX_AP,
    maxAp: PLAYER_MAX_AP,
    weaponId: WEAPONS.glock.id,
    ammoInMag: WEAPONS.glock.magSize,
    alerted: true,
    slots: [{ weaponId: WEAPONS.glock.id, ammoInMag: WEAPONS.glock.magSize }, null, null],
    activeSlot: 0,
  };

  const state: GameState = {
    seed,
    rngState: rng.getState(),
    turn: 1,
    floor: 1,
    phase: "playing",
    map: { width: 0, height: 0, tiles: [] },
    entrance: { x: 0, y: 0 },
    stairs: { x: 0, y: 0 },
    visible: [],
    explored: [],
    player,
    enemies: [],
    items: [],
    ammo: { pistol: 24, shell: 0, rifle: 0, heavy: 0 },
    carrierId: null,
    spareplates: 0,
    nextId: 1,
    log: ["Find whoever signs the checks."],
  };
  applyFloor(state, 1);
  return state;
}

function carriedCalibers(player: Entity): Caliber[] {
  const ids = (player.slots ?? [])
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => s.weaponId);
  if (player.weaponId) ids.push(player.weaponId);
  return [...new Set(ids.map((id) => weaponDef(id).caliber))];
}

function pickWeighted(rng: SimRNG, weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (const [id, w] of Object.entries(weights)) {
    roll -= w;
    if (roll < 0) return id;
  }
  return Object.keys(weights)[0]!;
}

function shuffle<T>(arr: T[], rng: SimRNG): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function randInt(rng: SimRNG, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

/** Nearest free floor tile to (x, y) by BFS. */
function freeTileNear(
  map: GameMap,
  occupied: Set<string>,
  x: number,
  y: number,
): [number, number] | null {
  if (isFloor(map, x, y) && !occupied.has(`${x},${y}`)) return [x, y];
  const seen = new Set<string>([`${x},${y}`]);
  const queue: Array<[number, number]> = [[x, y]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !isFloor(map, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
      if (!occupied.has(key)) return [nx, ny];
    }
  }
  return null;
}
