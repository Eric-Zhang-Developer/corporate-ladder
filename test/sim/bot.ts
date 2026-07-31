import { Path } from "rot-js";
import { SPARE_PLATE_CAP, carrierCapacity, carrierDef } from "../../src/data/carriers";
import { HOTBAR_SLOTS, itemDef } from "../../src/data/items";
import { maxRange, weaponDef } from "../../src/data/weapons";
import type { Action } from "../../src/sim/actions";
import { newGame } from "../../src/sim/floor";
import { hasLos } from "../../src/sim/los";
import { applyAction } from "../../src/sim/step";
import { distance, idx, isFloor, type GameState, type GroundItem } from "../../src/sim/state";
import { assertStateInvariants } from "./invariants";

/**
 * A headless player good enough to finish a run: shoot what it can see, knife
 * what it touches, loot what is cheap to reach, take the stairs. It exists to
 * exercise the whole run loop across seeds — the technique that caught the
 * asymmetric-LOS and enemies-not-waking-when-shot bugs in Stage 2.
 *
 * Deliberately not clever: it does not kite, ration ammo, or pick fights it can
 * win. A bot that plays well hides balance problems.
 */

export type BotOutcome = "won" | "dead" | "stalled";

export interface BotResult {
  state: GameState;
  outcome: BotOutcome;
  actions: number;
  turns: number;
  deepestFloor: number;
  killedBy?: string;
}

export interface BotOptions {
  /** Hard stop so a broken sim fails the test instead of hanging it. */
  maxActions?: number;
  /** Runs after every action — invariant checking is on by default. */
  check?: boolean;
  onAction?: (state: GameState, action: Action) => void;
}

/** Item kinds the bot will detour for, given its current inventory. */
function wantsItem(state: GameState, item: GroundItem): boolean {
  if (item.kind === "ammo") return true;
  if (item.kind === "plate") return state.spareplates < SPARE_PLATE_CAP;
  if (item.kind === "carrier") {
    // Only an upgrade — matching the sim's own rule keeps the bot from
    // re-collecting the carrier it just swapped off.
    return !state.carrierId || carrierCapacity(state.carrierId) < carrierCapacity(item.carrierId);
  }
  if (item.kind === "consumable") {
    const cap = itemDef(item.itemId).stack;
    return state.hotbar.some((s) => s === null || (s.itemId === item.itemId && s.count < cap));
  }
  if (item.kind === "weapon") {
    // Only take a gun into a genuinely empty slot. Picking one up with all
    // slots full drops the held gun at our feet, which a "walk to nearest
    // item" bot would then pick up forever.
    const slots = state.player.slots;
    if (!slots) return false;
    return slots.some((s, i) => s === null && i !== state.player.activeSlot);
  }
  return false;
}

function stepToward(state: GameState, gx: number, gy: number): Action | null {
  const p = state.player;
  if (p.x === gx && p.y === gy) return null;
  // Enemy-occupied tiles stay passable: walking into one is the knife attack,
  // which is how the bot fights through a blocked corridor instead of stalling.
  const passable = (x: number, y: number) => (x === p.x && y === p.y) || isFloor(state.map, x, y);
  const astar = new Path.AStar(gx, gy, passable, { topology: 4 });
  const path: { x: number; y: number }[] = [];
  astar.compute(p.x, p.y, (x, y) => path.push({ x, y }));
  const next = path[1];
  if (!next) return null;
  return {
    type: "move",
    dx: Math.sign(next.x - p.x) as -1 | 0 | 1,
    dy: Math.sign(next.y - p.y) as -1 | 0 | 1,
  };
}

/**
 * Sticky goal. Re-picking "nearest item" every step oscillates forever between
 * two piles that sit either side of the detour radius — each one enters the
 * radius as the other leaves it. The bot commits to a destination until it
 * arrives, the target disappears, or the path does.
 */
interface BotMemory {
  goal: { x: number; y: number; itemId: number | null } | null;
}

