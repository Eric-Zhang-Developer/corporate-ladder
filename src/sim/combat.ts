import { bandFor, weaponDef } from "../data/weapons";
import type { SimRNG } from "./rng";
import { distance, pushLog, type Entity, type GameState } from "./state";

/**
 * One firing path for everyone — the player and every enemy resolve shots
 * through here. Caller has already validated LOS, range, ammo, and AP.
 */
export function fireWeapon(state: GameState, rng: SimRNG, attacker: Entity, defender: Entity): void {
  const weapon = weaponDef(attacker.weaponId);
  attacker.ap -= weapon.apFire;
  attacker.ammoInMag -= 1;

  const dist = distance(attacker, defender);
  const band = bandFor(weapon, dist);
  if (!band) {
    pushLog(state, describe(attacker, "fires wide.", "fire wide."));
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
  defender.hp -= dmg;
  pushLog(
    state,
    attacker.id === state.player.id
      ? `You hit the ${defender.name} for ${dmg}.`
      : `The ${attacker.name} hits you for ${dmg}.`,
  );

  if (defender.hp <= 0) kill(state, attacker, defender);
}

function kill(state: GameState, attacker: Entity, defender: Entity): void {
  if (defender.id === state.player.id) {
    state.phase = "dead";
    state.killedBy = `Shot to death by ${attacker.name} — Floor 1 — Seed ${state.seed}`;
    pushLog(state, "You die. HR has been notified.");
  } else {
    state.enemies = state.enemies.filter((e) => e.id !== defender.id);
    pushLog(state, `The ${defender.name} collapses.`);
  }
}

function describe(attacker: Entity, third: string, second: string): string {
  return attacker.name === "You" ? `You ${second}` : `The ${attacker.name} ${third}`;
}
