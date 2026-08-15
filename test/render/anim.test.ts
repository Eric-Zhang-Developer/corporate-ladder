import { describe, expect, it } from "vitest";
import type { SimEvent } from "../../src/sim/events";
import { BEAT_MS, CAP_MS, SEAM_MS, buildAnimPlan } from "../../src/render/anim";
import { runBot } from "../sim/bot";
import { makeEnemy, makeState } from "../sim/helpers";

/**
 * The pure half of turn playback: event → timed frame plan. The scheduler
 * (render/playback.ts) stays untested by convention, like audio.ts.
 *
 * Geometry note: makeState puts the player at (2,2) on an open 10×10 map
 * with FOV radius 8, so every coordinate used here is visible unless a test
 * blacks the map out on purpose.
 */

const step = (by: number, from: [number, number], to: [number, number], defId = "rentacop"): SimEvent => ({
  kind: "step", by, defId, fromX: from[0], fromY: from[1], x: to[0], y: to[1],
});

const shot = (by: number, at: [number, number], target: [number, number], hits = 1): SimEvent => ({
  kind: "shot", by, weaponId: "glock_cop", x: at[0], y: at[1], target: 0,
  tx: target[0], ty: target[1], pellets: 1, hits, dmg: hits * 2,
});

describe("buildAnimPlan", () => {
  it("returns nothing for instant player actions", () => {
    const state = makeState();
    expect(buildAnimPlan([], state)).toEqual([]);
    expect(buildAnimPlan([{ kind: "pickup", what: "ammo" }], state)).toEqual([]);
  });

  it("flashes the player's own shot on the instant frame", () => {
    const state = makeState();
    const plan = buildAnimPlan([shot(state.player.id, [2, 2], [5, 2])], state);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.at).toBe(0);
    expect(plan[0]!.flashes).toEqual([
      { style: "muzzle", x: 2, y: 2 },
      { style: "impact", x: 5, y: 2 },
    ]);
    // A wide shot flashes the muzzle but never a phantom impact.
    const wide = buildAnimPlan([shot(state.player.id, [2, 2], [5, 2], 0)], state);
    expect(wide[0]!.flashes).toEqual([{ style: "muzzle", x: 2, y: 2 }]);
  });

  it("gives each enemy its own beats, with a seam between movers", () => {
    const state = makeState({
      enemies: [makeEnemy({ id: 10, x: 3, y: 2 }), makeEnemy({ id: 11, x: 5, y: 3 })],
    });
    const plan = buildAnimPlan(
      [step(10, [5, 2], [4, 2]), step(10, [4, 2], [3, 2]), step(11, [5, 4], [5, 3])],
      state,
    );
    expect(plan.map((f) => f.at)).toEqual([0, BEAT_MS, 2 * BEAT_MS, 2 * BEAT_MS + SEAM_MS + BEAT_MS]);
    // Frame 0 pins every mover to where its turn began — never the end state.
    expect(plan[0]!.positions).toEqual([
      { id: 10, x: 5, y: 2 },
      { id: 11, x: 5, y: 4 },
    ]);
    // Mid-replay, the first mover advances while the second still waits.
    expect(plan[1]!.positions).toContainEqual({ id: 10, x: 4, y: 2 });
    expect(plan[1]!.positions).toContainEqual({ id: 11, x: 5, y: 4 });
    expect(plan[3]!.positions).toContainEqual({ id: 11, x: 5, y: 3 });
  });

  it("consequence events ride their cause's beat", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 10, x: 5, y: 2 })] });
    const plan = buildAnimPlan(
      [shot(10, [5, 2], [2, 2]), { kind: "hurt", target: state.player.id, dmg: 2, x: 2, y: 2 }],
      state,
    );
    expect(plan.map((f) => f.at)).toEqual([0, BEAT_MS]);
    expect(plan[1]!.flashes).toEqual([
      { style: "muzzle", x: 5, y: 2 },
      { style: "impact", x: 2, y: 2 },
    ]);
  });

  it("off-screen activity earns no beats and no plan", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 10, x: 3, y: 2 })] });
    state.visible.fill(false);
    expect(buildAnimPlan([step(10, [5, 2], [4, 2]), step(10, [4, 2], [3, 2])], state)).toEqual([]);
  });

  it("compresses a busy round under the cap", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 10, x: 5, y: 2 })] });
    const events: SimEvent[] = [];
    for (let i = 0; i < 20; i++) {
      events.push(step(10, [5 + (i % 2), 2], [5 + ((i + 1) % 2), 2]));
    }
    const plan = buildAnimPlan(events, state);
    const last = plan[plan.length - 1]!;
    expect(last.at).toBeLessThanOrEqual(CAP_MS);
    expect(last.at).toBeGreaterThan(0);
    for (let i = 1; i < plan.length; i++) expect(plan[i]!.at).toBeGreaterThan(plan[i - 1]!.at);
  });

  it("keeps the removed on stage as ghosts until their death beat", () => {
    // A drone (never in end-state: it traded itself) dives and detonates,
    // then a living enemy moves. The ghost must survive through the blast
    // beat and be gone by the next mover's.
    const state = makeState({ enemies: [makeEnemy({ id: 11, x: 7, y: 5 })] });
    const plan = buildAnimPlan(
      [
        step(50, [5, 2], [4, 2], "drone"),
        { kind: "telegraph", style: "dive", by: 50, defId: "drone", x: 4, y: 2 },
        { kind: "blast", x: 4, y: 2, radius: 1 },
        step(11, [7, 6], [7, 5]),
      ],
      state,
    );
    const blastFrame = plan.find((f) => f.blasts.length > 0)!;
    expect(blastFrame.ghosts).toEqual([{ defId: "drone", x: 4, y: 2 }]);
    const after = plan[plan.length - 1]!;
    expect(after.at).toBeGreaterThan(blastFrame.at);
    expect(after.ghosts).toEqual([]);
    expect(after.positions).toContainEqual({ id: 11, x: 7, y: 5 });
  });

  it("shows a kill's victim until the kill lands", () => {
    // Enemy 12 died this round (absent from end state); its kill event seeds
    // both position and glyph, so the corpse-to-be is visible at frame 0.
    const state = makeState({ enemies: [] });
    const plan = buildAnimPlan(
      [
        { kind: "blast", x: 5, y: 5, radius: 1 },
        { kind: "kill", target: 12, defId: "rentacop", x: 5, y: 4, xp: 2 },
      ],
      state,
    );
    expect(plan[0]!.ghosts).toEqual([{ defId: "rentacop", x: 5, y: 4 }]);
  });

  it("suppresses a stealther's approach before its reveal", () => {
    // Revealed this round: hidden is already gone from state, but the replay
    // must not trace the camouflaged approach — the reveal IS the fight.
    const state = makeState({ enemies: [makeEnemy({ id: 12, x: 4, y: 4, defId: "wraith" })] });
    const plan = buildAnimPlan(
      [
        step(12, [6, 6], [5, 5], "wraith"),
        step(12, [5, 5], [4, 4], "wraith"),
        { kind: "telegraph", style: "reveal", by: 12, defId: "wraith", x: 4, y: 4 },
      ],
      state,
    );
    expect(plan.map((f) => f.at)).toEqual([0, BEAT_MS]); // steps bought no beats
    expect(plan[0]!.hidden).toEqual([12]); // not drawn until the reveal beat
    // Its timeline begins at the reveal tile — the approach path never leaks.
    expect(plan[0]!.positions).toEqual([{ id: 12, x: 4, y: 4 }]);
    expect(plan[1]!.hidden).toEqual([]);
    expect(plan[1]!.positions).toEqual([{ id: 12, x: 4, y: 4 }]);
  });

  it("animates nothing for a stealther still hidden at round end", () => {
    const state = makeState({ enemies: [makeEnemy({ id: 13, x: 5, y: 5, hidden: true })] });
    expect(buildAnimPlan([step(13, [7, 7], [6, 6]), step(13, [6, 6], [5, 5])], state)).toEqual([]);
  });
});

describe("real event streams (bot harness)", () => {
  // Hand-built streams can't cover every emission pattern the sim produces;
  // whole bot runs can. Every action's diary must map to a well-formed plan:
  // strictly increasing frame times, capped, integer tiles, no throw.
  for (const seed of [1, 7]) {
    it(`every action of seed ${seed} builds a well-formed plan`, () => {
      runBot(seed, {
        check: false,
        onAction: (state, _action, events) => {
          const plan = buildAnimPlan(events, state);
          let prev = -1;
          for (const frame of plan) {
            expect(frame.at).toBeGreaterThan(prev);
            expect(frame.at).toBeLessThanOrEqual(CAP_MS);
            prev = frame.at;
            for (const p of [...frame.positions, ...frame.ghosts, ...frame.flashes]) {
              expect(Number.isInteger(p.x)).toBe(true);
              expect(Number.isInteger(p.y)).toBe(true);
            }
          }
        },
      });
    });
  }
});
