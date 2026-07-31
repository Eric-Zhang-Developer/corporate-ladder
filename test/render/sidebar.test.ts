import { describe, expect, it } from "vitest";
import { apPips } from "../../src/render/dom/sidebar";
import { applyAction } from "../../src/sim/step";
import { makeState } from "../sim/helpers";

/**
 * The renderer is thin by design, but "thin" is not "cannot be wrong": the AP
 * pip row divided by an unclamped `maxAp - ap` and threw a RangeError the
 * moment a perk or a stim pushed the player over their budget, aborting the
 * frame mid-update. The sim was correct throughout, so no sim test could see
 * it, and the bot never renders. This is the seam those two miss.
 */
describe("AP pips", () => {
  it("draws spent and remaining inside the budget", () => {
    expect(apPips(3, 3)).toBe("◆◆◆");
    expect(apPips(1, 3)).toBe("◆◇◇");
    expect(apPips(0, 3)).toBe("◇◇◇");
  });

  it("gives bonus AP its own run rather than more of the same", () => {
    expect(apPips(4, 3)).toBe(`◆◆◆<span class="ap-bonus">+◆</span>`);
    expect(apPips(5, 3)).toBe(`◆◆◆<span class="ap-bonus">+◆◆</span>`);
  });

  it("survives every AP a producer in the sim can actually reach", () => {
    // Hazard Pay tops up after the refill; a stim adds three on top of that.
    // Both are intended, so the renderer is what has to bend.
    for (let ap = -1; ap <= 9; ap++) {
      expect(() => apPips(ap, 3), `${ap}/3`).not.toThrow();
    }
  });
});

describe("the AP producers this row has to survive", () => {
  it("Hazard Pay ends a quiet turn over budget", () => {
    const state = makeState({ perks: ["hazard_pay"] });
    applyAction(state, { type: "wait" });
    expect(state.player.ap).toBeGreaterThan(state.player.maxAp);
    expect(() => apPips(state.player.ap, state.player.maxAp)).not.toThrow();
  });

  it("a stim does the same, harder", () => {
    const hotbar = makeState().hotbar;
    hotbar[0] = { itemId: "stim", count: 1 };
    const state = makeState({ hotbar });
    applyAction(state, { type: "useItem", slot: 0 });
    expect(state.player.ap).toBeGreaterThan(state.player.maxAp);
    expect(() => apPips(state.player.ap, state.player.maxAp)).not.toThrow();
  });
});
