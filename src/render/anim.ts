/**
 * Pure event→animation mapping: SimEvent[] in, a timed frame plan out — the
 * staggered playback that makes each enemy visibly make its move instead of
 * the whole round teleporting in one repaint. No DOM, no canvas, no timers:
 * scheduling lives in render/playback.ts, drawing in tiles.ts. Tested in
 * test/render/anim.test.ts.
 *
 * The plan is a replay, never authority. The sim has already resolved before
 * the first frame plays; frames only reposition sprites and add transient
 * markers, so dropping the plan (skip, restart) always lands on true state.
 */

import type { SimEvent } from "../sim/events";
import { idx, type GameState } from "../sim/state";

/** ms per micro-event beat — sfx fans cues ~100 ms apart in the same sim order, so shots land on their muzzle flashes. */
export const BEAT_MS = 100;
/** Extra gap between one enemy's move and the next, so authorship reads. */
export const SEAM_MS = 200;
/** Ceiling on a whole round's playback; busy floors compress to fit. */
export const CAP_MS = 1200;

export interface AnimFlash {
  style: "muzzle" | "impact";
  x: number;
  y: number;
}

export interface AnimBlast {
  x: number;
  y: number;
  radius: number;
}

/** An entity already removed from state (killed, or a drone that traded itself) still drawn mid-replay. */
export interface AnimGhost {
  defId: string;
  x: number;
  y: number;
}

/**
 * One playback frame: a full snapshot, not a delta, so the scheduler stays a
 * dumb timer. The vocabulary is deliberately closed (positions, ghosts,
 * flashes, blasts, hidden) — a new visual means widening this type and its
 * tests, a decision rather than a drift.
 */
export interface AnimFrame {
  at: number;
  /** Where to draw living enemies this frame, overriding their (final) state position. */
  positions: Array<{ id: number; x: number; y: number }>;
  ghosts: AnimGhost[];
  flashes: AnimFlash[];
  blasts: AnimBlast[];
  /** Living enemies not to draw yet — stealthers before their reveal beat. */
  hidden: number[];
}

type BeatRole = "advance" | "attach" | "ignore";

/**
 * How each event kind occupies playback time: "advance" opens a new beat,
 * "attach" rides the current one (a consequence shares its cause's frame),
 * "ignore" is invisible to animation (sound or log may still carry it).
 * Total over SimEvent["kind"] on purpose — a new event kind fails typecheck
 * here until someone classifies it, the same tripwire discipline as sfx.
 */
export const BEAT_ROLE: Record<SimEvent["kind"], BeatRole> = {
  shot: "advance",
  melee: "advance",
  step: "advance",
  reload: "advance",
  spot: "advance",
  telegraph: "advance",
  alarmWave: "advance",
  duelistPlate: "advance",
  duelistStim: "advance",
  blast: "advance",
  boltCycle: "attach",
  plateHit: "attach",
  hurt: "attach",
  kill: "attach",
  death: "attach",
  drop: "attach",
  dryClick: "ignore",
  throw: "ignore",
  pickup: "ignore",
  plateSlot: "ignore",
  swap: "ignore",
  useItem: "ignore",
  purchase: "ignore",
  promote: "ignore",
  perkPick: "ignore",
  shopEnter: "ignore",
  floorStart: "ignore",
  win: "ignore",
};

/** The position the event pins its ACTOR to, where the event knows it. Melee is excluded: its x,y is the victim. */
function actorPosOf(e: SimEvent): { id: number; x: number; y: number } | null {
  switch (e.kind) {
    case "step":
      return { id: e.by, x: e.fromX, y: e.fromY };
    case "shot":
    case "boltCycle":
    case "reload":
    case "spot":
    case "telegraph":
    case "duelistPlate":
    case "duelistStim":
      return { id: e.by, x: e.x, y: e.y };
    default:
      return null;
  }
}

