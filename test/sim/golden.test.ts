import { describe, expect, it } from "vitest";
import type { Action } from "../../src/sim/actions";
import { applyAction } from "../../src/sim/step";
import { newGame } from "../../src/sim/state";

/**
 * Replay canary: a fixed seed plus a fixed action script must always
 * produce the same state. If this snapshot changes unintentionally, sim
 * determinism (and with it saves, replays, and seed-sharing) broke.
 */
describe("golden run", () => {
  it("seed 1 with a scripted turn sequence reproduces the same state", () => {
    const state = newGame(1);
    const script: Action[] = [
      { type: "move", dx: 1, dy: 0 },
      { type: "move", dx: 1, dy: 0 },
      { type: "move", dx: 0, dy: 1 },
      { type: "fire" },
      { type: "reload" },
      { type: "wait" },
      { type: "move", dx: 0, dy: -1 },
      { type: "move", dx: -1, dy: 0 },
      { type: "fire" },
      { type: "wait" },
      { type: "wait" },
      { type: "wait" },
    ];
    for (const action of script) {
      if (state.phase !== "playing") break;
      applyAction(state, action);
    }

    const summary = {
      turn: state.turn,
      phase: state.phase,
      player: {
        x: state.player.x,
        y: state.player.y,
        hp: state.player.hp,
        ap: state.player.ap,
        ammoInMag: state.player.ammoInMag,
      },
      enemies: state.enemies.map((e) => ({ x: e.x, y: e.y, hp: e.hp, alerted: e.alerted })),
      rngState: state.rngState,
      log: state.log,
    };
    expect(summary).toMatchSnapshot();
  });
});
