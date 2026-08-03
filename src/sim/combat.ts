import { enemyDef } from "../data/enemies";
import { perkDef } from "../data/perks";
import { bandFor, weaponDef, type WeaponDef } from "../data/weapons";
import { AP_COSTS, KNIFE } from "../data/costs";
import type { SimRNG } from "./rng";
import { distance, hasPerk, pushLog, spawnItemNear, type Entity, type GameState } from "./state";

/**
 * What pulling the trigger costs right now, including working a bolt that was
 * left open. Callers guard on this; fireWeapon spends it.
 */
export function apToFire(attacker: Entity, weapon: WeaponDef): number {
  const boltOpen = weapon.boltAction === true && attacker.chambered === false;
  return weapon.apFire + (boltOpen ? AP_COSTS.cycle : 0);
}

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
  const isPlayer = attacker.id === state.player.id;
  // Captured before the shot, because firing is what alerts them.
  const ambush = isPlayer && !defender.alerted && hasPerk(state, "severance");

  if (weapon.boltAction) {
    if (attacker.chambered === false) {
      attacker.ap -= AP_COSTS.cycle;
      pushLog(state, isPlayer ? "You work the bolt." : `The ${attacker.name} works the bolt.`);
    }
    attacker.chambered = false;
  }
  attacker.ap -= weapon.apFire;
  attacker.ammoInMag -= pellets;
  // Gunfire is loud: being shot at wakes the target regardless of outcome.
  // (Stage 3's suppressor attachment is the counterplay to this rule.)
  defender.alerted = true;

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
  // Braced: set your feet and the belt-fed stops spraying the ceiling. The
  // cheap version of a bipod — no new action, just "did you move this turn".
  // Ergonomic Workspace extends bracing to every gun, not just the belt-feds.
  const bracedBonus =
    weapon.bracedBonus ?? (isPlayer && hasPerk(state, "ergonomic") ? (perkDef("ergonomic").value ?? 0) : 0);
  const braced = bracedBonus && !attacker.movedThisTurn ? bracedBonus : 0;
  const accuracy = Math.min(1, weapon.baseAccuracy * band.accMult + braced);
  const machine = isPlayer && enemyIsMachine(state, defender);
  const bonusPerPellet =
    (ambush ? (perkDef("severance").value ?? 0) : 0) +
    (machine && hasPerk(state, "it_cert") ? (perkDef("it_cert").value ?? 0) : 0);

  let hits = 0;
  let misses = 0;
  let totalDmg = 0;
  const land = () => {
    hits += 1;
    // Perk bonuses land after armor, so a flat +2 is not silently eaten by DR.
    totalDmg += Math.max(0, Math.round(weapon.damage * band.dmgMult) - armor) + bonusPerPellet;
  };
  for (let i = 0; i < pellets; i++) {
    if (rng.next() < accuracy) land();
    else misses += 1;
  }
  // Follow-Up Meeting: one missed pellet per volley gets a second chance.
  if (misses > 0 && isPlayer && hasPerk(state, "follow_up") && rng.next() < accuracy) land();

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

  const wasAlive = defender.hp > 0;
  if (totalDmg > 0) dealDamage(state, rng, attacker, defender, totalDmg, killVerbFor(attacker));
  const killed = wasAlive && defender.hp <= 0;

  // Guns are loud. A suppressed weapon buys silence only on a clean kill — a
  // wounded target still shouts, which is what keeps the VSS a scalpel rather
  // than an invisibility cloak.
  if (!(weapon.silentKills && killed)) wakeNeighbours(state, defender.x, defender.y);
}

/**
 * How far a gunshot carries. Measured, not guessed: at 6 the bot lost ~0.8
 * floors of average depth, at 4 about 0.3. Four keeps suppressors meaningful
 * without turning every fight into the whole room. The balance pass owns the
 * final number.
 */
const NOISE_RADIUS = 4;

