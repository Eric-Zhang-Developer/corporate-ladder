import { AP_COSTS } from "../data/costs";
import type { Action } from "./actions";
import { recomputeFov } from "./fov";
import { simRngFromState, type SimRNG } from "./rng";
import { entityAt, isFloor, pushLog, type GameState } from "./state";

/**
 * The whole game advances through this single entry point. A player turn is
 * a budget of AP spent across several actions; when it runs out (or the
 * player waits), every enemy takes its full turn, then AP refills.
 */
export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase !== "playing") return state;
  const rng = simRngFromState(state.rngState);

  handlePlayerAction(state, rng, action);

  if (state.phase === "playing" && state.player.ap <= 0) {
    runEnemyTurns(state, rng);
    state.turn += 1;
    state.player.ap = state.player.maxAp;
    for (const e of state.enemies) e.ap = e.maxAp;
  }

  recomputeFov(state);
  state.rngState = rng.getState();
  return state;
}

function handlePlayerAction(state: GameState, _rng: SimRNG, action: Action): void {
  const player = state.player;
  switch (action.type) {
    case "move": {
      const nx = player.x + action.dx;
      const ny = player.y + action.dy;
      // Invalid moves cost nothing — never charge AP for a typo.
      if (!isFloor(state.map, nx, ny)) {
        pushLog(state, "You bump into the wall.");
        return;
      }
      const blocker = entityAt(state, nx, ny);
      if (blocker && blocker.id !== player.id) {
        pushLog(state, `The ${blocker.name} is in the way.`);
        return;
      }
      player.x = nx;
      player.y = ny;
      player.ap -= AP_COSTS.move;
      return;
    }
    case "wait": {
      player.ap = 0;
      return;
    }
  }
}

function runEnemyTurns(state: GameState, _rng: SimRNG): void {
  // Stage 1 M1.3 fills this in; the turn structure is already final.
  for (const _enemy of state.enemies) {
    if (state.phase !== "playing") return;
  }
}
