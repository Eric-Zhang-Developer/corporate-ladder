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
  /** Per shot, before band multipliers. */
  damage: number;
  /** Hit chance at point blank, before band multipliers. */
  baseAccuracy: number;
  /** Ordered by maxDist; ranges past the last band are out of range. */
  bands: RangeBand[];
  magSize: number;
  /** Inert in Stage 1 — the ammo economy arrives in Stage 2. */
  caliber: Caliber;
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
  },
  // The rent-a-cop's sidearm — separate entry so enemy lethality tunes
  // independently of the player's gun.
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
  return (def.damage * band.dmgMult * def.baseAccuracy * band.accMult) / def.apFire;
}
