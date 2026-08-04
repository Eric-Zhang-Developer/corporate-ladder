import { Path } from "rot-js";
import { enemyDef, type BehaviorId, type EnemyDef } from "../data/enemies";
import { maxRange, weaponDef } from "../data/weapons";
import { detonate as detonateBlast } from "./aoe";
import { fireWeapon, meleeAttack } from "./combat";
import { emit } from "./events";
import { hasLos } from "./los";
import type { SimRNG } from "./rng";
import {
  distance,
  entityAt,
  freeTilesNear,
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
/** Waves a camera will call before its budget runs out. */
export const CAMERA_WAVE_CAP = 2;

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
  detonate,
  stealthApproach,
  overwatch,
  spinup,
  duelist,
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
    emit({
      kind: "spot",
      by: enemy.id,
      defId: enemy.defId,
      x: enemy.x,
      y: enemy.y,
      ...(def.machine ? { machine: true as const } : {}),
    });
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
      emit({ kind: "reload", by: enemy.id, weaponId: weapon.id, x: enemy.x, y: enemy.y });
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

    // A broken pathfinder is the point: you cannot count its approach, so you
    // cannot cut your kiting that fine.
    if (def.erratic && rng.next() < def.erratic && wanderStep(state, rng, enemy)) {
      enemy.ap -= 1;
      continue;
    }
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
  // Out of waves: inert. It keeps its glyph so the player can see it is spent.
  if (enemy.alarmWaves !== undefined && enemy.alarmWaves >= (def.alarmWaves ?? CAMERA_WAVE_CAP)) {
    return;
  }
  const player = state.player;

  if (enemy.alarmTimer === undefined) {
    if (
      distance(enemy, player) <= def.sightRange &&
      hasLos(state.map, enemy.x, enemy.y, player.x, player.y)
    ) {
      enemy.alarmTimer = CAMERA_COUNTDOWN;
      emit({ kind: "telegraph", style: "camera", by: enemy.id, defId: enemy.defId, x: enemy.x, y: enemy.y });
      pushLog(state, "A camera swivels toward you. Red light. Response team inbound.");
    }
    return;
  }

  enemy.alarmTimer -= 1;
  if (enemy.alarmTimer > 0) return;

  delete enemy.alarmTimer; // re-arms on next LOS
  // Finite response budget. Two waves and the camera goes dark, which kills
  // XP-farming and loot-farming at the source rather than gating the rewards.
  const cap = def.alarmWaves ?? CAMERA_WAVE_CAP;
  enemy.alarmWaves = (enemy.alarmWaves ?? 0) + 1;
  if (enemy.alarmWaves > cap) {
    pushLog(state, `The ${enemy.name} goes dark. Response budget exhausted.`);
    return;
  }
  const alive = state.enemies.filter((e) => e.spawnedBy === "camera").length;
  const toSpawn = Math.min(CAMERA_TEAM_SIZE, CAMERA_SPAWN_CAP - alive);
  if (toSpawn <= 0) return;

  // includeOrigin false: the response team fans out AROUND the entrance, which
  // is where the player is standing when they arrive.
  const tiles = freeTilesNear(
    state.map,
    state.entrance.x,
    state.entrance.y,
    toSpawn,
    (x, y) => !entityAt(state, x, y),
    false,
  );
  for (const { x, y } of tiles) {
    const cop = spawnEnemy(state.nextId++, "rentacop", x, y);
    cop.alerted = true;
    cop.spawnedBy = "camera";
    state.enemies.push(cop);
  }
  if (tiles.length > 0) {
    emit({
      kind: "alarmWave",
      by: enemy.id,
      spawned: tiles.length,
      x: state.entrance.x,
      y: state.entrance.y,
    });
    pushLog(state, `Elevator chime. A response team fans out from the entrance.`);
  }
}

/**
 * The CEO, and only the CEO. After seven floors of enemies-as-patterns, the
 * last fight is an OPPONENT: he spends 3 AP the way a player spends them,
 * slots plates while you watch, jabs a stim when he is hurt, and advances on
 * an empty magazine because he has read your file.
 *
 * No new systems — his whole kit is the player's own systems list pointed
 * backwards, which is the entire design of the fight.
 */
