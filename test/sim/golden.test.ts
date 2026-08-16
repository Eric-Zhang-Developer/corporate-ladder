import { describe, expect, it } from "vitest";
import type { Action } from "../../src/sim/actions";
import { newGame } from "../../src/sim/floor";
import { applyAction } from "../../src/sim/step";
import type { GameState } from "../../src/sim/state";
import { runBot } from "./bot";

/**
 * Replay canary: a fixed seed plus a fixed action script must always produce
 * the same state. If a snapshot here changes unintentionally, sim determinism
 * broke — and with it saves, replays, and seed-sharing.
 *
 * Two snapshots, because they fail for different reasons and that distinction
 * is the diagnostic:
 *   1. The scripted opening pins map generation, movement, FOV, and the
 *      typo-rule bails. It is short and hand-readable, so a break points at a
 *      specific action.
 *   2. The bot run pins everything the script cannot reach without knowing the
 *      map: to-hit rolls, per-pellet damage, drops, pickups, enemy turns, and
 *      the RNG call *order* across a real fight. Regenerate deliberately.
 */
function summarize(state: GameState) {
  return {
    turn: state.turn,
    floor: state.floor,
    phase: state.phase,
    player: {
      x: state.player.x,
      y: state.player.y,
      hp: state.player.hp,
      shield: state.player.shield ?? 0,
      ap: state.player.ap,
      ammoInMag: state.player.ammoInMag,
    },
    ammo: state.ammo,
    xp: state.xp,
    level: state.level,
    perks: state.perks,
    carrierId: state.carrierId,
    spareplates: state.spareplates,
    hotbar: state.hotbar,
    itemCount: state.items.length,
    enemies: state.enemies.map((e) => ({
      defId: e.defId,
      x: e.x,
      y: e.y,
      hp: e.hp,
      alerted: e.alerted,
    })),
    rngState: state.rngState,
    log: state.log,
  };
}

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
    expect(summarize(state)).toMatchSnapshot();
  });

  it("a scripted combat run reproduces the same fight", () => {
    // A fixed action budget rather than a full run: it keeps the snapshot
    // mid-fight, where enemies are alive and the log still shows the shots.
    const run = runBot(7, { maxActions: 150, check: false });
    expect(run.state.turn).toBeGreaterThan(10);
    expect(run.state.log.join(" ")).toMatch(/hit|spray|miss|collapses/);
    // The budget is chosen to run past the first promotion, so the snapshot
    // covers levelling, perk choice and the item economy rather than only guns.
    expect(run.state.level).toBeGreaterThan(1);
    expect(summarize(run.state)).toMatchSnapshot();
  });
});
