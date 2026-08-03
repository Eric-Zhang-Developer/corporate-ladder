import { describe, expect, it } from "vitest";
import { HOTBAR_SLOTS, ITEMS } from "../../src/data/items";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState, openMap, setWall } from "./helpers";

const EMPTY = () => new Array(HOTBAR_SLOTS).fill(null);

function withGrenade(itemId: string, opts: Parameters<typeof makeState>[0] = {}) {
  const hotbar = EMPTY();
  hotbar[0] = { itemId, count: 2 };
  return makeState({ ...opts, hotbar });
}

describe("throwing", () => {
  it("spends the AP and one grenade, and damages everything in the radius", () => {
    const a = makeEnemy({ x: 6, y: 2, hp: 30 });
    const b = makeEnemy({ x: 6, y: 3, hp: 30 });
    const far = makeEnemy({ x: 6, y: 8, hp: 30 });
    const state = withGrenade("frag", { map: openMap(14, 14), enemies: [a, b, far] });
    applyAction(state, { type: "throwItem", slot: 0, x: 6, y: 2 });
    expect(a.hp).toBe(21);
    expect(b.hp).toBe(21); // radius 1 catches the neighbour
    expect(far.hp).toBe(30);
    expect(state.hotbar[0]).toEqual({ itemId: "frag", count: 1 });
    expect(state.player.ap).toBe(state.player.maxAp - ITEMS.frag.apUse);
  });

  it("refuses out-of-range, through-wall and into-wall throws for free", () => {
    const map = openMap(20, 14);
    for (let y = 1; y < 13; y++) setWall(map, 5, y);
    const state = withGrenade("frag", { map });
    const ap = state.player.ap;

    applyAction(state, { type: "throwItem", slot: 0, x: 15, y: 2 });
    expect(state.log.at(-1)).toContain("out of throwing range");

    applyAction(state, { type: "throwItem", slot: 0, x: 5, y: 2 });
    expect(state.log.at(-1)).toContain("cannot throw into a wall");

    applyAction(state, { type: "throwItem", slot: 0, x: 6, y: 2 });
    expect(state.log.at(-1)).toContain("no line to throw");

    expect(state.player.ap).toBe(ap);
    expect(state.hotbar[0]).toEqual({ itemId: "frag", count: 2 });
  });

  it("a frag catches the thrower too — throwing it at your feet is a real mistake", () => {
    const state = withGrenade("frag", { map: openMap(14, 14) });
    applyAction(state, { type: "throwItem", slot: 0, x: state.player.x + 1, y: state.player.y });
    expect(state.player.hp).toBeLessThan(state.player.maxHp);
  });
});

describe("the stun rules", () => {
  it("a flashbang steals exactly one turn and deals no damage", () => {
    const cop = makeEnemy({ x: 5, y: 2, hp: 30 });
    const state = withGrenade("flashbang", { map: openMap(14, 14), enemies: [cop] });
    applyAction(state, { type: "throwItem", slot: 0, x: 5, y: 2 });
    expect(cop.hp).toBe(30);
    expect(cop.pendingApDrain).toBe(cop.maxAp);

    applyAction(state, { type: "wait" }); // refill bills the drain
    expect(cop.ap).toBe(0); // its turn does not happen
    applyAction(state, { type: "wait" }); // and the turn after
    expect(cop.ap).toBe(cop.maxAp); // ...it is back. One turn, never two.
  });

  it("is player-safe: you were trained for this during onboarding", () => {
    const state = withGrenade("flashbang", { map: openMap(14, 14) });
    applyAction(state, { type: "throwItem", slot: 0, x: state.player.x + 1, y: state.player.y });
    expect(state.player.pendingApDrain).toBeUndefined();
  });

  it("does nothing to machines — they have no eyes to take away", () => {
    const camera = makeEnemy({ defId: "camera", x: 5, y: 2, hp: 30, weaponId: null as never });
    const state = withGrenade("flashbang", { map: openMap(14, 14), enemies: [camera] });
    applyAction(state, { type: "throwItem", slot: 0, x: 5, y: 2 });
    expect(camera.pendingApDrain).toBeUndefined();
  });
});

describe("the organics / machines split", () => {
  it("an EMP hits machines and ignores the human standing beside them", () => {
    const camera = makeEnemy({ defId: "camera", x: 5, y: 2, hp: 30, weaponId: null as never });
    const cop = makeEnemy({ x: 5, y: 3, hp: 30 });
    const state = withGrenade("emp", { map: openMap(14, 14), enemies: [camera, cop] });
    applyAction(state, { type: "throwItem", slot: 0, x: 5, y: 2 });
    expect(camera.hp).toBe(18);
    expect(camera.pendingApDrain).toBe(camera.maxAp);
    expect(cop.hp).toBe(30);
    expect(cop.pendingApDrain).toBeUndefined();
  });

  it("and never touches the player, who is not a machine", () => {
    const state = withGrenade("emp", { map: openMap(14, 14) });
    applyAction(state, { type: "throwItem", slot: 0, x: state.player.x + 1, y: state.player.y });
    expect(state.player.hp).toBe(state.player.maxHp);
  });
});

describe("grenade taxonomy", () => {
  it("each answers a different half of the bestiary", () => {
    const frag = ITEMS.frag.effect;
    const flash = ITEMS.flashbang.effect;
    const emp = ITEMS.emp.effect;
    expect(frag).toMatchObject({ kind: "throw", damage: expect.any(Number) });
    expect(frag).not.toHaveProperty("targets"); // everyone
    expect(flash).toMatchObject({ targets: "organics", stun: true });
    expect(flash).not.toHaveProperty("damage"); // the item IS the stolen turn
    expect(emp).toMatchObject({ targets: "machines", stun: true });
  });
});
