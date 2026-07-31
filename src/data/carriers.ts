/**
 * Plate carriers: the permanent half of the armor economy. The carrier is
 * found gear that sets capacity and per-plate value; the plates themselves are
 * a consumable counter. "Armor is ammo for your health bar."
 *
 * Deliberate simplification: plates are one fungible item type and the carrier
 * decides what each is worth. No per-slot plate-quality bookkeeping — the
 * segmented bar reads the same and the sim stays a number.
 */
export interface CarrierDef {
  id: string;
  name: string;
  /** Plates it holds; capacity is slots x plateValue. */
  slots: number;
  /** Shield points restored by one plate. */
  plateValue: number;
}

export const CARRIERS = {
  carrier_ii: { id: "carrier_ii", name: "Level II Carrier", slots: 2, plateValue: 4 },
  carrier_iii: { id: "carrier_iii", name: "Level III Carrier", slots: 3, plateValue: 5 },
  carrier_iv: { id: "carrier_iv", name: "Level IV Carrier", slots: 3, plateValue: 6 },
} satisfies Record<string, CarrierDef>;

export function carrierDef(id: string): CarrierDef {
  const def = (CARRIERS as Record<string, CarrierDef>)[id];
  if (!def) throw new Error(`Unknown carrier: ${id}`);
  return def;
}

export function carrierCapacity(id: string): number {
  const def = carrierDef(id);
  return def.slots * def.plateValue;
}

/**
 * Uncapped spares would turn floor-1 thoroughness into floor-7 invincibility.
 * The Deep Pockets perk raises this.
 */
export const SPARE_PLATE_CAP = 3;
