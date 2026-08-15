/**
 * The animation scheduler: fires the pure plan from render/anim.ts on
 * timers, nothing else. Impure by nature and untested by convention — the
 * discipline that keeps it forgettable is that it makes NO decisions; if a
 * conditional wants to live here, it belongs in the mapper instead. The
 * pattern (and the reason to trust it) is render/audio.ts.
 */

import type { AnimFrame } from "./anim";

/** Lets the final beat linger before the settle-to-state repaint. */
const SETTLE_MS = 120;

let timers: Array<ReturnType<typeof setTimeout>> = [];
let settle: (() => void) | null = null;

/**
 * Stop playback and repaint true state (apply(null)). Safe to call when idle.
 * Returns whether a playback was actually interrupted.
 */
export function cancelPlayback(): boolean {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  if (!settle) return false;
  const done = settle;
  settle = null;
  done();
  return true;
}

/**
 * Play a plan: apply frame 0 synchronously (so the caller's own render draws
 * the pinned start, never the teleported end), schedule the rest, settle to
 * state after the last beat. Any prior playback is cancelled first.
 */
export function startPlayback(frames: AnimFrame[], apply: (frame: AnimFrame | null) => void): void {
  cancelPlayback();
  if (frames.length === 0) return;
  settle = () => apply(null);
  for (const frame of frames) {
    if (frame.at <= 0) apply(frame);
    else timers.push(setTimeout(() => apply(frame), frame.at));
  }
  timers.push(setTimeout(() => cancelPlayback(), frames[frames.length - 1]!.at + SETTLE_MS));
}
