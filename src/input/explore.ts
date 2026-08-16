/**
 * Auto-explore: state in, one move out. Pure and stateless by design — every
 * scrap of memory the loop needs is passed in, so the same inputs always give
 * the same decision. Tested in test/sim/explore.test.ts.
 *
 * It lives in input/ because that is exactly what it is: a second way to
 * produce an ordinary `move` Action, alongside the keymap. Auto-explore is
 * NOT a sim action — the sim only ever sees the moves it hands back, so
 * replays, determinism and serialization are untouched by the whole feature.
 *
 * The one rule the search must never break: it may only use knowledge the
 * PLAYER has. Routing runs over `explored` tiles and targets only items on
 * explored tiles, which makes the anti-oracle rule structural rather than a
 * comment — an auto-explore that paths around unseen dangers, or that walks
 * to loot nobody has seen, is a map hack wearing a convenience feature's hat.
 */

import type { Action } from "../sim/actions";
import type { SimEvent } from "../sim/events";
import { idx, inBounds, isFloor, type Entity, type GameState } from "../sim/state";

/** 4-neighbour order, fixed. Deterministic tie-breaking falls out of it. */
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** One tile of movement on an axis — the sim's move action takes exactly this. */
type Delta = -1 | 0 | 1;

export interface ExploreMemory {
  /**
   * Item ids never to target again: seeded with everything already visible
   * when the run starts (you have had your chance to decide about those), then
   * grown each time the walk delivers you to one.
   */
  dismissed: number[];
}

export type ExploreResult =
  /** Take this step. `toItem` is set while the walk is heading for loot. */
  | { kind: "step"; action: Action; toItem?: number }
  /** Standing on a targeted item. Stop; the player decides whether to take it. */
  | { kind: "item"; itemId: number }
  /** Nothing left worth walking to. */
  | { kind: "done" }
  /** Unexplored map remains, but no route reaches it. */
  | { kind: "blocked" }
  /** Something is on screen. Auto-explore never walks with company. */
  | { kind: "halt" };

/**
 * Enemies the player can actually see — deliberately the predicate the
 * RENDERER draws by (`render/tiles.ts`: lit tile, not hidden), NOT the one
 * Tab-targeting uses. Targeting adds `hasLos` because it answers "can I shoot
 * it"; this answers "is it on screen", and shadowcast FOV and Bresenham LOS
 * are deliberately separate (see AGENTS.md), so the two genuinely differ. An
 * autopilot that kept walking while a guard was painted on the player's screen
 * would be indefensible.
 *
 * Hidden units are excluded on purpose: a stealther you cannot see must not be
 * able to block auto-explore, or the refusal itself announces it.
 *
 * A new helper used only by new code — five other sites compute near-identical
 * predicates with subtle differences, and unifying the sim-side ones would move
 * the golden snapshot. See AGENTS.md's known debts.
 */
export function visibleEnemies(state: GameState): Entity[] {
  return state.enemies.filter(
    (e) => !e.hidden && state.visible[idx(state.map, e.x, e.y)] === true,
  );
}

/**
 * Which events end a run. Total over `SimEvent["kind"]` on purpose: a new event
 * kind fails typecheck here until someone decides whether an autopilot should
 * survive it — the same tripwire discipline as `BEAT_ROLE` in render/anim.ts.
 *
 * `step` is false because off-screen shuffling must not stop the walk, and a
 * visible mover is caught by the `visibleEnemies` check the caller runs anyway.
 * `spot` and the telegraphs are true even when their source is off screen: the
 * sim spends the spotter's whole turn on that warning (§ "one turn of warning"),
 * and an autopilot that walked through it would quietly delete the guarantee.
 */
export const HALT_ON: Record<SimEvent["kind"], boolean> = {
  shot: true,
  melee: true,
  hurt: true,
  kill: true,
  death: true,
  blast: true,
  plateHit: true,
  spot: true,
  telegraph: true,
  alarmWave: true,
  duelistPlate: true,
  duelistStim: true,
  boltCycle: false,
  dryClick: false,
  reload: false,
  drop: false,
  step: false,
  throw: false,
  pickup: false,
  plateSlot: false,
  swap: false,
  useItem: false,
  purchase: false,
  promote: false,
  perkPick: false,
  shopEnter: false,
  floorStart: false,
  win: false,
};

/** Did this step's diary contain anything an autopilot has no business walking through? */
export function shouldHalt(events: SimEvent[]): boolean {
  return events.some((e) => HALT_ON[e.kind]);
}

