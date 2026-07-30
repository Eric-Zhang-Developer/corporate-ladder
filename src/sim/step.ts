import { AP_COSTS } from "../data/costs";
import { maxRange, weaponDef } from "../data/weapons";
import type { Action } from "./actions";
import { runEnemyTurns } from "./ai";
import { fireWeapon, meleeAttack } from "./combat";
import { recomputeFov } from "./fov";
import { hasLos } from "./los";
import { simRngFromState, type SimRNG } from "./rng";
import { distance, entityAt, idx, isFloor, pushLog, type Entity, type GameState } from "./state";

/**
 * The whole game advances through this single entry point. A player turn is
 * a budget of AP spent across several actions; when it runs out (or the
 * player waits), every enemy takes its full turn, then AP refills.
 */
export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase !== "playing") return state;
  const rng = simRngFromState(state.rngState);

  handlePlayerAction(state, rng, action);

  if (state.phase === "playing" && state.player.ap <= 0) {
    runEnemyTurns(state, rng);
    state.turn += 1;
    refillAp(state.player);
    for (const e of state.enemies) refillAp(e);
  }

  recomputeFov(state);
  state.rngState = rng.getState();
  return state;
}

function handlePlayerAction(state: GameState, rng: SimRNG, action: Action): void {
  const player = state.player;
  switch (action.type) {
    case "move": {
      const nx = player.x + action.dx;
      const ny = player.y + action.dy;
      // Invalid moves cost nothing — never charge AP for a typo.
      if (!isFloor(state.map, nx, ny)) {
        pushLog(state, "You bump into the wall.");
        return;
      }
      const blocker = entityAt(state, nx, ny);
      if (blocker && blocker.id !== player.id) {
        // Bump-to-melee: moving into an enemy is the knife attack.
        player.ap -= AP_COSTS.melee;
        meleeAttack(state, player, blocker);
        return;
      }
      player.x = nx;
      player.y = ny;
      player.ap -= AP_COSTS.move;
      return;
    }
    case "fire": {
      if (!player.weaponId) {
        pushLog(state, "You have no gun.");
        return;
      }
      const weapon = weaponDef(player.weaponId);
      if (player.ammoInMag <= 0) {
        pushLog(state, "Click. (R to reload)");
        return;
      }
      if (player.ap < weapon.apFire) {
        pushLog(state, "Not enough AP to fire.");
        return;
      }
      const target = pickTarget(state, action.targetId);
      if (!target) {
        pushLog(state, "No target in sight.");
        return;
      }
      if (distance(player, target) > maxRange(weapon)) {
        pushLog(state, `The ${target.name} is out of range.`);
        return;
      }
      fireWeapon(state, rng, player, target);
      return;
    }
    case "reload": {
      if (!player.weaponId) {
        pushLog(state, "Nothing to reload.");
        return;
      }
      const weapon = weaponDef(player.weaponId);
      if (player.ammoInMag >= weapon.magSize) {
        pushLog(state, "Magazine already full.");
        return;
      }
      if (player.ap < weapon.apReload) {
        pushLog(state, "Not enough AP to reload.");
        return;
      }
      player.ap -= weapon.apReload;
      player.ammoInMag = weapon.magSize;
      pushLog(state, "You reload.");
      return;
    }
    case "wait": {
      player.ap = 0;
      return;
    }
  }
}

/** Explicit target if given, else the nearest visible enemy with LOS. */
function pickTarget(state: GameState, targetId?: number): Entity | null {
  const { player, map } = state;
  const candidates = state.enemies.filter(
    (e) =>
      (targetId === undefined || e.id === targetId) &&
      state.visible[idx(map, e.x, e.y)] === true &&
      hasLos(map, player.x, player.y, e.x, e.y),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (distance(player, a) <= distance(player, b) ? a : b));
}

function refillAp(entity: { ap: number; maxAp: number; pendingApDrain?: number }): void {
  entity.ap = Math.max(0, entity.maxAp - (entity.pendingApDrain ?? 0));
  delete entity.pendingApDrain;
}
