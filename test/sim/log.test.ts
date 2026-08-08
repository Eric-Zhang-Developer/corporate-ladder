import { describe, expect, it } from "vitest";
import { newGame } from "../../src/sim/floor";
import { pushLog } from "../../src/sim/state";
import { makeState } from "./helpers";

/**
 * `log` is a rolling window spliced from the front, so array indices are not
 * stable identities across turns. `logSeq` is the stable one: total lines ever
 * pushed. The renderer appends rather than rewrites and derives "what arrived
 * since my last frame" from it, so the counter drifting from the window — in
 * either direction — silently desyncs the log panel.
 */
describe("logSeq", () => {
  it("counts every push", () => {
    const state = makeState();
    expect(state.logSeq).toBe(0);
    pushLog(state, "one");
    pushLog(state, "two");
    expect(state.logSeq).toBe(2);
    expect(state.log).toEqual(["one", "two"]);
  });

  it("keeps climbing across the window trim", () => {
    const state = makeState();
    for (let i = 0; i < 100; i++) pushLog(state, `line ${i}`);
    // The window caps out; the counter does not.
    expect(state.log.length).toBeLessThan(100);
    expect(state.logSeq).toBe(100);
    // The window is always the tail of everything pushed.
    expect(state.log[state.log.length - 1]).toBe("line 99");
  });

  it("is never below the window it describes", () => {
    const state = makeState();
    for (let i = 0; i < 60; i++) {
      pushLog(state, `line ${i}`);
      expect(state.logSeq).toBeGreaterThanOrEqual(state.log.length);
    }
  });

  it("agrees with the window on a fresh game", () => {
    const state = newGame(1);
    expect(state.logSeq).toBe(state.log.length);
  });

  it("survives a JSON round-trip (invariant 2)", () => {
    const state = makeState();
    pushLog(state, "one");
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
