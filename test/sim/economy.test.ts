import { describe, expect, it } from "vitest";
import { enemyDef, ENEMIES } from "../../src/data/enemies";
import { EXPENSE_ACCOUNT_DISCOUNT, PRICES, priceWithPerks } from "../../src/data/shop";
import { newGame } from "../../src/sim/floor";
import { meleeAttack } from "../../src/sim/combat";
import { createSimRng } from "../../src/sim/rng";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState } from "./helpers";

/** Walks a fresh run to the stairs and up, landing in the shop. */
function atTheLanding(seed = 4242) {
  const state = newGame(seed);
  state.player.x = state.stairs.x;
  state.player.y = state.stairs.y;
  state.cash = 200;
  applyAction(state, { type: "ascend" });
  return state;
}

describe("cash", () => {
  it("humans are salaried and machines are capital expenditure", () => {
    for (const id of Object.keys(ENEMIES)) {
      const def = enemyDef(id);
      const paysCash = (def.drops ?? []).some((d) => d.cash);
      if (def.machine) expect(paysCash, `${id} is a machine and should not pay`).toBe(false);
    }
    expect((enemyDef("rentacop").drops ?? []).some((d) => d.cash)).toBe(true);
  });

  it("lands in the wallet on a kill", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = makeState({ enemies: [target] });
    meleeAttack(state, createSimRng(1), state.player, target);
    expect(state.cash).toBeGreaterThan(0);
  });
});

describe("the stairwell landing", () => {
  it("opens on ascend and does not build the next floor until you leave", () => {
    const state = atTheLanding();
    expect(state.phase).toBe("shopping");
    expect(state.floor).toBe(1); // still below; the climb is not finished
    expect(state.shop!.entries.length).toBeGreaterThanOrEqual(4);

    applyAction(state, { type: "leaveShop" });
    expect(state.phase).toBe("playing");
    expect(state.floor).toBe(2);
    expect(state.shop).toBeUndefined();
  });

  it("always stocks a plate and ammo — the two things a run cannot do without", () => {
    for (const seed of [1, 7, 42, 88412]) {
      const shop = atTheLanding(seed).shop!;
      expect(shop.entries.some((e) => e.kind === "plate"), `seed ${seed}`).toBe(true);
      expect(shop.entries.some((e) => e.kind === "ammo"), `seed ${seed}`).toBe(true);
    }
  });

  it("is seeded — the same run shows the same shelf", () => {
    expect(atTheLanding(31337).shop).toEqual(atTheLanding(31337).shop);
  });

  it("charges, delivers, and marks the line sold", () => {
    const state = atTheLanding();
    const index = state.shop!.entries.findIndex((e) => e.kind === "plate");
    const price = state.shop!.entries[index]!.price;
    const before = state.cash;
    applyAction(state, { type: "buy", index });
    expect(state.spareplates).toBe(1);
    expect(state.cash).toBe(before - price);
    expect(state.shop!.sold).toContain(index);

    applyAction(state, { type: "buy", index });
    expect(state.cash).toBe(before - price); // no double-dipping
  });

  it("refuses what you cannot afford without taking the money", () => {
    const state = atTheLanding();
    state.cash = 0;
    applyAction(state, { type: "buy", index: 0 });
    expect(state.cash).toBe(0);
    expect(state.shop!.sold).toHaveLength(0);
    expect(state.log.at(-1)).toContain("You have 0");
  });

  it("charges nothing when the goods cannot be carried", () => {
    const state = atTheLanding();
    state.spareplates = 99; // over any cap
    const index = state.shop!.entries.findIndex((e) => e.kind === "plate");
    const before = state.cash;
    applyAction(state, { type: "buy", index });
    expect(state.cash).toBe(before);
    expect(state.shop!.sold).not.toContain(index);
  });

  it("nothing can reach you on the landing", () => {
    const state = atTheLanding();
    const frozen = JSON.parse(JSON.stringify(state));
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    applyAction(state, { type: "fire" });
    applyAction(state, { type: "wait" });
    expect(state).toEqual(frozen);
  });
});

describe("vending machines", () => {
  it("sell snacks for cash and never run out", () => {
    const state = makeState({
      cash: 100,
      items: [{ id: 1, x: 2, y: 2, kind: "vending" }],
    });
    applyAction(state, { type: "pickup" });
    applyAction(state, { type: "pickup" });
    expect(state.hotbar[0]).toEqual({ itemId: "snack", count: 2 });
    expect(state.cash).toBe(100 - PRICES.snack * 2);
    expect(state.items).toHaveLength(1); // the machine stays
  });

  it("refuse politely when you are broke, and cost nothing", () => {
    const state = makeState({ cash: 0, items: [{ id: 1, x: 2, y: 2, kind: "vending" }] });
    applyAction(state, { type: "pickup" });
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.hotbar.every((s) => s === null)).toBe(true);
  });
});

describe("Expense Account", () => {
  it("discounts merchants and vending alike", () => {
    expect(priceWithPerks(100, true)).toBe(100 * (1 - EXPENSE_ACCOUNT_DISCOUNT));
    expect(priceWithPerks(100, false)).toBe(100);
    expect(priceWithPerks(1, true)).toBeGreaterThanOrEqual(1); // never free
  });

  it("applies at the vending machine", () => {
    const state = makeState({
      cash: 100,
      perks: ["expense_account"],
      items: [{ id: 1, x: 2, y: 2, kind: "vending" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.cash).toBe(100 - priceWithPerks(PRICES.snack, true));
  });
});
