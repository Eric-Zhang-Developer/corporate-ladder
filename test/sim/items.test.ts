import { describe, expect, it } from "vitest";
import { AP_COSTS } from "../../src/data/costs";
import { HOTBAR_SLOTS, ITEMS, itemDef } from "../../src/data/items";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState, openMap, setWall } from "./helpers";

const EMPTY = () => new Array(HOTBAR_SLOTS).fill(null);

describe("the hotbar", () => {
  it("stacks a repeat pickup rather than spending a second slot", () => {
    const state = makeState({
      items: [
        { id: 1, x: 2, y: 2, kind: "consumable", itemId: "bandage" },
        { id: 2, x: 2, y: 2, kind: "consumable", itemId: "bandage" },
      ],
    });
    applyAction(state, { type: "pickup" });
    applyAction(state, { type: "pickup" });
    expect(state.hotbar[0]).toEqual({ itemId: "bandage", count: 2 });
    expect(state.hotbar[1]).toBeNull();
  });

  it("opens a new slot once the stack cap is reached", () => {
    const full = EMPTY();
    full[0] = { itemId: "bandage", count: ITEMS.bandage.stack };
    const state = makeState({
      hotbar: full,
      items: [{ id: 1, x: 2, y: 2, kind: "consumable", itemId: "bandage" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.hotbar[0]!.count).toBe(ITEMS.bandage.stack);
    expect(state.hotbar[1]).toEqual({ itemId: "bandage", count: 1 });
  });

  it("refuses for free when every slot is spoken for", () => {
    const full = EMPTY().map((_, i) => ({ itemId: "medkit", count: 1, _i: i }));
    const state = makeState({
      hotbar: full.map((f) => ({ itemId: f.itemId, count: f.count })),
      items: [{ id: 1, x: 2, y: 2, kind: "consumable", itemId: "stim" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.items).toHaveLength(1);
    expect(state.log.at(-1)).toContain("No room");
  });
});

describe("using consumables", () => {
  it("heals for its amount, never past max, and consumes one from the stack", () => {
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "bandage", count: 2 };
    const state = makeState({ hotbar, player: { hp: 3 } });
    applyAction(state, { type: "useItem", slot: 0 });
    expect(state.player.hp).toBe(8);
    expect(state.hotbar[0]).toEqual({ itemId: "bandage", count: 1 });
    expect(state.player.ap).toBe(state.player.maxAp - ITEMS.bandage.apUse);
  });

  it("clears the slot when the last one is used", () => {
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "snack", count: 1 };
    const state = makeState({ hotbar, player: { hp: 1 } });
    applyAction(state, { type: "useItem", slot: 0 });
    expect(state.hotbar[0]).toBeNull();
  });

  it("refuses at full HP for free — the typo rule applies to items too", () => {
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "medkit", count: 1 };
    const state = makeState({ hotbar });
    applyAction(state, { type: "useItem", slot: 0 });
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.hotbar[0]).toEqual({ itemId: "medkit", count: 1 });
    expect(state.log.at(-1)).toContain("not hurt");
  });

  it("the medkit costs a whole turn and heals everything", () => {
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "medkit", count: 1 };
    const state = makeState({ hotbar, player: { hp: 1 } });
    expect(ITEMS.medkit.apUse).toBe(state.player.maxAp); // helpless for a turn
    applyAction(state, { type: "useItem", slot: 0 });
    expect(state.player.hp).toBe(state.player.maxHp);
  });

  it("the stim front-loads AP and bills it back next turn", () => {
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "stim", count: 1 };
    const state = makeState({ hotbar });
    applyAction(state, { type: "useItem", slot: 0 });
    // 3 AP, minus 1 to jab, plus 3 from the stim.
    expect(state.player.ap).toBe(state.player.maxAp - ITEMS.stim.apUse + 3);
    // One wait ends the turn and refills; the drain is billed at that refill.
    applyAction(state, { type: "wait" });
    expect(state.player.ap).toBe(state.player.maxAp - ITEMS.stim.effect.comedown);
  });

  it("schematics reveal the layout but not what is standing on it", () => {
    // A wall down the middle, so half the floor is genuinely unseen.
    const map = openMap(12, 12);
    for (let y = 1; y < 11; y++) setWall(map, 6, y);
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "schematics", count: 1 };
    const state = makeState({ map, hotbar, enemies: [makeEnemy({ x: 9, y: 5 })] });
    const unseenFloorsBefore = state.map.tiles.filter((t, i) => t === 1 && !state.explored[i]).length;
    expect(unseenFloorsBefore).toBeGreaterThan(0);
    applyAction(state, { type: "useItem", slot: 0 });
    // Every walkable tile is now on the map. (FOV also explores walls adjacent
    // to what you have seen, so the totals never match the floor count.)
    expect(state.map.tiles.every((t, i) => t !== 1 || state.explored[i])).toBe(true);
    expect(state.enemies.every((e) => !state.visible[e.y * state.map.width + e.x])).toBe(true);
  });
});

describe("dropping", () => {
  it("puts a hotbar item on the ground for 1 AP", () => {
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "snack", count: 2 };
    const state = makeState({ hotbar });
    applyAction(state, { type: "drop", kind: "item", slot: 0 });
    expect(state.hotbar[0]).toEqual({ itemId: "snack", count: 1 });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ kind: "consumable", itemId: "snack" });
    expect(state.player.ap).toBe(state.player.maxAp - AP_COSTS.drop);
  });

  it("empties the hand when the active weapon is dropped", () => {
    const state = makeState();
    applyAction(state, { type: "drop", kind: "weapon", slot: 0 });
    expect(state.player.weaponId).toBeNull();
    expect(state.player.slots?.[0]).toBeNull();
    expect(state.items[0]).toMatchObject({ kind: "weapon", weaponId: "glock" });
  });

  it("scatters rather than stacking — one item per tile stays law", () => {
    const hotbar = EMPTY();
    hotbar[0] = { itemId: "snack", count: 3 };
    const state = makeState({ hotbar });
    applyAction(state, { type: "drop", kind: "item", slot: 0 });
    applyAction(state, { type: "drop", kind: "item", slot: 0 });
    applyAction(state, { type: "drop", kind: "item", slot: 0 });
    const tiles = new Set(state.items.map((i) => `${i.x},${i.y}`));
    expect(state.items).toHaveLength(3);
    expect(tiles.size).toBe(3);
  });

  it("is free on an empty slot", () => {
    const state = makeState();
    applyAction(state, { type: "drop", kind: "item", slot: 4 });
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.log.at(-1)).toContain("empty");
  });
});

describe("item data integrity", () => {
  it("every effect maps to a known one-touchpoint mechanism", () => {
    // Deliberately a closed list: a new kind should fail here and be added on
    // purpose, which is what keeps this from drifting into a status framework.
    const allowed = new Set(["heal", "healFull", "stim", "reveal", "throw"]);
    for (const id of Object.keys(ITEMS)) {
      expect(allowed, `${id} introduced a new effect kind`).toContain(itemDef(id).effect.kind);
    }
  });

  it("prices healing by AP, not by HP — the cheap heals are the weak ones", () => {
    expect(ITEMS.snack.apUse).toBeLessThan(ITEMS.bandage.apUse);
    expect(ITEMS.medshot.apUse).toBeLessThan(ITEMS.medkit.apUse);
    // The 1-AP mid-fight heal must not also be the biggest one.
    expect(ITEMS.medshot.effect).toMatchObject({ kind: "heal" });
  });
});