function decide(state: GameState, memory: BotMemory): Action {
  const p = state.player;
  const { map } = state;

  // Adjacent enemy: bump it. Orthogonal only — that is what melee range means
  // here (Euclidean <= 1), and it matches how enemies reach us.
  const adjacent = state.enemies.find((e) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) === 1);
  if (adjacent) {
    return {
      type: "move",
      dx: Math.sign(adjacent.x - p.x) as -1 | 0 | 1,
      dy: Math.sign(adjacent.y - p.y) as -1 | 0 | 1,
    };
  }

  // Patch up when badly hurt, cheapest effective heal first. Exercises the
  // consumable path on every run instead of only when a test remembers to.
  if (p.hp <= p.maxHp * 0.5) {
    const healSlot = state.hotbar.findIndex((s) => {
      if (!s) return false;
      const effect = itemDef(s.itemId).effect;
      return (
        (effect.kind === "heal" || effect.kind === "healFull") && p.ap >= itemDef(s.itemId).apUse
      );
    });
    if (healSlot !== -1) return { type: "useItem", slot: healSlot };
  }

  // Plate up when there is room and a spare — cheap, and it exercises the
  // shield path on every run rather than only when a human remembers to.
  if (state.carrierId && state.spareplates > 0) {
    const capacity = carrierCapacity(state.carrierId);
    if ((p.shield ?? 0) + carrierDef(state.carrierId).plateValue <= capacity) {
      return { type: "plate" };
    }
  }

  if (p.weaponId) {
    const weapon = weaponDef(p.weaponId);
    const shootable = state.enemies
      .filter(
        (e) =>
          state.visible[idx(map, e.x, e.y)] === true &&
          hasLos(map, p.x, p.y, e.x, e.y) &&
          distance(p, e) <= maxRange(weapon),
      )
      .sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id);

    if (shootable.length > 0 && p.ammoInMag > 0 && p.ap >= weapon.apFire) {
      return { type: "fire", targetId: shootable[0]!.id };
    }
    if (p.ammoInMag <= 0 && state.ammo[weapon.caliber] > 0 && p.ap >= weapon.apReload) {
      return { type: "reload" };
    }
  }

  const here = state.items.find((i) => i.x === p.x && i.y === p.y && wantsItem(state, i));
  if (here) {
    memory.goal = null;
    return { type: "pickup" };
  }

  if (p.x === state.stairs.x && p.y === state.stairs.y) return { type: "ascend" };

  // Drop a goal that has been reached, looted by nobody, or invalidated.
  const goal = memory.goal;
  if (goal) {
    const gone =
      goal.itemId !== null && !state.items.some((i) => i.id === goal.itemId && wantsItem(state, i));
    if (gone || (p.x === goal.x && p.y === goal.y)) memory.goal = null;
  }

  if (!memory.goal) {
    const wanted = state.items
      .filter((i) => wantsItem(state, i) && distance(p, i) <= 12)
      .sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id)[0];
    memory.goal = wanted
      ? { x: wanted.x, y: wanted.y, itemId: wanted.id }
      : { x: state.stairs.x, y: state.stairs.y, itemId: null };
  }

  const step = stepToward(state, memory.goal.x, memory.goal.y);
  if (step) return step;

  // Unreachable: abandon it and head for the stairs instead.
  memory.goal = null;
  return stepToward(state, state.stairs.x, state.stairs.y) ?? { type: "wait" };
}

export function runBot(seed: number, options: BotOptions = {}): BotResult {
  const maxActions = options.maxActions ?? 4000;
  const check = options.check ?? true;
  let state = newGame(seed);
  const memory: BotMemory = { goal: null };
  let actions = 0;
  let deepestFloor = state.floor;
  // Stall detection: an action that changes neither the turn nor our position
  // is legal (a free typo-rule bail), but a long run of them means the bot has
  // no way forward and the test should fail loudly rather than spin.
  let idle = 0;

  while ((state.phase === "playing" || state.phase === "promoting") && actions < maxActions) {
    const before = { turn: state.turn, x: state.player.x, y: state.player.y };
    // Promotions pause the game until a certification is chosen. The bot always
    // takes the first offer — it is exercising the flow, not optimising a build.
    const action: Action =
      state.phase === "promoting"
        ? { type: "choosePerk", perkId: state.perkOffer?.[0] ?? "" }
        : decide(state, memory);
    const floorBefore = state.floor;
    state = applyAction(state, action);
    if (state.floor !== floorBefore) memory.goal = null; // new floor, new map
    actions += 1;
    options.onAction?.(state, action);
    if (check) assertStateInvariants(state, `seed ${seed}, action ${actions} (${action.type})`);

    deepestFloor = Math.max(deepestFloor, state.floor);
    const moved =
      state.turn !== before.turn ||
      state.player.x !== before.x ||
      state.player.y !== before.y ||
      action.type === "choosePerk";
    idle = moved ? 0 : idle + 1;
    if (idle > 25) break;
  }

  const outcome: BotOutcome =
    state.phase === "won" ? "won" : state.phase === "dead" ? "dead" : "stalled";
  const result: BotResult = { state, outcome, actions, turns: state.turn, deepestFloor };
  if (state.killedBy) result.killedBy = state.killedBy;
  return result;
}
