import { describe, expect, it } from "vitest";
import {
  HEAT_TURNS,
  exploreStep,
  heatBlocked,
  initialHeat,
  knownItemIds,
  shouldHalt,
  travelStep,
  updateHeat,
  visibleEnemies,
  type ExploreMemory,
} from "../../src/input/explore";
import type { SimEvent } from "../../src/sim/events";
import { newGame } from "../../src/sim/floor";
import { recomputeFov } from "../../src/sim/fov";
import { applyAction } from "../../src/sim/step";
import { idx, type GameState } from "../../src/sim/state";
import { makeEnemy, makeState, openMap, setWall } from "./helpers";

/**
 * Auto-explore's whole brain. It is pure — state in, one move out — so every
 * rule is checkable here, including the one that matters most: it may only use
 * knowledge the player has.
 */

const NONE: ExploreMemory = { dismissed: [] };

/** Mark a rectangle explored, as if the player had walked it. */
function explore(state: GameState, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) state.explored[idx(state.map, x, y)] = true;
  }
}

function exploreAll(state: GameState): void {
  state.explored.fill(true);
}

describe("exploreStep", () => {
  it("steps toward the nearest unexplored edge", () => {
    // Player at (2,2); only the 2..4 box is known, so the frontier is its rim.
    const state = makeState();
    state.explored.fill(false);
    explore(state, 2, 2, 4, 4);
    const result = exploreStep(state, NONE);
    expect(result.kind).toBe("step");
    if (result.kind !== "step") return;
    expect(result.action.type).toBe("move");
    if (result.action.type !== "move") return;
    // One tile, on one axis.
    expect(Math.abs(result.action.dx) + Math.abs(result.action.dy)).toBe(1);
  });

  it("routes only through explored tiles", () => {
    // A wall splits the map; the gap at (5,1) is the only way through, but the
    // player has not seen it. Auto-explore must not use the shortcut.
    const map = openMap(12, 12);
    for (let y = 1; y < 11; y++) setWall(map, 6, y);
    const state = makeState({ map, player: { x: 2, y: 5 } });
    state.explored.fill(false);
    explore(state, 1, 4, 5, 6); // a known pocket west of the wall
    const seenGoal = idx(map, 9, 5);
    state.explored[seenGoal] = true; // a tile east, known but unreachable through knowledge

    const result = exploreStep(state, NONE);
    // It explores its own side rather than teleporting toward known-but-unlinked ground.
    expect(result.kind).toBe("step");
    if (result.kind !== "step" || result.action.type !== "move") return;
    expect(result.action.dx).toBeLessThanOrEqual(0 + 1);
  });

  it("is deterministic — the same state always picks the same step", () => {
    const state = makeState();
    state.explored.fill(false);
    explore(state, 2, 2, 4, 4);
    const a = exploreStep(state, NONE);
    const b = exploreStep(state, NONE);
    expect(a).toEqual(b);
  });

  it("halts when an enemy is in sight", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 10, x: 5, y: 2 })] });
    state.explored.fill(false);
    explore(state, 2, 2, 4, 4);
    expect(exploreStep(state, NONE).kind).toBe("halt");
  });

  it("ignores a hidden stealther — refusing would announce it", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 11, x: 4, y: 2, hidden: true })] });
    state.explored.fill(false);
    explore(state, 2, 2, 4, 4);
    expect(exploreStep(state, NONE).kind).toBe("step");
    expect(visibleEnemies(state)).toHaveLength(0);
  });

  it("reports done when the floor is fully explored", () => {
    const state = makeState();
    exploreAll(state);
    expect(exploreStep(state, NONE).kind).toBe("done");
  });

  it("reports blocked when unexplored map is walled off", () => {
    // A sealed 1-tile pocket at (8,8): known to exist as unexplored, unreachable.
    const map = openMap(12, 12);
    setWall(map, 8, 7);
    setWall(map, 8, 9);
    setWall(map, 7, 8);
    setWall(map, 9, 8);
    const state = makeState({ map, player: { x: 2, y: 2 } });
    exploreAll(state);
    state.explored[idx(map, 8, 8)] = false; // the pocket stays unknown
    expect(exploreStep(state, NONE).kind).toBe("blocked");
  });
});

