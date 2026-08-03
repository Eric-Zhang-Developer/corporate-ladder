import { describe, expect, it } from "vitest";
import { actionForKey } from "../../src/input/keyboard";
import type { Action } from "../../src/sim/actions";

/**
 * The input layer is thin, but "thin" is not "cannot be wrong": a plate action
 * and six hotbar keys once shipped with no binding at all, and nothing caught
 * it because every test and the bot call applyAction directly. This asserts
 * that a human can actually reach the game.
 */
function press(key: string): Action | null {
  return actionForKey({ key } as KeyboardEvent);
}

/**
 * Actions a key cannot produce on its own, and what does produce them. Adding
 * an action means either binding it or adding it here with its reason.
 */
const UI_DRIVEN: Record<string, string> = {
  throwItem: "the throw cursor, opened by a hotbar key holding a grenade",
  drop: "X, then a slot key",
  choosePerk: "1 or 2 on the promotion overlay",
  buy: "number keys on the shop overlay",
  leaveShop: "Enter on the shop overlay",
};

describe("keyboard bindings", () => {
  it("moves in four directions from both arrows and WASD", () => {
    expect(press("ArrowUp")).toEqual({ type: "move", dx: 0, dy: -1 });
    expect(press("w")).toEqual({ type: "move", dx: 0, dy: -1 });
    expect(press("ArrowRight")).toEqual({ type: "move", dx: 1, dy: 0 });
    expect(press("d")).toEqual({ type: "move", dx: 1, dy: 0 });
  });

  it("binds the combat verbs", () => {
    expect(press("f")).toEqual({ type: "fire" });
    expect(press("r")).toEqual({ type: "reload" });
    expect(press("g")).toEqual({ type: "pickup" });
    expect(press("p")).toEqual({ type: "plate" });
    expect(press(">")).toEqual({ type: "ascend" });
    expect(press(" ")).toEqual({ type: "wait" });
  });

  it("binds three weapon slots and six hotbar slots", () => {
    expect(press("1")).toEqual({ type: "swap", slot: 0 });
    expect(press("3")).toEqual({ type: "swap", slot: 2 });
    expect(press("4")).toEqual({ type: "useItem", slot: 0 });
    expect(press("9")).toEqual({ type: "useItem", slot: 5 });
  });

  it("is case-insensitive and ignores unbound keys", () => {
    expect(press("F")).toEqual({ type: "fire" });
    expect(press("q")).toBeNull();
    expect(press("Escape")).toBeNull();
  });

  it("leaves no action unreachable — every verb has a key or a named mode", () => {
    // The Action union, listed by hand: TypeScript cannot enumerate it at
    // runtime, and an unreachable verb is invisible to every other test.
    const ALL_ACTIONS = [
      "move",
      "fire",
      "reload",
      "swap",
      "pickup",
      "plate",
      "useItem",
      "throwItem",
      "drop",
      "choosePerk",
      "buy",
      "leaveShop",
      "ascend",
      "wait",
    ];
    const bound = new Set<string>();
    for (const key of "abcdefghijklmnopqrstuvwxyz0123456789 .><".split("")) {
      const action = press(key);
      if (action) bound.add(action.type);
    }
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      const action = press(key);
      if (action) bound.add(action.type);
    }
    for (const type of ALL_ACTIONS) {
      const reachable = bound.has(type) || type in UI_DRIVEN;
      expect(reachable, `${type} cannot be triggered by a player`).toBe(true);
    }
  });
});
