import { enemyDef } from "../data/enemies";
import { bandFor, weaponDef } from "../data/weapons";
import { KNIFE } from "../data/costs";
import type { SimRNG } from "./rng";
import { distance, pushLog, type Entity, type GameState } from "./state";

/**
 * One firing path for everyone — the player and every enemy resolve shots
 * through here. Caller has already validated LOS, range, ammo, and AP.
 * One trigger pull fires min(pellets, mag) rounds, each rolled
 * independently, for a single apFire cost.
 */
export function fireWeapon(state: GameState, rng: SimRNG, attacker: Entity, defender: Entity): void {
  if (!attacker.weaponId) return;
  const weapon = weaponDef(attacker.weaponId);
  const pellets = Math.min(weapon.pellets ?? 1, attacker.ammoInMag);
  attacker.ap -= weapon.apFire;
  attacker.ammoInMag -= pellets;
  // Gunfire is loud: being shot at wakes the target regardless of outcome.
  // (Stage 3's suppressor attachment is the counterplay to this rule.)
  defender.alerted = true;

  const isPlayer = attacker.id === state.player.id;
  const dist = distance(attacker, defender);
  const band = bandFor(weapon, dist);
  if (!band) {
    pushLog(state, isPlayer ? "You fire wide." : `The ${attacker.name} fires wide.`);
    return;
  }

  // Armor is flat reduction on EACH pellet, not on the volley's total. That
  // asymmetry is the whole point: four small pellets pay the tax four times
  // and fold against plate, while one heavy round punches through.
  const armor = Math.max(0, (defender.armor ?? 0) - (weapon.armorPierce ?? 0));
  const accuracy = weapon.baseAccuracy * band.accMult;
  let hits = 0;
  let totalDmg = 0;
  for (let i = 0; i < pellets; i++) {
    if (rng.next() < accuracy) {
      hits += 1;
      totalDmg += Math.max(0, Math.round(weapon.damage * band.dmgMult) - armor);
    }
  }

  if (hits > 0 && totalDmg === 0) {
    // Rounds landed and did nothing. Say so plainly — this is how the player
    // learns armor exists and that they brought the wrong gun.
    pushLog(
      state,
      isPlayer
        ? `Your rounds clatter off the ${defender.name}'s armor.`
        : `The ${attacker.name}'s rounds glance off your plating.`,
    );
  } else if (pellets > 1) {
    pushLog(
      state,
      isPlayer
        ? `You spray the ${defender.name} — ${hits}/${pellets} hit for ${totalDmg}.`
        : `The ${attacker.name} sprays you — ${hits}/${pellets} hit for ${totalDmg}.`,
    );
  } else if (hits === 0) {
    pushLog(
      state,
      isPlayer ? `You miss the ${defender.name}.` : `The ${attacker.name} fires and misses.`,
    );
  } else {
    pushLog(
      state,
      isPlayer
        ? `You hit the ${defender.name} for ${totalDmg}.`
        : `The ${attacker.name} hits you for ${totalDmg}.`,
    );
  }

  if (totalDmg > 0) dealDamage(state, rng, attacker, defender, totalDmg, killVerbFor(attacker));
}

/**
 * Melee for both sides: the player's knife bump and every enemy melee
 * behavior land through here. Auto-hit — melee tension comes from
 * positioning, not rolls. Caller spends the AP.
 */
export function meleeAttack(state: GameState, rng: SimRNG, attacker: Entity, defender: Entity): void {
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

  dealDamage(state, rng, attacker, defender, dmg, killVerbFor(attacker));
}

export function dealDamage(
  state: GameState,
  rng: SimRNG,
  attacker: Entity,
  defender: Entity,
  dmg: number,
  killVerb: string,
): void {
  defender.hp -= dmg;
  if (defender.hp <= 0) kill(state, rng, attacker, defender, killVerb);
}

function kill(state: GameState, rng: SimRNG, attacker: Entity, defender: Entity, killVerb: string): void {
  if (defender.id === state.player.id) {
    state.phase = "dead";
    state.killedBy = `${killVerb} ${attacker.name} — Floor ${state.floor} — Seed ${state.seed}`;
    pushLog(state, "You die. HR has been notified.");
    return;
  }

  state.enemies = state.enemies.filter((e) => e.id !== defender.id);
  pushLog(state, `The ${defender.name} collapses.`);
  rollDrops(state, rng, defender);
}

function rollDrops(state: GameState, rng: SimRNG, corpse: Entity): void {
  const def = enemyDef(corpse.defId);
  for (const drop of def.drops ?? []) {
    if (rng.next() >= drop.chance) continue;
    if (drop.ammo) {
      const { caliber, min, max } = drop.ammo;
      const amount = min + Math.floor(rng.next() * (max - min + 1));
      state.items.push({ id: state.nextId++, x: corpse.x, y: corpse.y, kind: "ammo", caliber, amount });
    }
    if (drop.weaponId) {
      const weapon = weaponDef(drop.weaponId);
      state.items.push({
        id: state.nextId++,
        x: corpse.x,
        y: corpse.y,
        kind: "weapon",
        weaponId: drop.weaponId,
        ammoInMag: weapon.magSize,
      });
    }
  }
}

function killVerbFor(attacker: Entity): string {
  if (attacker.defId === "player") return "Killed by";
  return enemyDef(attacker.defId).killVerb ?? "Killed by";
}
