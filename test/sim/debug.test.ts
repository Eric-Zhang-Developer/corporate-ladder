import { describe, expect, it } from "vitest";
import { xpForLevel } from "../../src/data/perks";
import { WEAPONS } from "../../src/data/weapons";
import type { DebugOp } from "../../src/sim/debug";
import { newGame } from "../../src/sim/floor";
import { idx, type GameState } from "../../src/sim/state";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState, openMap } from "./helpers";
import { assertStateInvariants } from "./invariants";

/** Every debug op goes through the real entry point, like any other action. */
function debug(state: GameState, op: DebugOp) {
  const events = applyAction(state, { type: "debug", op });
  assertStateInvariants(state, op.kind);
  return events;
}

describe("debug actions", () => {
  it("never spends AP or advances the turn", () => {
    const state = makeState({ enemies: [makeEnemy({ x: 6, y: 6, alerted: true })] });
    const before = { turn: state.turn, ap: state.player.ap, x: state.enemies[0]!.x };

    debug(state, { kind: "cash", amount: 100 });
    debug(state, { kind: "xp", amount: 10 });
    debug(state, { kind: "heal" });

    expect(state.turn).toBe(before.turn);
    expect(state.player.ap).toBe(before.ap);
    // The enemy phase never ran, so nothing moved.
    expect(state.enemies[0]!.x).toBe(before.x);
  });

  it("leaves rngState untouched when the op consumes no randomness", () => {
    const state = makeState();
    const before = [...state.rngState];
    debug(state, { kind: "cash", amount: 500 });
    expect(state.rngState).toEqual(before);
  });

  it("works while dead, and warping is the way back", () => {
    const state = makeState();
    state.phase = "dead";
    state.killedBy = "shot by a Rent-a-Cop";

    debug(state, { kind: "warp", floor: 5 });

    expect(state.phase).toBe("playing");
    expect(state.killedBy).toBeUndefined();
    expect(state.floor).toBe(5);
  });

  describe("warp", () => {
    it("builds a real floor and puts the player on its entrance", () => {
      const state = newGame(4242);
      debug(state, { kind: "warp", floor: 6 });

      expect(state.floor).toBe(6);
      expect(state.player.x).toBe(state.entrance.x);
      expect(state.player.y).toBe(state.entrance.y);
      expect(state.enemies.length).toBeGreaterThan(0);
      // FOV was recomputed for the new map, not carried over from the old one.
      expect(state.visible[idx(state.map, state.player.x, state.player.y)]).toBe(true);
      expect(state.player.ap).toBe(state.player.maxAp);
    });

    it("reproduces the same floor the honest route would have generated", () => {
      const warped = newGame(99);
      debug(warped, { kind: "warp", floor: 3 });
      const honest = newGame(99);
      debug(honest, { kind: "warp", floor: 3 });

      expect(warped.map.tiles).toEqual(honest.map.tiles);
      expect(warped.enemies.map((e) => [e.defId, e.x, e.y])).toEqual(
        honest.enemies.map((e) => [e.defId, e.x, e.y]),
      );
    });

    it("clamps out-of-range floors instead of generating nonsense", () => {
      const state = newGame(7);
      debug(state, { kind: "warp", floor: 99 });
      expect(state.floor).toBe(8);
      debug(state, { kind: "warp", floor: -3 });
      expect(state.floor).toBe(1);
    });

    it("escapes the shop phase", () => {
      const state = newGame(11);
      state.phase = "shopping";
      state.shop = { entries: [], sold: [] };

      debug(state, { kind: "warp", floor: 2 });

      expect(state.phase).toBe("playing");
      expect(state.shop).toBeUndefined();
    });
  });

  describe("spawn", () => {
    it("places the enemy on a free tile next to the player", () => {
      const state = makeState();
      debug(state, { kind: "spawn", defId: "exo" });

      expect(state.enemies).toHaveLength(1);
      const spawned = state.enemies[0]!;
      expect(spawned.defId).toBe("exo");
      expect(Math.hypot(spawned.x - state.player.x, spawned.y - state.player.y)).toBeLessThan(2);
      // Never on top of the player, and it took an id from the shared counter.
      expect([spawned.x, spawned.y]).not.toEqual([state.player.x, state.player.y]);
      expect(state.nextId).toBeGreaterThan(spawned.id);
    });

    it("spawns unalerted, so the player still gets the spot turn", () => {
      const state = makeState();
      debug(state, { kind: "spawn", defId: "rentacop" });
      expect(state.enemies[0]!.alerted).toBe(false);
    });

    it("does not stack two spawns on one tile", () => {
      const state = makeState();
      debug(state, { kind: "spawn", defId: "dog" });
      debug(state, { kind: "spawn", defId: "dog" });
      const [a, b] = state.enemies;
      expect([a!.x, a!.y]).not.toEqual([b!.x, b!.y]);
    });

    it("refuses a bad id rather than spawning a ghost", () => {
      const state = makeState();
      expect(() => debug(state, { kind: "spawn", defId: "middle_manager" })).toThrow();
      expect(state.enemies).toHaveLength(0);
    });

    it("reports when the player is walled in", () => {
      // A 3x3 map: the player's tile is the only floor there is.
      const map = openMap(3, 3);
      const state = makeState({ map, player: { x: 1, y: 1 } });
      debug(state, { kind: "spawn", defId: "dog" });
      expect(state.enemies).toHaveLength(0);
      expect(state.log.at(-1)).toContain("nowhere");
    });
  });

  describe("give", () => {
    it("drops the payload at the player's feet for the normal pickup path", () => {
      const state = makeState();
      debug(state, { kind: "give", payload: { kind: "ammo", caliber: "rifle", amount: 60 } });

      expect(state.items).toHaveLength(1);
      const item = state.items[0]!;
      expect(item).toMatchObject({ kind: "ammo", caliber: "rifle", amount: 60 });
      expect([item.x, item.y]).toEqual([state.player.x, state.player.y]);
      // The reserve itself is untouched — picking it up is what banks it.
      expect(state.ammo.rifle).toBe(0);
    });

    it("scatters rather than stacking, because one item per tile is law", () => {
      const state = makeState();
      debug(state, { kind: "give", payload: { kind: "plate" } });
      debug(state, {
        kind: "give",
        payload: { kind: "weapon", weaponId: "awp", ammoInMag: WEAPONS.awp.magSize },
      });

      expect(state.items).toHaveLength(2);
      expect([state.items[0]!.x, state.items[0]!.y]).not.toEqual([
        state.items[1]!.x,
        state.items[1]!.y,
      ]);
    });
  });

  describe("grants", () => {
    it("adds cash and never goes negative", () => {
      const state = makeState({ cash: 50 });
      debug(state, { kind: "cash", amount: 500 });
      expect(state.cash).toBe(550);
      debug(state, { kind: "cash", amount: -9999 });
      expect(state.cash).toBe(0);
    });

    it("grants xp without promoting mid-action, then promotes on the next turn", () => {
      const state = makeState();
      debug(state, { kind: "xp", amount: xpForLevel(2) });

      // Promotions are a between-turns event; the debug action is not a turn.
      expect(state.phase).toBe("playing");
      expect(state.level).toBe(1);

      applyAction(state, { type: "wait" });
      expect(state.level).toBe(2);
      expect(state.phase).toBe("promoting");
    });

    it("heals to full", () => {
      const state = makeState({ player: { hp: 2 } });
      debug(state, { kind: "heal" });
      expect(state.player.hp).toBe(state.player.maxHp);
    });
  });

  describe("god mode", () => {
    it("keeps the player alive while plates and events still behave", () => {
      const state = makeState({
        player: { hp: 4, shield: 2, x: 3, y: 3 },
        enemies: [makeEnemy({ x: 4, y: 3, alerted: true, ap: 9, maxAp: 9 })],
      });
      debug(state, { kind: "god", on: true });

      for (let i = 0; i < 6; i++) applyAction(state, { type: "wait" });

      expect(state.phase).toBe("playing");
      expect(state.player.hp).toBe(4);
      // Plates are still consumed — the fight you observe is the real one.
      expect(state.player.shield ?? 0).toBeLessThan(2);
    });

    it("toggles off by deleting the field", () => {
      const state = makeState();
      debug(state, { kind: "god", on: true });
      expect(state.god).toBe(true);
      debug(state, { kind: "god", on: false });
      expect("god" in state).toBe(false);
    });
  });

  describe("kill", () => {
    it("clears the floor without paying drops or XP", () => {
      const state = makeState({
        enemies: [makeEnemy({ x: 6, y: 6 }), makeEnemy({ x: 7, y: 6 }), makeEnemy({ x: 6, y: 7 })],
      });
      const events = debug(state, { kind: "kill" });

      expect(state.enemies).toHaveLength(0);
      expect(state.items).toHaveLength(0);
      expect(state.xp).toBe(0);
      expect(events.filter((e) => e.kind === "kill")).toHaveLength(3);
    });

    it("takes one by id", () => {
      const doomed = makeEnemy({ x: 6, y: 6 });
      const spared = makeEnemy({ x: 7, y: 6 });
      const state = makeState({ enemies: [doomed, spared] });

      debug(state, { kind: "kill", targetId: doomed.id });

      expect(state.enemies.map((e) => e.id)).toEqual([spared.id]);
    });
  });
});
