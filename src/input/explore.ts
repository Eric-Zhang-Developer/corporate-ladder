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

import { SPARE_PLATE_CAP, carrierCapacity, carrierDef } from "../data/carriers";
import { itemDef } from "../data/items";
import { perkDef } from "../data/perks";
import { weaponDef } from "../data/weapons";
import type { Action } from "../sim/actions";
import type { SimEvent } from "../sim/events";
import {
  hasPerk,
  idx,
  inBounds,
  isFloor,
  type Entity,
  type GameState,
  type GroundItem,
} from "../sim/state";

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
   * Items the walk will not target again: whatever the player was standing on
   * when they pressed E, plus every decision it has already put to them. Small
   * by construction — anything taken leaves the map, so only refusals persist.
   */
  ignored: ReadonlySet<number>;
}

export type ExploreResult =
  /** Take this step. `toItem` is set while the walk is heading for loot. */
  | { kind: "step"; action: Action; toItem?: number }
  /** Standing on something free. Pick it up and keep walking — no choice was made. */
  | { kind: "take"; itemId: number }
  /** Standing on something that costs a slot. Stop and let the player decide. */
  | { kind: "offer"; itemId: number }
  /** Nothing left worth walking to. */
  | { kind: "done" }
  /** Unexplored map remains, but no route reaches it. */
  | { kind: "blocked" }
  /** Something is on screen. Auto-explore never walks with company. */
  | { kind: "halt" };

/**
 * What picking this up would cost the player — the whole basis of the
 * autopilot's manners.
 *
 * "free" means there is no decision to make: a counter goes up and nothing is
 * displaced, so taking it automatically cannot be regretted. "decision" means
 * it spends one of a fixed number of slots, or trades away the gun in your
 * hands — those get walked to and offered, never taken. "none" means the game
 * would refuse it (or it is furniture), so the walk stays quiet about it.
 *
 * This is the *autopilot's* question and is deliberately not `wantsItem` in
 * test/sim/bot.ts, which asks "would I take this" — the bot must never target
 * a weapon it cannot slot, because picking one up with three full slots drops
 * the gun it is holding and it would loop forever. E is allowed to walk you to
 * that same weapon precisely because it will not touch it.
 */
export type ItemInterest = "free" | "decision" | "none";

export function itemInterest(state: GameState, item: GroundItem): ItemInterest {
  switch (item.kind) {
    // A machine, not loot: never picked up, never removed from the map.
    case "vending":
      return "none";
    // Reserves are a per-caliber counter, and ammo is the run's soft clock.
    case "ammo":
      return "free";
    case "plate": {
      const cap =
        SPARE_PLATE_CAP + (hasPerk(state, "deep_pockets") ? (perkDef("deep_pockets").value ?? 0) : 0);
      return state.spareplates < cap ? "free" : "none";
    }
    case "carrier": {
      // The sim refuses sideways swaps outright, so anything it accepts is a
      // strict upgrade — no judgement call left to make.
      const worn = state.carrierId;
      if (worn && carrierCapacity(worn) >= carrierCapacity(item.carrierId)) return "none";
      return "free";
    }
    case "consumable": {
      // Stacks are uncapped, so a second medkit is a number going up. A type
      // you do not carry costs one of six slots, which is a real choice.
      if (state.hotbar.some((s) => s?.itemId === item.itemId)) return "free";
      return state.hotbar.some((s) => s === null) ? "decision" : "none";
    }
    // Always a decision: an empty slot spent, or the gun in your hands traded.
    case "weapon":
      return "decision";
  }
}

/**
 * Choices already sitting under the player when a walk begins — the gun a
 * full-slot swap just dropped there, or one they stopped for and declined.
 * Ignoring these is what stops E opening by offering back the thing you just
 * put down.
 *
 * Free loot is deliberately absent: a kill can drop ammo onto the very tile
 * you are standing on (spawnItemNear only avoids tiles that already hold an
 * item, not yours), and blanket-ignoring your own tile made that ammo
 * unreachable forever.
 */
export function underfootDecisions(state: GameState): number[] {
  const { x, y } = state.player;
  return state.items
    .filter((i) => i.x === x && i.y === y && itemInterest(state, i) === "decision")
    .map((i) => i.id);
}

/** What to call this on the hint row. */
export function describeItem(item: GroundItem): string {
  switch (item.kind) {
    case "ammo":
      return `${item.amount} ${item.caliber} rounds`;
    case "plate":
      return "An armor plate";
    case "carrier":
      return carrierDef(item.carrierId).name;
    case "consumable":
      return itemDef(item.itemId).name;
    case "weapon":
      return weaponDef(item.weaponId).name;
    case "vending":
      return "A vending machine";
  }
}

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

/** Loot worth walking to, by tile, carrying what arriving there will mean. */
function targetableItems(
  state: GameState,
  ignored: ReadonlySet<number>,
): Map<number, { id: number; interest: ItemInterest }> {
  const byTile = new Map<number, { id: number; interest: ItemInterest }>();
  for (const item of state.items) {
    if (ignored.has(item.id)) continue;
    // "none" covers furniture and anything the game would refuse to hand over,
    // which is what keeps the walk quiet once your slots are full.
    const interest = itemInterest(state, item);
    if (interest === "none") continue;
    const i = idx(state.map, item.x, item.y);
    // Knowledge gate: state.items holds loot the player has never laid eyes on.
    if (state.explored[i] !== true) continue;
    if (!byTile.has(i)) byTile.set(i, { id: item.id, interest });
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
 * Loot first, whatever the walk is otherwise doing. Shared by both modes on
 * purpose: travelling to the stairs used to be item-blind, which walked the
 * player straight over the ammo a fight had just dropped — the one moment on a
 * cleared floor when there is loot worth having and no map left to reveal.
 *
 * Returns null when there is nothing to collect, leaving the caller's own goal
 * to take over.
 */
function itemPass(state: GameState, memory: ExploreMemory): ExploreResult | null {
  const items = targetableItems(state, memory.ignored);
  if (items.size === 0) return null;
  // arriveOnStart: the search checks the tile underfoot against EVERY
  // candidate, not just the one being walked to, so loot crossed on the way to
  // other loot is noticed rather than trodden over.
  const found = search(state, (i) => items.has(i));
  if (!found) return null;
  const { id, interest } = items.get(found.goal)!;
  if (found.first.dx === 0 && found.first.dy === 0) {
    return interest === "free" ? { kind: "take", itemId: id } : { kind: "offer", itemId: id };
  }
  return { kind: "step", action: moveTo(found.first), toItem: id };
}

/**
 * The next auto-explore decision: walk to known loot first, then to the
 * nearest edge of the known map.
 */
export function exploreStep(state: GameState, memory: ExploreMemory): ExploreResult {
  if (visibleEnemies(state).length > 0) return { kind: "halt" };

  const loot = itemPass(state, memory);
  if (loot) return loot;

  const found = search(state, (_i, x, y) => isFrontier(state, x, y), false);
  if (found) return { kind: "step", action: moveTo(found.first) };
  return hasUnexplored(state) ? { kind: "blocked" } : { kind: "done" };
}

/**
 * Travel to the stairwell — the verb the floor asks for once there is nothing
 * left to find. It sweeps up anything still worth collecting on the way, then
 * stops ON the stairs; taking them stays a deliberate keystroke, because
 * leaving a floor is irreversible in a permadeath run.
 */
export function travelStep(state: GameState, memory: ExploreMemory): ExploreResult {
  if (visibleEnemies(state).length > 0) return { kind: "halt" };
  const loot = itemPass(state, memory);
  if (loot) return loot;
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
