/**
 * The WebAudio player (docs/sound-design.md §7): fetches and decodes
 * public/sounds/*.wav lazily, plays named cues with per-play gain, and
 * schedules the mapper's staggered plan. Impure by nature and untested by
 * convention — everything decision-shaped lives in render/sfx.ts.
 */

import type { SimEvent } from "../sim/events";
import type { GameState } from "../sim/state";
import { planPlayback, soundsFor, type PlannedSound } from "./sfx";

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

const MUTE_KEY = "sfxMuted";
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode — the toggle still works for this session */
  }
  return muted;
}

/**
 * Browsers gate audio behind a user gesture; main.ts calls this from the
 * keydown handler, so the context exists by the time anything plays.
 */
export function unlockAudio(): void {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function bufferFor(name: string): Promise<AudioBuffer | null> {
  let pending = buffers.get(name);
  if (!pending) {
    // Document-relative, not root-absolute: the Pages deploy lives under a
    // project subpath (vite `base: "./"`), where "/sounds/…" 404s silently.
    pending = fetch(`sounds/${name}.wav`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.statusText))))
      .then((bytes) => ctx!.decodeAudioData(bytes))
      .catch(() => null); // missing file: silent, not fatal — the log still tells the story
    buffers.set(name, pending);
  }
  return pending;
}

export function playSound(name: string, gain = 1): void {
  if (muted || !ctx) return;
  void bufferFor(name).then((buffer) => {
    if (!buffer || !ctx || muted) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(level).connect(ctx.destination);
    source.start();
  });
}

export function playCues(plan: PlannedSound[]): void {
  for (const cue of plan) {
    if (cue.at <= 0) playSound(cue.name, cue.gain);
    else setTimeout(() => playSound(cue.name, cue.gain), cue.at);
  }
}

/** The one call main.ts makes per action: map the diary, play the plan. */
export function playEvents(events: SimEvent[], state: GameState): void {
  if (events.length === 0) return;
  playCues(planPlayback(soundsFor(events, state)));
}