function wakeNeighbours(state: GameState, x: number, y: number): void {
  for (const enemy of state.enemies) {
    if (enemy.alerted) continue;
    if (distance(enemy, { x, y }) > NOISE_RADIUS) continue;
    enemy.alerted = true;
  }
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
  // A bayonet replaces the knife while its rifle is in hand — which is what
  // makes the SKS the T1 rifle that does not panic when the dog closes.
  const blade = isPlayer && attacker.weaponId ? weaponDef(attacker.weaponId).bayonet : undefined;
  const bonus = isPlayer
    ? (hasPerk(state, "letter_opener") ? (perkDef("letter_opener").value ?? 0) : 0) +
      (enemyIsMachine(state, defender) && hasPerk(state, "it_cert") ? (perkDef("it_cert").value ?? 0) : 0)
    : 0;
  const dmg = (isPlayer ? (blade ?? KNIFE.damage) : (def?.meleeDamage ?? 1)) + bonus;

  pushLog(
    state,
    isPlayer
      ? blade
        ? `You bayonet the ${defender.name} for ${dmg}.`
        : `You knife the ${defender.name} for ${dmg}.`
      : `The ${attacker.name} strikes you for ${dmg}.`,
  );

  const drain = def?.apDrainOnHit;
  if (drain) {
    defender.pendingApDrain = Math.max(defender.pendingApDrain ?? 0, drain);
    pushLog(state, `Your muscles seize. (-${drain} AP next turn)`);
  }

  dealDamage(state, rng, attacker, defender, dmg, killVerbFor(attacker), { bypassShield: true });
}

export interface DamageOptions {
  /**
   * Melee sets this. Blades find the gaps in plate, so armor DR and the shield
   * pool are both skipped — which is what keeps a fully-plated player afraid of
   * exactly the enemies designed to punish camping. Load-bearing: if plates
   * ever feel too safe, cut plate values, never this.
   */
  bypassShield?: boolean;
}

export function dealDamage(
  state: GameState,
  rng: SimRNG,
  attacker: Entity,
  defender: Entity,
  dmg: number,
  killVerb: string,
  options: DamageOptions = {},
): void {
  let remaining = dmg;
  const shield = defender.shield ?? 0;
  if (!options.bypassShield && shield > 0) {
    const absorbed = Math.min(shield, remaining);
    remaining -= absorbed;
    const left = shield - absorbed;
    if (left > 0) defender.shield = left;
    else delete defender.shield;
    pushLog(
      state,
      defender.id === state.player.id
        ? left > 0
          ? `Your plates take ${absorbed}. (${left} left)`
          : "Your last plate shatters."
        : `The ${defender.name}'s plates take ${absorbed}.`,
    );
  }
  if (remaining <= 0) return;
  defender.hp -= remaining;
  if (defender.hp <= 0 && defender.id === state.player.id && hasPerk(state, "golden_parachute") && !state.parachuteUsed) {
    state.parachuteUsed = true;
    defender.hp = 1;
    pushLog(state, "Your golden parachute opens. You are still standing, barely.");
    return;
  }
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
  // XP for every kill including quiet ones, so a stealth build never starves.
  state.xp += enemyDef(defender.defId).xp;
  rollDrops(state, rng, defender);
}

function rollDrops(state: GameState, rng: SimRNG, corpse: Entity): void {
  const def = enemyDef(corpse.defId);
  for (const drop of def.drops ?? []) {
    if (rng.next() >= drop.chance) continue;
    if (drop.ammo) {
      const { caliber, min, max } = drop.ammo;
      const rolled = min + Math.floor(rng.next() * (max - min + 1));
      const amount = hasPerk(state, "asset_recovery") ? Math.ceil(rolled * 1.5) : rolled;
      spawnItemNear(state, { kind: "ammo", caliber, amount }, corpse.x, corpse.y);
    }
    if (drop.cash) {
      const { min, max } = drop.cash;
      const amount = min + Math.floor(rng.next() * (max - min + 1));
      state.cash += amount;
      pushLog(state, `You pocket ${amount} credits.`);
    }
    if (drop.itemId) {
      spawnItemNear(state, { kind: "consumable", itemId: drop.itemId }, corpse.x, corpse.y);
    }
    if (drop.weaponId) {
      const weapon = weaponDef(drop.weaponId);
      spawnItemNear(
        state,
        { kind: "weapon", weaponId: drop.weaponId, ammoInMag: weapon.magSize },
        corpse.x,
        corpse.y,
      );
    }
  }
}

function enemyIsMachine(state: GameState, entity: Entity): boolean {
  if (entity.id === state.player.id) return false;
  return enemyDef(entity.defId).machine === true;
}

function killVerbFor(attacker: Entity): string {
  if (attacker.defId === "player") return "Killed by";
  return enemyDef(attacker.defId).killVerb ?? "Killed by";
}
