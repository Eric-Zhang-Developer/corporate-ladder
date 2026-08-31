import { describe, expect, it } from "vitest";
import { HOTBAR_SLOTS } from "../../src/data/items";
import {
  carrierIsUpgrade,
  hotbarSlotFor,
  sparePlateCapacity,
} from "../../src/sim/inventory";
import { makeState } from "./helpers";

describe("inventory acceptance policy", () => {
  it("applies the spare-plate perk in one place", () => {
    expect(sparePlateCapacity(makeState())).toBe(3);
    expect(sparePlateCapacity(makeState({ perks: ["deep_pockets"] }))).toBe(5);
  });

  it("accepts only strict carrier upgrades", () => {
    expect(carrierIsUpgrade(makeState(), "carrier_ii")).toBe(true);

    const armored = makeState({ carrierId: "carrier_iii" });
    expect(carrierIsUpgrade(armored, "carrier_ii")).toBe(false);
    expect(carrierIsUpgrade(armored, "carrier_iii")).toBe(false);
    expect(carrierIsUpgrade(armored, "carrier_iv")).toBe(true);
  });

  it("prefers an existing stack, then an empty slot, then refuses", () => {
    const hotbar = new Array(HOTBAR_SLOTS).fill(null);
    hotbar[2] = { itemId: "bandage", count: 1 };
    const state = makeState({ hotbar });
    expect(hotbarSlotFor(state, "bandage")).toBe(2);
    expect(hotbarSlotFor(state, "stim")).toBe(0);

    state.hotbar = state.hotbar.map(
      (slot, index) => slot ?? { itemId: `full-${index}`, count: 1 },
    );
    expect(hotbarSlotFor(state, "stim")).toBe(-1);
  });
});
