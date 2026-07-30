import { Path } from "rot-js";
import { enemyDef, type BehaviorId, type EnemyDef } from "../data/enemies";
import { maxRange, weaponDef } from "../data/weapons";
import { fireWeapon, meleeAttack } from "./combat";
import { hasLos } from "./los";
import type { SimRNG } from "./rng";
import { distance, entityAt, isFloor, pushLog, type Entity, type GameState } from "./state";

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
  cameraAlarm: () => {}, // M3
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
function meleeRush(state: GameState, _rng: SimRNG, enemy: Entity): void {
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
      meleeAttack(state, enemy, player);
      continue;
    }

    if (adjacent) break; // attack budget spent; hovering is all that's left

    if (!stepToward(state, enemy)) break;
    enemy.ap -= 1;
  }
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