/** Turns of quiet required after a threat before auto-explore will start again. */
export const HEAT_TURNS = 3;

/**
 * "Something was just hunting you" — the guard that stops E from marching you
 * back into the dog that chased you round a corner. Built only from what was on
 * the player's screen (or hit them), never from `alerted`: reading the sim's
 * pursuit state for enemies you cannot see would make a refusal itself leak
 * their position.
 *
 * UI-side only. `GameState` carries no history, deliberately.
 */
export interface Heat {
  /** Turn a threat was last seen or felt. -Infinity when cold. */
  lastThreatTurn: number;
  /** Enemies implicated. Never pruned here — liveness is checked at the guard. */
  hotIds: number[];
}

export function initialHeat(): Heat {
  return { lastThreatTurn: -Infinity, hotIds: [] };
}

/**
 * Fold one action's outcome into the heat. Pure — returns a new Heat.
 * Called after EVERY action, manual or automatic, so pressing E is judged on
 * the whole fight and not just on the steps E itself took.
 */
export function updateHeat(heat: Heat, state: GameState, events: SimEvent[]): Heat {
  if (events.some((e) => e.kind === "floorStart")) return initialHeat();

  const ids = new Set(visibleEnemies(state).map((e) => e.id));
  // Attribute damage to whoever dealt it: `hurt` carries no attacker, and a
  // shooter outside the player's 8-tile FOV can still reach them (Bresenham LOS
  // is unbounded), so the shot/melee that preceded it is the only witness.
  for (const e of events) {
    if ((e.kind === "shot" || e.kind === "melee") && e.by !== state.player.id) ids.add(e.by);
  }
  const wasHurt = events.some((e) => e.kind === "hurt" && e.target === state.player.id);

  if (ids.size > 0 || wasHurt) {
    return { lastThreatTurn: state.turn, hotIds: [...new Set([...heat.hotIds, ...ids])] };
  }
  // Window expired with nothing new: forget the whole episode.
  if (state.turn - heat.lastThreatTurn >= HEAT_TURNS) return initialHeat();
  return heat;
}

/** Is the player still too hot to hand the controls over? */
export function heatBlocked(heat: Heat, state: GameState): boolean {
  if (state.turn - heat.lastThreatTurn >= HEAT_TURNS) return false;
  // Everything implicated is dead: you won the fight, so the heat is over —
  // checked against the live roster rather than tracked through kill events,
  // which makes it self-healing (ids are never reused).
  const living = new Set(state.enemies.map((e) => e.id));
  if (heat.hotIds.length > 0 && !heat.hotIds.some((id) => living.has(id))) return false;
  // Hot with nobody named: something hit the player from somewhere unseen.
  // Blocked is the safe reading, and it expires on its own in HEAT_TURNS.
  return true;
}

/**
 * Items the player already knows about. Seeding a run's ignore list with these
 * is what makes "only stop for what you find along the way" fall out: loot you
 * had already seen and walked past is loot you have decided about.
 */
export function knownItemIds(state: GameState): number[] {
  return state.items
    .filter((i) => i.kind !== "vending" && state.explored[idx(state.map, i.x, i.y)] === true)
    .map((i) => i.id);
}

/** Items the player knows about and might still want to be walked to. */
function targetableItems(state: GameState, dismissed: Set<number>): Map<number, number> {
  const byTile = new Map<number, number>();
  for (const item of state.items) {
    // Vending machines are furniture, not loot: never picked up, never removed,
    // so targeting one would park the walk on it every single run.
    if (item.kind === "vending") continue;
    if (dismissed.has(item.id)) continue;
    const i = idx(state.map, item.x, item.y);
    // Knowledge gate: state.items holds loot the player has never laid eyes on.
    if (state.explored[i] !== true) continue;
    if (!byTile.has(i)) byTile.set(i, item.id);
  }
  return byTile;
}

/** An explored floor tile with an unexplored neighbour — the edge of the map you know. */
function isFrontier(state: GameState, x: number, y: number): boolean {
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(state.map, nx, ny)) continue;
    if (state.explored[idx(state.map, nx, ny)] !== true) return true;
  }
  return false;
}

