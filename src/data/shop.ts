import type { Caliber } from "./weapons";

/**
 * The merchant, reinstated from the handoff's cut list on purpose: cash needs a
 * sink from day one or it is a dead currency, and plates need a purchase point
 * to be an economy rather than pure drop-RNG.
 *
 * The expensive parts of "merchant" — AI, a presence on the map, can-I-shoot-
 * the-shopkeeper edge cases — are exactly the parts this design skips. He is a
 * menu on the stairwell landing, between floors, where nothing can reach you.
 */
export type ShopEntry = { price: number } & (
  | { kind: "weapon"; weaponId: string }
  | { kind: "ammo"; caliber: Caliber; amount: number }
  | { kind: "plate" }
  | { kind: "consumable"; itemId: string }
  | { kind: "carrier"; carrierId: string }
);

export interface ShopState {
  entries: ShopEntry[];
  /** Indices already bought — kept so prices and layout stay stable. */
  sold: number[];
}

export const PRICES = {
  plate: 12,
  snack: 8,
  bandage: 6,
  medshot: 15,
  medkit: 30,
  stim: 12,
  schematics: 10,
  frag: 15,
  flashbang: 15,
  emp: 18,
  /** Per-round, multiplied by the lot size. */
  ammo: { pistol: 0.6, shell: 1.2, rifle: 0.9, heavy: 2 } as Record<Caliber, number>,
  weapon: { 1: 40, 2: 55, 3: 75, 4: 95 } as Record<number, number>,
  carrier: 45,
} as const;

/** Consumables the merchant will stock, by floor depth. */
export const SHOP_CONSUMABLES: Record<number, string[]> = {
  1: ["bandage", "snack", "medshot"],
  2: ["bandage", "medshot", "stim", "schematics", "frag"],
  3: ["medshot", "stim", "frag", "flashbang", "schematics"],
  4: ["medshot", "medkit", "frag", "flashbang", "emp"],
  5: ["medkit", "stim", "flashbang", "emp", "frag"],
  6: ["medkit", "stim", "emp", "flashbang"],
  7: ["medkit", "emp", "flashbang", "frag"],
  8: ["medkit", "emp", "stim"],
};

/** Discount from the Expense Account certification. */
export const EXPENSE_ACCOUNT_DISCOUNT = 0.25;

export function priceWithPerks(base: number, hasExpenseAccount: boolean): number {
  const price = hasExpenseAccount ? base * (1 - EXPENSE_ACCOUNT_DISCOUNT) : base;
  return Math.max(1, Math.round(price));
}
