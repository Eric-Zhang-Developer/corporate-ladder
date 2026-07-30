import { Path } from "rot-js";
import { enemyDef, type BehaviorId, type EnemyDef } from "../data/enemies";
import { maxRange, weaponDef } from "../data/weapons";
import { fireWeapon, meleeAttack } from "./combat";
import { hasLos } from "./los";
import type { SimRNG } from "./rng";
import {
  distance,
  entityAt,
  isFloor,
  pushLog,
  spawnEnemy,
  type Entity,
  type GameState,
} from "./state";

/** Live cops a single floor's cameras may summon before alarms go quiet. */
export const CAMERA_SPAWN_CAP = 4;
const CAMERA_TEAM_SIZE = 2;
const CAMERA_COUNTDOWN = 2;

export function runEnemyTurns(state: GameState, rng: SimRNG): void {
  for (const enemy of [...state.enemies]) {
    if (state.phase !== "playing") return;
    if (!state.enemies.includes(enemy)) continue;
    const def = enemyDef(enemy.defId);
    BEHAVIORS[def.behavior](state, rng, enemy);
  }
}

type Behavior = (state: GameState, rng: SimRNG, enemy: Entity) => void;

const BEHAVIORS: Record<BehaviorId, Behavior> = {
  pursueAndShoot,
  meleeRush,
  cameraAlarm,
};

/**
 * Shared spotting rule: idle until the player is within sight range with
 * LOS; spotting spends the turn (the player always gets one turn of
 * warning). Returns true once alerted and ready to act.
 */
function checkSpotted(state: GameState, enemy: Entity, def: EnemyDef): boolean {
  if (enemy.alerted) return true;
  const player = state.player;
  if (
    distance(enemy, player) <= def.sightRange &&
    hasLos(state.map, enemy.x, enemy.y, player.x, player.y)
  ) {
    enemy.alerted = true;
    pushLog(state, def.spotLine ?? `The ${enemy.name} spots you!`);
  }
  return false;
}

/**
 * Ranged: advance to preferred range and shoot, reloading when dry. Runs
 * through the same fireWeapon path as the player, so both sides obey
 * identical rules.
 */
function pursueAndShoot(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  if (!checkSpotted(state, enemy, def)) return;
  if (!enemy.weaponId) return;
  const weapon = weaponDef(enemy.weaponId);
  const player = state.player;
  const preferred = def.preferredRange ?? maxRange(weapon);

  while (enemy.ap > 0 && state.phase === "playing") {
    const dist = distance(enemy, player);
    const los = hasLos(state.map, enemy.x, enemy.y, player.x, player.y);

    if (enemy.ammoInMag <= 0) {
      if (enemy.ap < weapon.apReload) break;
      enemy.ap -= weapon.apReload;
      enemy.ammoInMag = weapon.magSize;
      pushLog(state, `The ${enemy.name} reloads.`);
      continue;
    }

    if (los && dist <= preferred && enemy.ap >= weapon.apFire) {
      fireWeapon(state, rng, enemy, player);
      continue;
    }

    if (stepToward(state, enemy)) {
      enemy.ap -= 1;
      continue;
    }

    // Blocked but the player is still shootable — plink from here.
    if (los && dist <= maxRange(weapon) && enemy.ap >= weapon.apFire) {
      fireWeapon(state, rng, enemy, player);
      continue;
    }

    break;
  }
}

/**
 * Melee: close the distance and strike, at most attacksPerTurn hits per
 * activation. A 3-AP dog = move 2 + bite: the "lunge" is just AP.
 */
function meleeRush(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  if (!checkSpotted(state, enemy, def)) return;
  const player = state.player;
  const maxAttacks = def.attacksPerTurn ?? 1;
  let attacks = 0;

  while (enemy.ap > 0 && state.phase === "playing") {
    const adjacent = distance(enemy, player) <= 1;

    if (adjacent && attacks < maxAttacks) {
      enemy.ap -= 1;
      attacks += 1;
      meleeAttack(state, rng, enemy, player);
      continue;
    }

    if (adjacent) break; // attack budget spent; hovering is all that's left

    if (!stepToward(state, enemy)) break;
    enemy.ap -= 1;
  }
}

/**
 * Support "summoner" (§4.5): on LOS, start a visible countdown. Once
 * started it runs even if LOS breaks — destroying the camera is the only
 * off switch (a suppressor is the Stage 3 counterplay). On expiry a
 * response team arrives at the floor entrance and the countdown re-arms.
 */
function cameraAlarm(state: GameState, _rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  const player = state.player;

  if (enemy.alarmTimer === undefined) {
    if (
      distance(enemy, player) <= def.sightRange &&
      hasLos(state.map, enemy.x, enemy.y, player.x, player.y)
    ) {
      enemy.alarmTimer = CAMERA_COUNTDOWN;
      pushLog(state, "A camera swivels toward you. Red light. Response team inbound.");
    }
    return;
  }

  enemy.alarmTimer -= 1;
  if (enemy.alarmTimer > 0) return;

  delete enemy.alarmTimer; // re-arms on next LOS
  const alive = state.enemies.filter((e) => e.spawnedBy === "camera").length;
  const toSpawn = Math.min(CAMERA_TEAM_SIZE, CAMERA_SPAWN_CAP - alive);
  if (toSpawn <= 0) return;

  const tiles = freeTilesNear(state, state.entrance.x, state.entrance.y, toSpawn);
  for (const [x, y] of tiles) {
    const cop = spawnEnemy(state.nextId++, "rentacop", x, y);
    cop.alerted = true;
    cop.spawnedBy = "camera";
    state.enemies.push(cop);
  }
  if (tiles.length > 0) {
    pushLog(state, `Elevator chime. A response team fans out from the entrance.`);
  }
}

/** BFS outward for the nearest n free floor tiles. */
function freeTilesNear(state: GameState, x: number, y: number, n: number): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  const seen = new Set<string>([`${x},${y}`]);
  const queue: Array<[number, number]> = [[x, y]];
  while (queue.length > 0 && found.length < n) {
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
      if (seen.has(key) || !isFloor(state.map, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
      if (!entityAt(state, nx, ny) && found.length < n) found.push([nx, ny]);
    }
  }
  return found;
}

/** One A* step toward the player; never steps onto an occupied tile. */
function stepToward(state: GameState, enemy: Entity): boolean {
  const { map, player } = state;
  const passable = (x: number, y: number): boolean => {
    if (x === enemy.x && y === enemy.y) return true;
    if (!isFloor(map, x, y)) return false;
    const occ = entityAt(state, x, y);
    // The player's tile stays passable so paths resolve; we stop short of it.
    return occ === null || occ.id === player.id;
  };

  const astar = new Path.AStar(player.x, player.y, passable, { topology: 4 });
  const path: Array<[number, number]> = [];
  astar.compute(enemy.x, enemy.y, (x, y) => path.push([x, y]));

  const next = path[1];
  if (!next) return false;
  const [nx, ny] = next;
  if (nx === player.x && ny === player.y) return false;
  enemy.x = nx;
  enemy.y = ny;
  return true;
}
