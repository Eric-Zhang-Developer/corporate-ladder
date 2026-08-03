import { HOTBAR_SLOTS } from "../../src/data/items";
import { WEAPONS, weaponDef } from "../../src/data/weapons";
import { recomputeFov } from "../../src/sim/fov";
import { createSimRng } from "../../src/sim/rng";
import type { Entity, GameMap, GameState, Tile } from "../../src/sim/state";

/** All-floor map with a one-tile wall border. */
export function openMap(width = 10, height = 10): GameMap {
  const tiles: Tile[] = new Array(width * height).fill(1);
  for (let x = 0; x < width; x++) {
    tiles[x] = 0;
    tiles[(height - 1) * width + x] = 0;
  }
  for (let y = 0; y < height; y++) {
    tiles[y * width] = 0;
    tiles[y * width + width - 1] = 0;
  }
  return { width, height, tiles };
}

export function setWall(map: GameMap, x: number, y: number): void {
  map.tiles[y * map.width + x] = 0;
}

let nextId = 1;

export function makeEnemy(partial: Partial<Entity> = {}): Entity {
  const weaponId = partial.weaponId ?? WEAPONS.glock_cop.id;
  return {
    id: nextId++,
    defId: "rentacop",
    name: "Rent-a-Cop",
    glyph: "c",
    color: "#8899ff",
    x: 5,
    y: 5,
    hp: 6,
    maxHp: 6,
    ap: 2,
    maxAp: 2,
    weaponId,
    ammoInMag: weaponDef(weaponId).magSize,
    alerted: true,
    ...partial,
  };
}

export function makeState(
  opts: {
    map?: GameMap;
    player?: Partial<Entity>;
    enemies?: Entity[];
    seed?: number;
    ammo?: GameState["ammo"];
    items?: GameState["items"];
    stairs?: { x: number; y: number };
    carrierId?: string | null;
    spareplates?: number;
    hotbar?: GameState["hotbar"];
    cash?: number;
    xp?: number;
    level?: number;
    perks?: string[];
  } = {},
): GameState {
  const map = opts.map ?? openMap();
  const seed = opts.seed ?? 123;
  const rng = createSimRng(seed);
  const player: Entity = {
    id: 0,
    defId: "player",
    name: "You",
    glyph: "@",
    color: "#ffffff",
    x: 2,
    y: 2,
    hp: 10,
    maxHp: 10,
    ap: 3,
    maxAp: 3,
    weaponId: WEAPONS.glock.id,
    ammoInMag: WEAPONS.glock.magSize,
    alerted: true,
    slots: [{ weaponId: WEAPONS.glock.id, ammoInMag: WEAPONS.glock.magSize }, null, null],
    activeSlot: 0,
    ...opts.player,
  };
  const state: GameState = {
    seed,
    rngState: rng.getState(),
    turn: 1,
    floor: 1,
    phase: "playing",
    map,
    entrance: { x: player.x, y: player.y },
    stairs: opts.stairs ?? { x: 0, y: 0 },
    visible: new Array(map.tiles.length).fill(false),
    explored: new Array(map.tiles.length).fill(false),
    player,
    enemies: opts.enemies ?? [],
    items: opts.items ?? [],
    ammo: opts.ammo ?? { pistol: 24, shell: 0, rifle: 0, heavy: 0 },
    carrierId: opts.carrierId ?? null,
    spareplates: opts.spareplates ?? 0,
    hotbar: opts.hotbar ?? new Array(HOTBAR_SLOTS).fill(null),
    cash: opts.cash ?? 0,
    xp: opts.xp ?? 0,
    level: opts.level ?? 1,
    perks: opts.perks ?? [],
    nextId: 1000,
    log: [],
  };
  recomputeFov(state);
  return state;
}
