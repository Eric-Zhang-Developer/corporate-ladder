import { enemyDef } from "../data/enemies";
import { bandFor, weaponDef } from "../data/weapons";
import { KNIFE } from "../data/costs";
import type { SimRNG } from "./rng";
import { distance, pushLog, type Entity, type GameState } from "./state";

/**
 * One firing path for everyone — the player and every enemy resolve shots
 * through here. Caller has already validated LOS, range, ammo, and AP.
 */
export function fireWeapon(state: GameState, rng: SimRNG, attacker: Entity, defender: Entity): void {
  if (!attacker.weaponId) return;
  const weapon = weaponDef(attacker.weaponId);
  attacker.ap -= weapon.apFire;
  attacker.ammoInMag -= 1;
  // Gunfire is loud: being shot at wakes the target regardless of outcome.
  // (Stage 2's suppressor attachment is the counterplay to this rule.)
  defender.alerted = true;

  const dist = distance(attacker, defender);
  const band = bandFor(weapon, dist);
  if (!band) {
    pushLog(state, attacker.id === state.player.id ? "You fire wide." : `The ${attacker.name} fires wide.`);
    return;
  }

  const hit = rng.next() < weapon.baseAccuracy * band.accMult;
  if (!hit) {
    pushLog(
      state,
      attacker.id === state.player.id
        ? `You miss the ${defender.name}.`
        : `The ${attacker.name} fires and misses.`,
    );
    return;
  }

  const dmg = Math.round(weapon.damage * band.dmgMult);
  pushLog(
    state,
    attacker.id === state.player.id
      ? `You hit the ${defender.name} for ${dmg}.`
      : `The ${attacker.name} hits you for ${dmg}.`,
  );
  dealDamage(state, attacker, defender, dmg, killVerbFor(attacker));
}

/**
 * Melee for both sides: the player's knife bump and every enemy melee
 * behavior land through here. Auto-hit — melee tension comes from
 * positioning, not rolls. Caller spends the AP.
 */
export function meleeAttack(state: GameState, attacker: Entity, defender: Entity): void {
  defender.alerted = true;
  const isPlayer = attacker.id === state.player.id;
  const def = isPlayer ? null : enemyDef(attacker.defId);
  const dmg = isPlayer ? KNIFE.damage : (def?.meleeDamage ?? 1);

  pushLog(
    state,
    isPlayer
      ? `You knife the ${defender.name} for ${dmg}.`
      : `The ${attacker.name} strikes you for ${dmg}.`,
  );

  const drain = def?.apDrainOnHit;
  if (drain) {
    defender.pendingApDrain = Math.max(defender.pendingApDrain ?? 0, drain);
    pushLog(state, `Your muscles seize. (-${drain} AP next turn)`);
  }

  dealDamage(state, attacker, defender, dmg, killVerbFor(attacker));
}

export function dealDamage(
  state: GameState,
  attacker: Entity,
  defender: Entity,
  dmg: number,
  killVerb: string,
): void {
  defender.hp -= dmg;
  if (defender.hp <= 0) kill(state, attacker, defender, killVerb);
}

function kill(state: GameState, attacker: Entity, defender: Entity, killVerb: string): void {
  if (defender.id === state.player.id) {
    state.phase = "dead";
    state.killedBy = `${killVerb} ${attacker.name} — Floor ${state.floor} — Seed ${state.seed}`;
    pushLog(state, "You die. HR has been notified.");
  } else {
    state.enemies = state.enemies.filter((e) => e.id !== defender.id);
    pushLog(state, `The ${defender.name} collapses.`);
  }
}

function killVerbFor(attacker: Entity): string {
  if (attacker.defId === "player") return "Killed by";
  return enemyDef(attacker.defId).killVerb ?? "Killed by";
}
