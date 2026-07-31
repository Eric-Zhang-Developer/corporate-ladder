/**
 * Weapons are data entries (handoff §6 rule 2). Damage-per-AP at each range
 * band is the only balance currency (§2, §8) — the shape here is the
 * balance spreadsheet in code.
 */

/**
 * Four ammo channels, not three. Each is an economy valve rather than realism:
 * pistol is plentiful everywhere (it feeds the sidearm that never starves),
 * shell is chunky and room-scale, rifle is the mid/late workhorse, and heavy
 * feeds the most mouths of any channel (every sniper, battle rifle and the
 * Deagle) which is what makes carrying two heavy guns a real bet.
 */
export type Caliber = "pistol" | "shell" | "rifle" | "heavy";

/** Balance-test grouping: guns are compared within a tier, never across. */
export type WeaponClass = "pistol" | "smg" | "shotgun" | "rifle" | "dmr" | "sniper" | "lmg";

export interface RangeBand {
  /** Band applies up to this distance (Euclidean tiles). */
  maxDist: number;
  accMult: number;
  dmgMult: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  apFire: number;
  apReload: number;
  /** Per shot (per pellet), before band multipliers. */
  damage: number;
  /** Hit chance at point blank, before band multipliers. */
  baseAccuracy: number;
  /** Ordered by maxDist; ranges past the last band are out of range. */
  bands: RangeBand[];
  magSize: number;
  caliber: Caliber;
  /** Rounds per trigger pull, each rolled independently (Uzi volley). */
  pellets?: number;
  /** Index into bands: where this gun is meant to live (balance test). */
  intendedBand?: number;
  /**
   * Subtracted from the target's armor before per-pellet damage reduction.
   * Rare and T3+ — it is what lets a small gun stay relevant against plate.
   */
  armorPierce?: number;
  /** Loot tier; absent on enemy-only variants, which are tuned separately. */
  tier?: 0 | 1 | 2 | 3 | 4;
  cls?: WeaponClass;
}

export const WEAPONS = {
  glock: {
    id: "glock",
    name: "Glock",
    apFire: 1,
    apReload: 1,
    damage: 3,
    baseAccuracy: 0.95,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      // The long-band accuracy cliff is the repositioning incentive.
      { maxDist: 8, accMult: 0.55, dmgMult: 1.0 },
    ],
    magSize: 7,
    caliber: "pistol",
    intendedBand: 1,
    tier: 0,
    cls: "pistol",
  },
  revolver: {
    id: "revolver",
    name: "Revolver",
    apFire: 1,
    apReload: 2,
    damage: 5,
    baseAccuracy: 0.8,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.45, dmgMult: 1.0 },
    ],
    magSize: 6,
    caliber: "pistol",
    intendedBand: 1,
    tier: 1,
    cls: "pistol",
  },
  uzi: {
    id: "uzi",
    name: "Micro Uzi",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.5,
    bands: [
      { maxDist: 1, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.4, dmgMult: 1.0 },
    ],
    magSize: 20,
    caliber: "pistol",
    pellets: 4,
    intendedBand: 1,
    tier: 1,
    cls: "smg",
  },
  serbu: {
    id: "serbu",
    name: "Serbu Shorty",
    apFire: 1,
    apReload: 2,
    damage: 6,
    baseAccuracy: 0.7,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 2, accMult: 0.9, dmgMult: 0.9 },
      // Devastating at arm's length, a paperweight past it (§4.2).
      { maxDist: 3, accMult: 0.5, dmgMult: 0.35 },
    ],
    magSize: 3,
    caliber: "shell",
    intendedBand: 0,
    tier: 1,
    cls: "shotgun",
  },
  mosin: {
    id: "mosin",
    name: "Mosin-Nagant",
    apFire: 2,
    apReload: 2,
    damage: 8,
    baseAccuracy: 0.9,
    bands: [
      // Hates adjacency; sings at range — the kiting gun.
      { maxDist: 2, accMult: 0.55, dmgMult: 1.0 },
      { maxDist: 8, accMult: 1.0, dmgMult: 1.0 },
    ],
    magSize: 5,
    caliber: "heavy",
    intendedBand: 1,
    tier: 1,
    cls: "sniper",
  },
  // Enemy-tuned variants — separate entries so enemy lethality tunes
  // independently of the player's guns.
  glock_cop: {
    id: "glock_cop",
    name: "Glock",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.65,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 5,
    caliber: "pistol",
  },
  serbu_guard: {
    id: "serbu_guard",
    name: "Serbu Shorty",
    apFire: 1,
    apReload: 2,
    damage: 4,
    baseAccuracy: 0.6,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 2, accMult: 0.9, dmgMult: 0.9 },
      { maxDist: 4, accMult: 0.5, dmgMult: 0.35 },
    ],
    magSize: 3,
    caliber: "shell",
  },
} satisfies Record<string, WeaponDef>;

export function weaponDef(id: string): WeaponDef {
  const def = (WEAPONS as Record<string, WeaponDef>)[id];
  if (!def) throw new Error(`Unknown weapon: ${id}`);
  return def;
}

export function bandFor(def: WeaponDef, dist: number): RangeBand | null {
  for (const band of def.bands) {
    if (dist <= band.maxDist) return band;
  }
  return null;
}

export function maxRange(def: WeaponDef): number {
  return def.bands[def.bands.length - 1]?.maxDist ?? 0;
}

/** Expected damage per AP at a distance — the live spreadsheet (§6 rule 4). */
export function dmgPerAp(def: WeaponDef, dist: number): number {
  return dmgPerApVs(def, dist, 0);
}

/**
 * The same spreadsheet against an armored target. Armor is subtracted from
 * every pellet independently, so a four-pellet spray loses four times as much
 * as a single heavy hit — this is the whole reason the roster differentiates
 * by target type and not just by distance.
 */
export function dmgPerApVs(def: WeaponDef, dist: number, armor: number): number {
  const band = bandFor(def, dist);
  if (!band) return 0;
  const pellets = def.pellets ?? 1;
  const effective = Math.max(0, armor - (def.armorPierce ?? 0));
  const perPellet = Math.max(0, def.damage * band.dmgMult - effective);
  return (pellets * perPellet * def.baseAccuracy * band.accMult) / def.apFire;
}