export function buildAnimPlan(events: SimEvent[], state: GameState): AnimFrame[] {
  if (events.length === 0) return [];
  const playerId = state.player.id;
  const lit = (x: number, y: number): boolean => state.visible[idx(state.map, x, y)] === true;
  const living = new Set(state.enemies.map((e) => e.id));
  const stillHidden = new Set(state.enemies.filter((e) => e.hidden).map((e) => e.id));

  // Off-screen activity earns no beats — dead air reads as lag, not drama.
  const eventVisible = (e: SimEvent): boolean => {
    switch (e.kind) {
      case "step":
        return lit(e.fromX, e.fromY) || lit(e.x, e.y);
      case "shot":
        return lit(e.x, e.y) || lit(e.tx, e.ty);
      case "melee":
      case "reload":
      case "spot":
      case "telegraph":
      case "alarmWave":
      case "duelistPlate":
      case "duelistStim":
      case "blast":
        return lit(e.x, e.y);
      default:
        return false;
    }
  };

  // Attribute every event to an actor: `by` sets it, consequence events
  // (hurt, kill, blast…) inherit their cause's. The player's own action
  // events lead the stream and all land on the instant frame.
  let actor: number | "player" = "player";
  const tagged = events.map((e) => {
    if ("by" in e) actor = e.by === playerId ? "player" : e.by;
    return { e, actor };
  });

  // Stealth: motion before the reveal telegraph must not animate — one tile
  // of surprise is the enemy's whole design, and a replay that traces the
  // approach would sell it out. Still-hidden actors never animate at all.
  const revealIdx = new Map<number, number>();
  tagged.forEach(({ e }, i) => {
    if (e.kind === "telegraph" && e.style === "reveal" && !revealIdx.has(e.by)) revealIdx.set(e.by, i);
  });
  const suppressed = tagged.map(({ actor: a }, i) => {
    if (typeof a !== "number") return false;
    if (stillHidden.has(a)) return true;
    const reveal = revealIdx.get(a);
    return reveal !== undefined && i < reveal;
  });

  // Beat assignment. Time only moves forward: player events sit at 0, each
  // visible enemy "advance" opens a beat, a new enemy's first beat pays the
  // seam, and attach/suppressed/off-screen events ride the current time.
  let t = 0;
  let anyBeats = false;
  let current: number | "player" = "player";
  let groupHasBeat = false;
  const times = tagged.map(({ e, actor: a }, i) => {
    if (a !== current) {
      current = a;
      groupHasBeat = false;
    }
    if (a === "player") return 0;
    if (!suppressed[i] && BEAT_ROLE[e.kind] === "advance" && eventVisible(e)) {
      t += groupHasBeat ? BEAT_MS : anyBeats ? SEAM_MS + BEAT_MS : BEAT_MS;
      groupHasBeat = true;
      anyBeats = true;
    }
    return t;
  });
  if (t > CAP_MS) {
    const scale = CAP_MS / t;
    for (let i = 0; i < times.length; i++) times[i] = Math.round(times[i]! * scale);
  }

  // Starting positions for everything the replay moves or resurrects, plus
  // the defId a ghost is drawn with. Suppressed events don't seed — a
  // revealed stealther's timeline begins at its reveal tile.
  const startPos = new Map<number, { x: number; y: number }>();
  const defIds = new Map<number, string>();
  tagged.forEach(({ e }, i) => {
    if (suppressed[i]) return;
    const p = actorPosOf(e);
    if (p && p.id !== playerId && !startPos.has(p.id)) startPos.set(p.id, { x: p.x, y: p.y });
    if ((e.kind === "step" || e.kind === "spot" || e.kind === "telegraph") && !defIds.has(e.by)) {
      defIds.set(e.by, e.defId);
    }
    if (e.kind === "kill" && e.target !== playerId) {
      if (!startPos.has(e.target)) startPos.set(e.target, { x: e.x, y: e.y });
      defIds.set(e.target, e.defId);
    }
  });

  // A ghost lingers until its kill event lands, or — for the self-removing
  // drone — through the last event of its own move.
  const gone = new Map<number, number>();
  tagged.forEach(({ actor: a }, i) => {
    if (typeof a === "number" && !living.has(a)) gone.set(a, times[i]!);
  });
  tagged.forEach(({ e }, i) => {
    if (e.kind === "kill" && e.target !== playerId) gone.set(e.target, times[i]!);
  });

  // Assemble frames: walk events in time order (times are non-decreasing),
  // mutate the running position map, snapshot at every distinct time. Frame
  // 0 always exists so movers are pinned to their start before the first beat.
  const frameTimes = [...new Set([0, ...times])].sort((a, b) => a - b);
  const pos = new Map(startPos);
  const frames: AnimFrame[] = [];
  let ei = 0;
  for (const ft of frameTimes) {
    const flashes: AnimFlash[] = [];
    const blasts: AnimBlast[] = [];
    while (ei < tagged.length && times[ei]! <= ft) {
      const { e } = tagged[ei]!;
      if (!suppressed[ei]) {
        if (e.kind === "step") pos.set(e.by, { x: e.x, y: e.y });
        switch (e.kind) {
          case "shot":
            if (lit(e.x, e.y)) flashes.push({ style: "muzzle", x: e.x, y: e.y });
            if (e.hits > 0 && lit(e.tx, e.ty)) flashes.push({ style: "impact", x: e.tx, y: e.ty });
            break;
          case "melee":
            if (lit(e.x, e.y)) flashes.push({ style: "impact", x: e.x, y: e.y });
            break;
          case "blast":
            if (lit(e.x, e.y)) blasts.push({ x: e.x, y: e.y, radius: e.radius });
            break;
        }
      }
      ei++;
    }
    const positions: AnimFrame["positions"] = [];
    const ghosts: AnimGhost[] = [];
    for (const [id, p] of pos) {
      if (living.has(id)) {
        positions.push({ id, x: p.x, y: p.y });
      } else {
        const defId = defIds.get(id);
        if (defId !== undefined && ft <= (gone.get(id) ?? -1)) ghosts.push({ defId, x: p.x, y: p.y });
      }
    }
    const hidden = [...revealIdx]
      .filter(([id, i]) => living.has(id) && ft < times[i]!)
      .map(([id]) => id);
    frames.push({ at: ft, positions, ghosts, flashes, blasts, hidden });
  }

  // A plan that never repositions, flashes, or hides anything is a plain
  // instant action — return nothing so the caller schedules nothing.
  const meaningful =
    frames.length > 1 ||
    frames.some((f) => f.flashes.length > 0 || f.blasts.length > 0 || f.ghosts.length > 0);
  return meaningful ? frames : [];
}
