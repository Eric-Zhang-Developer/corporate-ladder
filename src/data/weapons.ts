/**
 * Weapons are data entries (handoff §6 rule 2). Damage-per-AP at each range
 * band is the only balance currency (§2, §8) — the shape here is the
 * balance spreadsheet in code.
 */
export type Caliber = "small" | "medium" | "large";

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
    caliber: "small",
    intendedBand: 1,
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
    caliber: "small",
    intendedBand: 1,
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
    caliber: "small",
    pellets: 4,
    intendedBand: 1,
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
    caliber: "medium",
    intendedBand: 0,
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
    caliber: "large",
    intendedBand: 1,
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
    caliber: "small",
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
    caliber: "medium",
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
  const band = bandFor(def, dist);
  if (!band) return 0;
  const pellets = def.pellets ?? 1;
  return (pellets * def.damage * band.dmgMult * def.baseAccuracy * band.accMult) / def.apFire;
}