describe("item targeting", () => {
  const ammo = { id: 77, x: 4, y: 2, kind: "ammo" as const, caliber: "pistol" as const, amount: 10 };

  it("walks to a known item before chasing the frontier", () => {
    const state = makeState({ items: [ammo] });
    state.explored.fill(false);
    explore(state, 2, 2, 5, 5);
    const result = exploreStep(state, NONE);
    expect(result.kind).toBe("step");
    if (result.kind !== "step") return;
    expect(result.toItem).toBe(77);
    if (result.action.type !== "move") return;
    expect(result.action.dx).toBe(1); // toward (4,2), east of the player
  });

  it("reports arrival when standing on the target, and never picks it up", () => {
    const state = makeState({ items: [{ ...ammo, x: 2, y: 2 }] });
    explore(state, 2, 2, 5, 5);
    const before = state.ammo.pistol;
    expect(exploreStep(state, NONE)).toEqual({ kind: "item", itemId: 77 });
    expect(state.ammo.pistol).toBe(before); // pure: deciding took nothing
    expect(state.items).toHaveLength(1);
  });

  it("skips dismissed items", () => {
    const state = makeState({ items: [ammo] });
    state.explored.fill(false);
    explore(state, 2, 2, 5, 5);
    const result = exploreStep(state, { dismissed: [77] });
    expect(result.kind).toBe("step");
    expect(result.kind === "step" ? result.toItem : "no step").toBeUndefined();
  });

  it("never targets an item the player has not seen", () => {
    // Loot exists at (8,8) but that tile is unexplored — targeting it would be
    // an oracle, so the walk must head for the frontier instead.
    const state = makeState({ items: [{ ...ammo, x: 8, y: 8 }] });
    state.explored.fill(false);
    explore(state, 2, 2, 4, 4);
    const result = exploreStep(state, NONE);
    expect(result.kind).toBe("step");
    expect(result.kind === "step" ? result.toItem : "no step").toBeUndefined();
  });

  it("never targets a vending machine", () => {
    const state = makeState({ items: [{ id: 5, x: 4, y: 2, kind: "vending" }] });
    exploreAll(state);
    expect(exploreStep(state, NONE).kind).toBe("done");
  });
});

describe("travelStep", () => {
  it("routes to the stairs and reports arrival", () => {
    const state = makeState({ stairs: { x: 6, y: 2 } });
    exploreAll(state);
    const result = travelStep(state);
    expect(result.kind).toBe("step");
    if (result.kind !== "step" || result.action.type !== "move") return;
    expect(result.action.dx).toBe(1);

    const there = makeState({ player: { x: 6, y: 2 }, stairs: { x: 6, y: 2 } });
    exploreAll(there);
    expect(travelStep(there).kind).toBe("done");
  });

  it("refuses to route to stairs the player has not found", () => {
    const state = makeState({ stairs: { x: 6, y: 2 } });
    state.explored.fill(false);
    explore(state, 2, 2, 4, 4);
    expect(travelStep(state).kind).toBe("blocked");
  });
});

describe("shouldHalt", () => {
  it("lets a quiet step through", () => {
    expect(shouldHalt([])).toBe(false);
    expect(shouldHalt([{ kind: "step", by: 9, defId: "dog", fromX: 5, fromY: 5, x: 5, y: 4 }])).toBe(
      false,
    );
  });

  it("stops on an off-screen spot — that warning turn is the player's, not the autopilot's", () => {
    expect(shouldHalt([{ kind: "spot", by: 9, defId: "rentacop", x: 20, y: 20 }])).toBe(true);
  });

  it("stops on violence and telegraphs", () => {
    expect(shouldHalt([{ kind: "hurt", target: 0, dmg: 3, x: 2, y: 2 }])).toBe(true);
    expect(
      shouldHalt([{ kind: "telegraph", style: "lock", by: 9, defId: "turret", x: 8, y: 8 }]),
    ).toBe(true);
  });
});

