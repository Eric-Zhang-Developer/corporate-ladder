import { AP_COSTS } from "../data/costs";
import { maxRange, weaponDef } from "../data/weapons";
import type { Action } from "./actions";
import { runEnemyTurns } from "./ai";
import { fireWeapon, meleeAttack } from "./combat";
import { applyFloor, LAST_FLOOR } from "./floor";
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
        meleeAttack(state, rng, player, blocker);
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
      const reserve = state.ammo[weapon.caliber];
      if (reserve <= 0) {
        pushLog(state, `No ${weapon.caliber} rounds left.`);
        return;
      }
      if (player.ap < weapon.apReload) {
        pushLog(state, "Not enough AP to reload.");
        return;
      }
      const take = Math.min(weapon.magSize - player.ammoInMag, reserve);
      player.ap -= weapon.apReload;
      player.ammoInMag += take;
      state.ammo[weapon.caliber] -= take;
      pushLog(state, `You reload. (${state.ammo[weapon.caliber]} ${weapon.caliber} left)`);
      return;
    }
    case "swap": {
      const slots = player.slots;
      const active = player.activeSlot;
      if (!slots || active === undefined) return;
      if (action.slot === active) {
        pushLog(state, "Already in hand.");
        return;
      }
      const target = slots[action.slot];
      if (!target) {
        pushLog(state, "That slot is empty.");
        return;
      }
      if (player.ap < AP_COSTS.swap) {
        pushLog(state, "Not enough AP to swap.");
        return;
      }
      slots[active] = player.weaponId
        ? { weaponId: player.weaponId, ammoInMag: player.ammoInMag }
        : null;
      player.weaponId = target.weaponId;
      player.ammoInMag = target.ammoInMag;
      player.activeSlot = action.slot;
      player.ap -= AP_COSTS.swap;
      pushLog(state, `You draw the ${weaponDef(target.weaponId).name}.`);
      return;
    }
    case "pickup": {
      const item = state.items.find((i) => i.x === player.x && i.y === player.y);
      if (!item) {
        pushLog(state, "Nothing here to pick up.");
        return;
      }
      if (player.ap < AP_COSTS.pickup) {
        pushLog(state, "Not enough AP to pick that up.");
        return;
      }
      if (item.kind === "ammo") {
        player.ap -= AP_COSTS.pickup;
        state.ammo[item.caliber] += item.amount;
        state.items = state.items.filter((i) => i.id !== item.id);
        pushLog(state, `You pocket ${item.amount} ${item.caliber} rounds.`);
        return;
      }
      // Weapon: fill an empty slot; if all three are full, swap with the
      // gun in hand (which drops where you stand).
      const slots = player.slots;
      const active = player.activeSlot;
      if (!slots || active === undefined) return;
      player.ap -= AP_COSTS.pickup;
      state.items = state.items.filter((i) => i.id !== item.id);
      const empty = slots.findIndex((s, i) => s === null && i !== active);
      if (empty !== -1) {
        slots[empty] = { weaponId: item.weaponId, ammoInMag: item.ammoInMag };
        pushLog(state, `You stow the ${weaponDef(item.weaponId).name} (slot ${empty + 1}).`);
        return;
      }
      if (player.weaponId) {
        state.items.push({
          id: state.nextId++,
          x: player.x,
          y: player.y,
          kind: "weapon",
          weaponId: player.weaponId,
          ammoInMag: player.ammoInMag,
        });
        pushLog(state, `You drop the ${weaponDef(player.weaponId).name}.`);
      }
      player.weaponId = item.weaponId;
      player.ammoInMag = item.ammoInMag;
      slots[active] = { weaponId: item.weaponId, ammoInMag: item.ammoInMag };
      pushLog(state, `You take the ${weaponDef(item.weaponId).name}.`);
      return;
    }
    case "ascend": {
      if (player.x !== state.stairs.x || player.y !== state.stairs.y) {
        pushLog(state, "No stairs here.");
        return;
      }
      if (state.floor >= LAST_FLOOR) {
        state.phase = "won";
        pushLog(state, "You reach the roof access. To be continued.");
        return;
      }
      applyFloor(state, state.floor + 1);
      player.ap = player.maxAp; // fresh floor, fresh turn
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
