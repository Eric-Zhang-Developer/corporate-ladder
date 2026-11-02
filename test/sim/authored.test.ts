import { describe, expect, it } from "vitest";
import { FLOORS, LAST_FLOOR, ORIENTATION_FLOOR, floorDef } from "../../src/data/floors";
import { buildAuthored, buildFloor, newGame } from "../../src/sim/floor";
import { idx, isFloor, type GameState } from "../../src/sim/state";
import { applyAction } from "../../src/sim/step";
import { assertStateInvariants } from "./invariants";

const ROOM = ["#####", "#@r>#", "#.a.#", "#####"];

describe("buildAuthored", () => {
  it("reads walls, floor, the entrance and the stairs from the rows", () => {
    const build = buildAuthored({ rows: ["#####", "#@.>#", "#####"] }, 1);
    expect(build.map).toMatchObject({ width: 5, height: 3 });
    expect(build.entrance).toEqual({ x: 1, y: 1 });
    expect(build.stairs).toEqual({ x: 3, y: 1 });
    expect(build.map.tiles.filter((t) => t === 1)).toHaveLength(3);
  });

  it("stands legend entries on floor tiles, numbering them from startId", () => {
    const build = buildAuthored(
      {
        rows: ROOM,
        legend: {
          r: { enemy: "rentacop" },
          a: { item: { kind: "ammo", caliber: "pistol", amount: 8 } },
        },
      },
      40,
    );
    expect(build.enemies).toMatchObject([{ id: 40, defId: "rentacop", x: 2, y: 1 }]);
    expect(build.items).toEqual([{ id: 41, x: 2, y: 2, kind: "ammo", caliber: "pistol", amount: 8 }]);
    expect(build.nextId).toBe(42);
    expect(build.map.tiles[idx(build.map, 2, 1)]).toBe(1);
    expect(build.map.tiles[idx(build.map, 2, 2)]).toBe(1);
  });

  it("refuses a malformed layout instead of guessing", () => {
    expect(() => buildAuthored({ rows: ["####", "#@>"] }, 1)).toThrow(/not 4 wide/);
    expect(() => buildAuthored({ rows: ["#@>z#"] }, 1)).toThrow(/no legend entry/);
    expect(() => buildAuthored({ rows: ["#@.#"] }, 1)).toThrow(/both @ and >/);
    expect(() => buildAuthored({ rows: ["#.>#"] }, 1)).toThrow(/both @ and >/);
  });
});

describe("orientation", () => {
  /** Walk to the stairs one move at a time, like a player would. */
  function climb(state: GameState): void {
    const { x: goalX, y: goalY } = state.stairs;
    while (state.player.x !== goalX || state.player.y !== goalY) {
      const dx = Math.sign(goalX - state.player.x) as -1 | 0 | 1;
      const dy = Math.sign(goalY - state.player.y) as -1 | 0 | 1;
      applyAction(state, dx !== 0 ? { type: "move", dx, dy: 0 } : { type: "move", dx: 0, dy });
    }
    applyAction(state, { type: "ascend" });
  }

  it("sits outside the tower's floor table and count", () => {
    expect(floorDef(ORIENTATION_FLOOR).layout).toBeDefined();
    expect(FLOORS.some((f) => f.depth === ORIENTATION_FLOOR)).toBe(false);
    expect(FLOORS).toHaveLength(LAST_FLOOR);
  });

  it("is the same floor on every seed", () => {
    const a = buildFloor(1, ORIENTATION_FLOOR, 1, ["pistol"]);
    const b = buildFloor(999_999, ORIENTATION_FLOOR, 1, ["shell"]);
    expect(a).toEqual(b);
  });

  it("starts a playable, serializable run, and a normal run is unchanged", () => {
    const state = newGame(7, ORIENTATION_FLOOR);
    expect(state.floor).toBe(ORIENTATION_FLOOR);
    expect(state.phase).toBe("playing");
    expect(isFloor(state.map, state.player.x, state.player.y)).toBe(true);
    assertStateInvariants(state, "orientation");
    expect(newGame(7).floor).toBe(1);
  });

  it("consumes no sim RNG building its floor", () => {
    expect(newGame(7, ORIENTATION_FLOOR).rngState).toEqual(newGame(7).rngState);
  });

  it("reaches the shop by the stairs, and leaving ends the run instead of climbing", () => {
    const state = newGame(7, ORIENTATION_FLOOR);
    climb(state);
    expect(state.phase).toBe("shopping");

    const events = applyAction(state, { type: "leaveShop" });
    expect(state.phase).toBe("won");
    expect(state.floor).toBe(ORIENTATION_FLOOR);
    expect(state.shop).toBeUndefined();
    expect(events.map((e) => e.kind)).toContain("win");
    assertStateInvariants(state, "orientation end");
  });
});
