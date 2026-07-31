import type { Caliber } from "./weapons";

/**
 * Per-floor spawn/loot contract (§4.6). Encounter generation reads only
 * this table — adding a floor is a data entry.
 */
export interface FloorDef {
  depth: number;
  name: string;
  /** Encounter groups rolled per floor. */
  groups: { min: number; max: number };
  /** enemyId -> spawn weight. Melee stays ≈ 1/3 of total (§2 pillar 3). */
  weights: Record<string, number>;
  /** Loot-room weapon pool. */
  lootWeapons: string[];
  /** Loot-room ammo pile size (of the weapon's caliber). */
  lootAmmo: { min: number; max: number };
  /** Scattered ammo piles beyond the loot room. */
  scatterPiles: number;
  scatterAmount: { min: number; max: number };
  /** Loose plates lying around — the renewable half of the armor economy. */
  platePiles?: number;
  /** Carrier upgrade available on this floor, if any. */
  carrier?: string;
  /** Loose consumables, drawn uniformly from this pool. */
  consumablePiles?: number;
  consumablePool?: string[];
}

export const FLOORS: FloorDef[] = [
  {
    depth: 1,
    name: "LOBBY",
    groups: { min: 4, max: 5 },
    weights: { rentacop: 30, shotgun: 12, camera: 10, dog: 14, taser: 12, janitor: 6 },
    lootWeapons: ["revolver", "uzi", "serbu"],
    lootAmmo: { min: 10, max: 16 },
    scatterPiles: 2,
    scatterAmount: { min: 4, max: 8 },
    platePiles: 1,
    consumablePiles: 2,
    consumablePool: ["bandage", "snack", "medshot"],
  },
  {
    depth: 2,
    name: "OFFICES",
    groups: { min: 5, max: 7 },
    weights: { rentacop: 20, shotgun: 18, camera: 12, dog: 16, taser: 14, janitor: 8 },
    lootWeapons: ["revolver", "uzi", "serbu", "mosin", "sks", "mini14", "tec9"],
    lootAmmo: { min: 10, max: 16 },
    scatterPiles: 2,
    scatterAmount: { min: 4, max: 8 },
    platePiles: 2,
    carrier: "carrier_ii",
    consumablePiles: 3,
    consumablePool: ["bandage", "snack", "medshot", "stim", "schematics", "frag", "flashbang"],
  },
];

/** The vertical slice ends here; Stage 3 extends this to 6. */
export const LAST_FLOOR = 2;

export function floorDef(depth: number): FloorDef {
  const def = FLOORS.find((f) => f.depth === depth);
  if (!def) throw new Error(`No floor def for depth ${depth}`);
  return def;
}

export const CALIBERS: Caliber[] = ["pistol", "shell", "rifle", "heavy"];
