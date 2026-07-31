import { describe, expect, it } from "vitest";
import { ENEMIES, enemyDef } from "../../src/data/enemies";
import { FLOORS, LAST_FLOOR } from "../../src/data/floors";
import { buildFloor, newGame } from "../../src/sim/floor";
import { applyAction } from "../../src/sim/step";
import { idx } from "../../src/sim/state";

describe("buildFloor", () => {
  it("is deterministic: same (seed, floor) -> identical build", () => {
    const a = buildFloor(88412, 1, 100, ["pistol"]);
    const b = buildFloor(88412, 1, 100, ["pistol"]);
    expect(a).toEqual(b);
  });

  it("different floors of the same seed differ", () => {
    const a = buildFloor(88412, 1, 100, ["pistol"]);
    const b = buildFloor(88412, 2, 100, ["pistol"]);
    expect(a.map.tiles).not.toEqual(b.map.tiles);
  });

  it("places stairs away from the entrance, on floor", () => {
    for (const seed of [1, 7, 42]) {
      const build = buildFloor(seed, 1, 100, ["pistol"]);
      expect(build.map.tiles[idx(build.map, build.stairs.x, build.stairs.y)]).toBe(1);
      const d = Math.hypot(build.stairs.x - build.entrance.x, build.stairs.y - build.entrance.y);
      expect(d).toBeGreaterThan(5);
    }
  });

  it("spawns the configured number of encounter groups worth of enemies", () => {
    for (const seed of [1, 7, 42, 99]) {
      const build = buildFloor(seed, 1, 100, ["pistol"]);
      expect(build.enemies.length).toBeGreaterThanOrEqual(4);
      // groups of up to 2 + camera escorts: generous ceiling
      expect(build.enemies.length).toBeLessThanOrEqual(16);
      // no enemy in the entrance room's immediate vicinity
      for (const e of build.enemies) {
        const d = Math.hypot(e.x - build.entrance.x, e.y - build.entrance.y);
        expect(d).toBeGreaterThan(2);
      }
    }
  });

  it("always places a loot weapon and its ammo", () => {
    for (const seed of [1, 7, 42]) {
      const build = buildFloor(seed, 1, 100, ["pistol"]);
      const weapons = build.items.filter((i) => i.kind === "weapon");
      expect(weapons.length).toBeGreaterThanOrEqual(1);
      const piles = build.items.filter((i) => i.kind === "ammo");
      expect(piles.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("newGame is fully deterministic", () => {
    expect(newGame(5)).toEqual(newGame(5));
  });
});

const MELEE_BEHAVIORS = new Set(["meleeRush", "detonate"]);

describe("floor data (§2 pillar 3)", () => {
  it("keeps melee spawn weight between 28% and 45% on every floor", () => {
    for (const floor of FLOORS) {
      let melee = 0;
      let total = 0;
      for (const [id, w] of Object.entries(floor.weights)) {
        total += w;
        const def = enemyDef(id);
        // Anything that has to reach you is melee pressure, not just meleeRush:
        // the FPV drone closes and trades itself, which is the same job.
        if (MELEE_BEHAVIORS.has(def.behavior)) melee += w;
      }
      const fraction = melee / total;
      expect(fraction).toBeGreaterThanOrEqual(0.28);
      expect(fraction).toBeLessThanOrEqual(0.45);
    }
  });

  it("every weighted enemy id exists", () => {
    for (const floor of FLOORS) {
      for (const id of Object.keys(floor.weights)) {
        expect(ENEMIES).toHaveProperty(id);
      }
    }
  });
});

describe("ascend", () => {
  it("off-stairs ascend costs nothing", () => {
    const state = newGame(1);
    applyAction(state, { type: "ascend" });
    expect(state.player.ap).toBe(3);
    expect(state.floor).toBe(1);
    expect(state.log.at(-1)).toContain("No stairs");
  });

  it("on stairs: floor advances, player state persists, map regenerates", () => {
    const state = newGame(1);
    const beforeTiles = [...state.map.tiles];
    state.ammo.pistol = 11;
    state.player.hp = 6;
    // teleport onto the stairs (test-only nudge, sim rules still apply after)
    state.player.x = state.stairs.x;
    state.player.y = state.stairs.y;
    applyAction(state, { type: "ascend" });
    // Ascending now stops at the stairwell landing; leaving it builds the floor.
    expect(state.phase).toBe("shopping");
    applyAction(state, { type: "leaveShop" });
    expect(state.floor).toBe(2);
    expect(state.player.hp).toBe(6);
    expect(state.ammo.pistol).toBe(11);
    expect(state.map.tiles).not.toEqual(beforeTiles);
    expect(state.player.x).toBe(state.entrance.x);
    expect(state.phase).toBe("playing");
  });

  it("top-floor stairs win the slice", () => {
    const state = newGame(1);
    for (let f = state.floor; f < LAST_FLOOR; f++) {
      state.player.x = state.stairs.x;
      state.player.y = state.stairs.y;
      applyAction(state, { type: "ascend" });
      applyAction(state, { type: "leaveShop" });
    }
    state.player.x = state.stairs.x;
    state.player.y = state.stairs.y;
    applyAction(state, { type: "ascend" });
    expect(state.phase).toBe("won");
  });
});
