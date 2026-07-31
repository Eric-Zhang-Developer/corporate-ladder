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
  /** Vending machines. Unlimited stock — the limit is cash and the walk back. */
  vendingMachines?: number;
  /**
   * The pair's miniboss, if it spawns here. Guaranteed, not a variance unique:
   * every run gets the same skeleton of landmark fights, which alpha playtests
   * need for comparability.
   */
  boss?: string;
}

export const FLOORS: FloorDef[] = [
  {
    depth: 1,
    name: "LOBBY",
    groups: { min: 4, max: 5 },
    weights: { rentacop: 34, shotgun: 12, camera: 10, dog: 14, taser: 12, baton: 10, roomba: 8 },
    lootWeapons: ["revolver", "uzi", "serbu"],
    lootAmmo: { min: 10, max: 16 },
    scatterPiles: 2,
    scatterAmount: { min: 4, max: 8 },
    platePiles: 1,
    consumablePiles: 2,
    consumablePool: ["bandage", "snack", "medshot"],
    vendingMachines: 1,
  },
  {
    depth: 2,
    name: "OFFICES",
    groups: { min: 5, max: 7 },
    weights: { rentacop: 26, shotgun: 18, camera: 12, dog: 14, taser: 12, baton: 12, roomba: 6 },
    lootWeapons: ["revolver", "uzi", "serbu", "mosin", "sks", "mini14", "tec9"],
    lootAmmo: { min: 10, max: 16 },
    scatterPiles: 2,
    scatterAmount: { min: 4, max: 8 },
    platePiles: 2,
    carrier: "carrier_ii",
    consumablePiles: 3,
    consumablePool: ["bandage", "snack", "medshot", "stim", "schematics", "frag", "flashbang"],
    vendingMachines: 2,
    boss: "janitor",
  },
  {
    depth: 3,
    name: "HUMAN RESOURCES",
    groups: { min: 5, max: 7 },
    // Machines with teeth arrive, and the supervisor puts a clock in the room.
    weights: { contractor: 40, riot: 10, k9: 12, fpv: 6, supervisor: 10, camera: 8, dog: 8, taser: 6 },
    lootWeapons: ["ar15", "mp5", "m870", "deagle", "fiveseven", "b93r", "garand"],
    lootAmmo: { min: 12, max: 20 },
    scatterPiles: 3,
    scatterAmount: { min: 5, max: 10 },
    platePiles: 2,
    consumablePiles: 3,
    consumablePool: ["bandage", "medshot", "stim", "frag", "flashbang", "schematics"],
    vendingMachines: 2,
  },
  {
    depth: 4,
    name: "SECURITY",
    groups: { min: 6, max: 8 },
    // The armory floor: more guns per square tile than anywhere below.
    weights: { contractor: 42, riot: 12, k9: 12, fpv: 6, supervisor: 8, camera: 6, baton: 8, taser: 6 },
    lootWeapons: ["ar15", "mp5", "m870", "rem700", "deagle", "b93r", "garand", "fiveseven"],
    lootAmmo: { min: 14, max: 22 },
    scatterPiles: 3,
    scatterAmount: { min: 6, max: 12 },
    platePiles: 2,
    carrier: "carrier_iii",
    consumablePiles: 3,
    consumablePool: ["medshot", "stim", "frag", "flashbang", "emp", "medkit"],
    vendingMachines: 2,
    boss: "handler",
  },
];

/** The tower grows one pair at a time; alpha ends at 8. */
export const LAST_FLOOR = 4;

export function floorDef(depth: number): FloorDef {
  const def = FLOORS.find((f) => f.depth === depth);
  if (!def) throw new Error(`No floor def for depth ${depth}`);
  return def;
}

export const CALIBERS: Caliber[] = ["pistol", "shell", "rifle", "heavy"];