function duelist(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  if (!checkSpotted(state, enemy, def)) return;
  if (!enemy.weaponId) return;
  const weapon = weaponDef(enemy.weaponId);
  if (enemy.spares === undefined) enemy.spares = def.plates ?? 0;

  // The crescendo, and the mercy: survive the stim turn and the next is yours.
  if (!enemy.stimUsed && enemy.hp <= enemy.maxHp / 2) {
    enemy.stimUsed = true;
    enemy.ap += 2;
    enemy.pendingApDrain = Math.max(enemy.pendingApDrain ?? 0, 1);
    emit({ kind: "duelistStim", by: enemy.id, x: enemy.x, y: enemy.y });
    pushLog(state, `The ${enemy.name} jabs something into his thigh and straightens up.`);
  }

  while (enemy.ap > 0 && state.phase === "playing") {
    const dist = distance(enemy, state.player);
    const los = hasLos(state.map, enemy.x, enemy.y, state.player.x, state.player.y);

    // Plates, slotted mid-fight for 1 AP — the player's signature mechanic
    // seen from the wrong side.
    if ((enemy.shield ?? 0) <= 0 && enemy.spares > 0) {
      enemy.spares -= 1;
      enemy.shield = 5;
      enemy.ap -= 1;
      emit({ kind: "duelistPlate", by: enemy.id, x: enemy.x, y: enemy.y });
      pushLog(state, `The ${enemy.name} slots a fresh plate without looking away.`);
      continue;
    }
    if (enemy.ammoInMag <= 0) {
      if (enemy.ap < weapon.apReload) break;
      enemy.ap -= weapon.apReload;
      enemy.ammoInMag = weapon.magSize;
      emit({ kind: "reload", by: enemy.id, weaponId: weapon.id, x: enemy.x, y: enemy.y });
      pushLog(state, `The ${enemy.name} reloads, unhurried.`);
      continue;
    }
    // He reads your magazine. An empty gun is an invitation to walk in, which
    // is every punish window you have farmed for eight floors, farmed back.
    const playerDry = state.player.ammoInMag <= 0;
    if (playerDry && dist > 1.5) {
      if (!stepToward(state, enemy)) break;
      enemy.ap -= 1;
      continue;
    }
    if (los && dist <= maxRange(weapon) && enemy.ap >= weapon.apFire) {
      fireWeapon(state, rng, enemy, state.player);
      continue;
    }
    if (!stepToward(state, enemy)) break;
    enemy.ap -= 1;
  }
}

/**
 * Active camo. Not on the map until it is nearly on top of you: the reveal is
 * the entire fight, and one tile of surprise is worth more than any stat in a
 * turn-based game. Fragile once seen — the camo IS its armor budget.
 */
function stealthApproach(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  const reveal = def.revealRange ?? 2;
  if (!enemy.alerted) {
    if (distance(enemy, state.player) > def.sightRange) return;
    enemy.alerted = true; // it has seen you; you have not seen it
    return;
  }

  while (enemy.ap > 0 && state.phase === "playing") {
    const dist = distance(enemy, state.player);
    if (enemy.hidden && dist <= reveal) {
      delete enemy.hidden;
      emit({ kind: "telegraph", style: "reveal", by: enemy.id, defId: enemy.defId, x: enemy.x, y: enemy.y });
      pushLog(state, def.spotLine ?? "Something shimmers, close.");
      return; // the reveal costs it the rest of the turn — one turn of warning
    }
    if (dist <= 1) {
      enemy.ap -= 1;
      meleeAttack(state, rng, enemy, state.player);
      return;
    }
    if (!stepToward(state, enemy)) break;
    enemy.ap -= 1;
  }
}

/**
 * Emplacements. Never move, never chase: the threat is the LANE. One turn of
 * visible telegraph, then anything still standing in the line pays for it —
 * which turns map knowledge into the whole counter.
 */
function overwatch(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  if (!enemy.weaponId) return;
  const weapon = weaponDef(enemy.weaponId);
  const inLane =
    distance(enemy, state.player) <= maxRange(weapon) &&
    hasLos(state.map, enemy.x, enemy.y, state.player.x, state.player.y);

  if (enemy.chargeTimer !== undefined) {
    enemy.chargeTimer -= 1;
    if (enemy.chargeTimer > 0) return;
    delete enemy.chargeTimer;
    // Step out of the lane during the telegraph and the shot goes nowhere.
    if (inLane && enemy.ap >= weapon.apFire) fireWeapon(state, rng, enemy, state.player);
    else pushLog(state, `The ${enemy.name} loses its firing solution.`);
    return;
  }
  if (!inLane) return;
  if (!enemy.alerted) {
    enemy.alerted = true;
    emit({
      kind: "spot",
      by: enemy.id,
      defId: enemy.defId,
      x: enemy.x,
      y: enemy.y,
      ...(def.machine ? { machine: true as const } : {}),
    });
    pushLog(state, def.spotLine ?? `The ${enemy.name} acquires you.`);
    return;
  }
  enemy.chargeTimer = def.chargeTurns ?? 1;
  emit({ kind: "telegraph", style: "lock", by: enemy.id, defId: enemy.defId, x: enemy.x, y: enemy.y });
  pushLog(state, `The ${enemy.name} sights down the lane.`);
}

