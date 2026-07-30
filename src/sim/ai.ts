import { Path } from "rot-js";
import { enemyDef, type BehaviorId } from "../data/enemies";
import { maxRange, weaponDef } from "../data/weapons";
import { fireWeapon } from "./combat";
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
};

/**
 * Idle until the player is spotted (spotting spends the turn — the player
 * always gets one turn of warning). Then: advance to preferred range and
 * shoot, reloading when dry. Runs through the same fireWeapon path as the
 * player, so both sides obey identical rules.
 */
function pursueAndShoot(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  const weapon = weaponDef(enemy.weaponId);
  const player = state.player;

  if (!enemy.alerted) {
    const dist = distance(enemy, player);
    if (dist <= def.sightRange && hasLos(state.map, enemy.x, enemy.y, player.x, player.y)) {
      enemy.alerted = true;
      pushLog(state, `The ${enemy.name} shouts, "Hey! You can't be up here!"`);
    }
    return;
  }

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

    if (los && dist <= def.preferredRange && enemy.ap >= weapon.apFire) {
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
