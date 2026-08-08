import { describe, expect, it } from "vitest";
import { fireWeapon } from "../../src/sim/combat";
import { drainEvents } from "../../src/sim/events";
import { createSimRng } from "../../src/sim/rng";
import { applyAction } from "../../src/sim/step";
import { assertSerializable } from "./invariants";
import { makeEnemy, makeState, openMap } from "./helpers";

/**
 * The event stream (sim/events.ts): applyAction's return value is the diary
 * of what happened. These tests pin the three properties consumers rely on —
 * order matches sim resolution order, identical runs produce identical
 * streams, and events hold to the same serialization discipline as state.
 */

describe("event stream", () => {
  it("a player shot emits one shot event with the gun and both positions", () => {
    const enemy = makeEnemy({ x: 3, y: 2 });
    const state = makeState({ enemies: [enemy] });
    const events = applyAction(state, { type: "fire" });
    const shots = events.filter((e) => e.kind === "shot");
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({
      by: state.player.id,
      weaponId: "glock",
      x: 2,
      y: 2,
      target: enemy.id,
      tx: 3,
      ty: 2,
      pellets: 1,
    });
  });

  it("a lethal shot reads shot → hurt → kill, in that order", () => {
    // Point blank at 1 hp: any landed pellet kills.
    const enemy = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = makeState({ enemies: [enemy], seed: 5 });
    // Burn actions until the kill lands (misses are possible); the order
    // property must hold on whichever action produces it.
    for (let i = 0; i < 20 && state.enemies.length > 0; i++) {
      state.player.ap = 3;
      state.player.ammoInMag = 7;
      const events = applyAction(state, { type: "fire" });
      const kinds = events.map((e) => e.kind);
      if (kinds.includes("kill")) {
        expect(kinds.indexOf("shot")).toBeLessThan(kinds.indexOf("hurt"));
        expect(kinds.indexOf("hurt")).toBeLessThan(kinds.indexOf("kill"));
        return;
      }
    }
    expect.unreachable("no kill in 20 shots at 1hp point blank");
  });

  it("enemy-turn events arrive in enemy array order", () => {
    const first = makeEnemy({ x: 4, y: 2 });
    const second = makeEnemy({ x: 6, y: 2 });
    const state = makeState({ enemies: [first, second] });
    const events = applyAction(state, { type: "wait" });
    // Every enemy-attributed event: the first enemy's block must be complete
    // before the second's begins — the ordering staggered playback needs.
    const byIds = events
      .map((e) => ("by" in e ? e.by : null))
      .filter((id): id is number => id === first.id || id === second.id);
    const lastOfFirst = byIds.lastIndexOf(first.id);
    const firstOfSecond = byIds.indexOf(second.id);
    expect(byIds.length).toBeGreaterThan(0);
    if (firstOfSecond !== -1 && lastOfFirst !== -1) {
      expect(lastOfFirst).toBeLessThan(firstOfSecond);
    }
  });

  it("identical states and actions produce identical streams", () => {
    // Ids pinned: makeEnemy's counter would otherwise differ between builds.
    const build = () =>
      makeState({
        enemies: [
          makeEnemy({ id: 101, x: 5, y: 2 }),
          makeEnemy({ id: 102, x: 2, y: 5, defId: "dog", name: "Guard Dog", weaponId: null, alerted: false }),
        ],
        seed: 9,
      });
    const a = build();
    const b = build();
    const script = [
      { type: "fire" } as const,
      { type: "move", dx: 1 as const, dy: 0 as const } as const,
      { type: "wait" } as const,
      { type: "fire" } as const,
      { type: "wait" } as const,
    ];
    const eventsA = script.flatMap((action) => applyAction(a, action));
    const eventsB = script.flatMap((action) => applyAction(b, action));
    expect(eventsA).toEqual(eventsB);
    expect(eventsA.length).toBeGreaterThan(0);
  });

  it("every event survives the serialization discipline", () => {
    const state = makeState({
      enemies: [makeEnemy({ x: 3, y: 2 }), makeEnemy({ x: 2, y: 4, alerted: false })],
      seed: 3,
    });
    const all: unknown[] = [];
    const script = [
      { type: "fire" } as const,
      { type: "reload" } as const,
      { type: "wait" } as const,
      { type: "move", dx: 0 as const, dy: 1 as const } as const,
      { type: "wait" } as const,
    ];
    for (const action of script) all.push(...applyAction(state, action));
    expect(all.length).toBeGreaterThan(0);
    for (const event of all) {
      assertSerializable(event, "event", (msg) => {
        throw new Error(msg);
      });
      expect(JSON.parse(JSON.stringify(event))).toEqual(event);
    }
  });

  it("direct combat calls outside applyAction stay inert and leak nothing", () => {
    const enemy = makeEnemy({ x: 3, y: 2 });
    const state = makeState({ enemies: [enemy] });
    const rng = createSimRng(1);
    // No beginEvents: emit() must no-op rather than accumulate.
    fireWeapon(state, rng, state.player, enemy);
    expect(drainEvents()).toEqual([]);
    // And the next applyAction's stream contains only its own events.
    state.player.ap = 3;
    const events = applyAction(state, { type: "reload" });
    expect(events.every((e) => e.kind !== "shot")).toBe(true);
  });

  it("phase-gated actions still produce their events", () => {
    const state = makeState({ xp: 999 });
    // Any AP-spending action triggers the promotion check between turns.
    const events = applyAction(state, { type: "wait" });
    expect(events.some((e) => e.kind === "promote")).toBe(true);
    expect(state.phase).toBe("promoting");
    const offer = state.perkOffer![0]!;
    const pick = applyAction(state, { type: "choosePerk", perkId: offer });
    expect(pick.some((e) => e.kind === "perkPick")).toBe(true);
  });
});