/**
 * Heavy chassis. Charges for a couple of visible turns and then either fires
 * or, for the ones without a barrel, pulses an alarm that wakes every machine
 * on the floor. Either way the fight is about interrupting the charge — break
 * line of sight, stun it, or burst it down — never about out-damaging it.
 */
function spinup(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  if (!checkSpotted(state, enemy, def)) return;

  if (enemy.chargeTimer !== undefined) {
    enemy.chargeTimer -= 1;
    if (enemy.chargeTimer > 0) {
      pushLog(state, `The ${enemy.name} winds up.`);
      return;
    }
    delete enemy.chargeTimer;
    const weapon = enemy.weaponId ? weaponDef(enemy.weaponId) : null;
    const dist = distance(enemy, state.player);
    if (weapon && dist <= maxRange(weapon) && hasLos(state.map, enemy.x, enemy.y, state.player.x, state.player.y)) {
      fireWeapon(state, rng, enemy, state.player);
    } else {
      pushLog(state, `The ${enemy.name} discharges into empty air.`);
    }
    // The pulse: every dormant machine on the floor comes online.
    let woken = 0;
    for (const other of state.enemies) {
      if (other.id === enemy.id || other.alerted) continue;
      if (!enemyDef(other.defId).machine) continue;
      other.alerted = true;
      woken += 1;
    }
    if (woken > 0) {
      emit({ kind: "telegraph", style: "wake", by: enemy.id, defId: enemy.defId, x: enemy.x, y: enemy.y });
      pushLog(state, `The floor answers. ${woken} systems come online.`);
    }
    return;
  }

  // Closes slowly, then commits to a charge once it is in reach.
  const weapon = enemy.weaponId ? weaponDef(enemy.weaponId) : null;
  const reach = weapon ? maxRange(weapon) : 1;
  if (distance(enemy, state.player) <= reach) {
    enemy.chargeTimer = def.chargeTurns ?? 2;
    emit({
      kind: "telegraph",
      style: "spinup",
      by: enemy.id,
      defId: enemy.defId,
      x: enemy.x,
      y: enemy.y,
      ...(enemy.weaponId ? { weaponId: enemy.weaponId } : {}),
    });
    pushLog(state, `The ${enemy.name} begins to spin up.`);
    return;
  }
  if (stepToward(state, enemy)) enemy.ap -= 1;
}

/**
 * Kamikaze drones. Closes fast and trades itself for a blast — the answer to a
 * player who has learned to fight from a fortified doorway, because it does not
 * care about doorways. Reuses the grenade blast helper from the other side.
 */
function detonate(state: GameState, rng: SimRNG, enemy: Entity): void {
  const def = enemyDef(enemy.defId);
  if (!checkSpotted(state, enemy, def)) return;

  while (enemy.ap > 0 && state.phase === "playing") {
    if (distance(enemy, state.player) <= 1) {
      emit({ kind: "telegraph", style: "dive", by: enemy.id, defId: enemy.defId, x: enemy.x, y: enemy.y });
      pushLog(state, `The ${enemy.name} dives at you.`);
      // Remove it first: the blast must not damage the thing detonating it,
      // and its own death is the cost, not a kill the player is credited for.
      state.enemies = state.enemies.filter((e) => e.id !== enemy.id);
      detonateBlast(
        state,
        rng,
        enemy.x,
        enemy.y,
        { radius: 1, damage: def.detonateDamage ?? 6 },
        enemy,
        def.killVerb ?? "Blown apart by",
      );
      return;
    }
    if (!stepToward(state, enemy)) break;
    enemy.ap -= 1;
  }
}

/** A wasted step in a random direction. Consumes RNG, so it stays seeded. */
function wanderStep(state: GameState, rng: SimRNG, enemy: Entity): boolean {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  // Drawn from the seeded stream, not from the snapshot: rngState is stale
  // mid-turn and reading it would make the wander both fixed and unreplayable.
  const [dx, dy] = dirs[Math.floor(rng.next() * dirs.length)]!;
  const nx = enemy.x + dx;
  const ny = enemy.y + dy;
  if (!isFloor(state.map, nx, ny) || entityAt(state, nx, ny)) return false;
  emit({ kind: "step", by: enemy.id, defId: enemy.defId, fromX: enemy.x, fromY: enemy.y, x: nx, y: ny });
  enemy.x = nx;
  enemy.y = ny;
  return true;
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
  emit({ kind: "step", by: enemy.id, defId: enemy.defId, fromX: enemy.x, fromY: enemy.y, x: nx, y: ny });
  enemy.x = nx;
  enemy.y = ny;
  return true;
}