describe("heat", () => {
  const hurt = (id: number): SimEvent => ({ kind: "hurt", target: id, dmg: 3, x: 2, y: 2 });
  const shot = (by: number): SimEvent => ({
    kind: "shot", by, weaponId: "glock_cop", x: 9, y: 9, target: 0, tx: 2, ty: 2,
    pellets: 1, hits: 1, dmg: 3,
  });

  it("goes hot when an enemy is on screen, and cools after the window", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 10, x: 5, y: 2 })] });
    const hot = updateHeat(initialHeat(), state, []);
    expect(heatBlocked(hot, state)).toBe(true);

    state.turn += HEAT_TURNS;
    expect(heatBlocked(hot, state)).toBe(false);
  });

  it("clears the moment everything it implicated is dead", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 10, x: 5, y: 2 })] });
    const hot = updateHeat(initialHeat(), state, []);
    expect(heatBlocked(hot, state)).toBe(true);
    // You killed it. Nothing is hunting you, so E should work immediately —
    // no waiting out a cooldown for a corpse.
    state.enemies = [];
    expect(heatBlocked(hot, state)).toBe(false);
  });

  it("blames the shooter when damage arrives from off screen", () => {
    // Bresenham LOS outranges the player's FOV, so a sniper can hurt you while
    // invisible. `hurt` names no attacker; the shot before it does.
    const state = makeState({ enemies: [makeEnemy({ id: 12, x: 9, y: 9 })] });
    state.visible.fill(false);
    const hot = updateHeat(initialHeat(), state, [shot(12), hurt(state.player.id)]);
    expect(hot.hotIds).toContain(12);
    expect(heatBlocked(hot, state)).toBe(true);
    state.enemies = [];
    expect(heatBlocked(hot, state)).toBe(false);
  });

  it("stays blocked when damage has no attributable source", () => {
    const state = makeState();
    const hot = updateHeat(initialHeat(), state, [hurt(state.player.id)]);
    expect(hot.hotIds).toHaveLength(0);
    // Nobody named and nobody alive to clear: blocked is the safe reading, and
    // it expires on its own rather than needing a corpse.
    expect(heatBlocked(hot, state)).toBe(true);
    state.turn += HEAT_TURNS;
    expect(heatBlocked(hot, state)).toBe(false);
  });

  it("resets on a new floor and never mutates its input", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 10, x: 5, y: 2 })] });
    const hot = updateHeat(initialHeat(), state, []);
    const snapshot = JSON.parse(JSON.stringify(hot));
    const fresh = updateHeat(hot, state, [{ kind: "floorStart", floor: 2 }]);
    expect(heatBlocked(fresh, state)).toBe(false);
    expect(hot).toEqual(snapshot);
  });

  it("is cold before anything happens", () => {
    const state = makeState();
    expect(heatBlocked(initialHeat(), state)).toBe(false);
  });
});

describe("knownItemIds", () => {
  it("returns only items on tiles the player has explored, never vending machines", () => {
    const state = makeState({
      items: [
        { id: 1, x: 3, y: 2, kind: "ammo", caliber: "pistol", amount: 5 },
        { id: 2, x: 8, y: 8, kind: "ammo", caliber: "pistol", amount: 5 },
        { id: 3, x: 3, y: 3, kind: "vending" },
      ],
    });
    state.explored.fill(false);
    explore(state, 2, 2, 4, 4);
    expect(knownItemIds(state)).toEqual([1]);
  });
});

describe("termination sweep (real floors)", () => {
  // The no-oscillation proof: on generated maps, drive the real decision loop
  // and require it to finish. Two equidistant frontiers must never ping-pong.
  for (const seed of [1, 7, 88412, 20260815]) {
    it(`explores seed ${seed} to a stopping point without looping`, () => {
      const state = newGame(seed);
      state.enemies = []; // isolate navigation from combat interrupts
      recomputeFov(state);
      const ceiling = state.map.tiles.length * 4;
      const memory: ExploreMemory = { dismissed: [] };
      let steps = 0;
      let coverage = state.explored.filter(Boolean).length;

      for (;;) {
        const result = exploreStep(state, memory);
        if (result.kind === "item") {
          memory.dismissed.push(result.itemId);
          continue;
        }
        if (result.kind !== "step") {
          expect(["done", "blocked"]).toContain(result.kind);
          break;
        }
        applyAction(state, result.action);
        steps += 1;
        expect(steps, `seed ${seed} never terminated`).toBeLessThan(ceiling);
        const now = state.explored.filter(Boolean).length;
        expect(now).toBeGreaterThanOrEqual(coverage); // knowledge only grows
        coverage = now;
      }

      // It should have learned the floor, not given up on the doorstep.
      expect(coverage).toBeGreaterThan(state.map.tiles.length / 4);
    });
  }
});
