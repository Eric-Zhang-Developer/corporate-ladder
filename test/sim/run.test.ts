import { describe, expect, it } from "vitest";
import { runBot } from "./bot";

/**
 * The full-run smoke test: drive the whole loop across seeds and assert the
 * state invariants after every single action. This is the canary for crashes,
 * soft-locks, and serialization drift that unit tests on hand-built states
 * cannot see.
 */
const SEEDS = [1, 88412, 7];

describe("full run (bot harness)", () => {
  for (const seed of SEEDS) {
    it(`reaches a legible outcome on seed ${seed}`, () => {
      const run = runBot(seed);
      // "stalled" means the bot ran out of ideas with the game still going —
      // usually an unreachable goal or a soft-lock, both real bugs.
      expect(run.outcome, `seed ${seed} stalled after ${run.actions} actions`).not.toBe("stalled");
      expect(run.actions).toBeGreaterThan(0);
      if (run.outcome === "dead") expect(run.killedBy).toBeTruthy();
    });
  }

  it("is deterministic — the same seed replays identically", () => {
    const a = runBot(88412, { check: false });
    const b = runBot(88412, { check: false });
    expect(a.outcome).toBe(b.outcome);
    expect(a.actions).toBe(b.actions);
    expect(a.state).toEqual(b.state);
  });
});
