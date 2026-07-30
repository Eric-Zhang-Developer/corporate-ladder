import { RNG } from "rot-js";

/**
 * Seeded RNG for combat rolls and AI tie-breaks. A separate stream from map
 * generation, so adding sim rolls never reshuffles map layouts for a seed.
 * The state snapshot lives inside GameState, which keeps runs replayable
 * across save/load.
 */
export interface SimRNG {
  /** Uniform [0, 1). */
  next(): number;
  getState(): number[];
}

export function createSimRng(seed: number): SimRNG {
  const r = RNG.clone();
  r.setSeed(seed);
  return wrap(r);
}

export function simRngFromState(stateSnapshot: number[]): SimRNG {
  const r = RNG.clone();
  r.setState(stateSnapshot);
  return wrap(r);
}

function wrap(r: ReturnType<typeof RNG.clone>): SimRNG {
  return {
    next: () => r.getUniform(),
    getState: () => [...r.getState()],
  };
}