/**
 * One BFS answers everything: nearest reachable target, and the first step
 * toward it via a parent chain. Traversal is restricted to explored floor,
 * which is what keeps the router honest.
 *
 * `goals` decides what we are looking for. The first goal BFS pops wins, and
 * because BFS pops in non-decreasing distance order that is the nearest one,
 * with ties broken by DIRS order — deterministic, no sort, no RNG.
 *
 * `arriveOnStart` is the difference between a destination and a direction.
 * Standing on the item you were walking to means you have arrived; standing on
 * a frontier tile means nothing, because the way onward is the tiles you
 * cannot legally route into yet — so a frontier search must look past its own
 * feet or auto-explore would call itself finished on the first step.
 */
function search(
  state: GameState,
  goals: (i: number, x: number, y: number) => boolean,
  arriveOnStart = true,
): { first: { dx: Delta; dy: Delta }; goal: number } | null {
  const { map, player } = state;
  const start = idx(map, player.x, player.y);
  const parent = new Int32Array(map.tiles.length).fill(-1);
  const seen = new Uint8Array(map.tiles.length);
  seen[start] = 1;

  if (arriveOnStart && goals(start, player.x, player.y)) {
    return { first: { dx: 0, dy: 0 }, goal: start };
  }

  // Tiles held by enemies you can see are walls for routing purposes. Hidden
  // units are NOT avoided: steering around one would leak its position, and
  // bumping it is a melee attack whose events stop the loop anyway.
  const blocked = new Set(visibleEnemies(state).map((e) => idx(map, e.x, e.y)));

  const queue: number[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    const ax = at % map.width;
    const ay = (at - ax) / map.width;
    for (const [dx, dy] of DIRS) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (!inBounds(map, nx, ny)) continue;
      const ni = idx(map, nx, ny);
      if (seen[ni]) continue;
      seen[ni] = 1;
      // Only known-walkable ground: unexplored tiles are not knowledge.
      if (!isFloor(map, nx, ny) || state.explored[ni] !== true) continue;
      if (blocked.has(ni)) continue;
      parent[ni] = at;
      if (goals(ni, nx, ny)) {
        // Walk the chain back to the tile adjacent to the player.
        let step = ni;
        while (parent[step] !== start && parent[step] !== -1) step = parent[step]!;
        const sx = step % map.width;
        const sy = (step - sx) / map.width;
        // The chain stops on a tile adjacent to the player, so each sign is one step.
        const dx = Math.sign(sx - player.x) as Delta;
        const dy = Math.sign(sy - player.y) as Delta;
        return { first: { dx, dy }, goal: ni };
      }
      queue.push(ni);
    }
  }
  return null;
}

/** Is there anything left on this floor the player has not seen? */
function hasUnexplored(state: GameState): boolean {
  const { map } = state;
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== 0 && state.explored[i] !== true) return true;
  }
  return false;
}

/**
 * The next auto-explore decision: walk to known loot first, then to the
 * nearest edge of the known map.
 */
export function exploreStep(state: GameState, memory: ExploreMemory): ExploreResult {
  if (visibleEnemies(state).length > 0) return { kind: "halt" };

  const dismissed = new Set(memory.dismissed);
  const items = targetableItems(state, dismissed);
  if (items.size > 0) {
    const found = search(state, (i) => items.has(i));
    if (found) {
      const itemId = items.get(found.goal)!;
      if (found.first.dx === 0 && found.first.dy === 0) return { kind: "item", itemId };
      return { kind: "step", action: moveTo(found.first), toItem: itemId };
    }
  }

  const found = search(state, (_i, x, y) => isFrontier(state, x, y), false);
  if (found) return { kind: "step", action: moveTo(found.first) };
  return hasUnexplored(state) ? { kind: "blocked" } : { kind: "done" };
}

/**
 * Travel to the stairwell — the verb the floor asks for once there is nothing
 * left to find. It stops ON the stairs; taking them stays a deliberate
 * keystroke, because leaving a floor is irreversible in a permadeath run.
 */
export function travelStep(state: GameState): ExploreResult {
  if (visibleEnemies(state).length > 0) return { kind: "halt" };
  const { map, stairs } = state;
  const goal = idx(map, stairs.x, stairs.y);
  // The stairs are only a destination once the player has found them.
  if (state.explored[goal] !== true) return { kind: "blocked" };
  const found = search(state, (i) => i === goal);
  if (!found) return { kind: "blocked" };
  if (found.first.dx === 0 && found.first.dy === 0) return { kind: "done" };
  return { kind: "step", action: moveTo(found.first) };
}

function moveTo(step: { dx: Delta; dy: Delta }): Action {
  return { type: "move", dx: step.dx, dy: step.dy };
}
