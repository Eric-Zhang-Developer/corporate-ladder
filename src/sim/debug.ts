/**
 * Dev-only cheats (ux-design.md §2, M14), expressed as sim actions rather than
 * as direct mutation from the panel that triggers them. That is the whole
 * design decision here, and it buys four things: the renderer keeps its
 * never-writes-state invariant; the RNG round-trip stays owned by applyAction
 * instead of being reimplemented (and desynced) at a second site; the ops are
 * testable in the node-env harness like every other sim path; and a replay
 * containing debug actions still replays.
 *
 * The sim never checks the environment — it handles these unconditionally.
 * Only the DEV-only debug panel ever dispatches them, and that module is
 * dead-code-eliminated from every build output.
 *
 * `rng` is threaded through even though no op consumes it today: the next one
 * that rolls dice must ride the snapshot discipline, and a parameter enforces
 * that where a comment would only ask for it.
 */

import { enemyDef } from "../data/enemies";
import { LAST_FLOOR } from "../data/floors";
import { emit } from "./events";
import { applyFloor } from "./floor";
import type { SimRNG } from "./rng";
import {
  entityAt,
  freeTilesNear,
  pushLog,
  spawnEnemy,
  spawnItemNear,
  type GameState,
  type GroundItemPayload,
} from "./state";

export type DebugOp =
  /** Rebuilds the floor through the real generator — a genuine floor, not a fake one. */
  | { kind: "warp"; floor: number }
  /** One enemy on the nearest free tile. Unalerted, so you see the real spot turn. */
  | { kind: "spawn"; defId: string }
  /**
   * Anything you can pick up is already a GroundItemPayload, and spawnItemNear
   * already places one legally — so "give" is a drop at your feet plus the
   * existing pickup path, not a second set of slot/hotbar writes that could
   * build states the game cannot.
   */
  | { kind: "give"; payload: GroundItemPayload }
  | { kind: "cash"; amount: number }
  /** Promotion is checked in the turn loop, so a granted level lands next turn. */
  | { kind: "xp"; amount: number }
  | { kind: "heal" }
  | { kind: "god"; on: boolean }
  /** Omit targetId to clear the floor. No drops and no XP — a debug verb, not a kill. */
  | { kind: "kill"; targetId?: number };

export function applyDebug(state: GameState, _rng: SimRNG, op: DebugOp): void {
  switch (op.kind) {
    case "warp": {
      const floor = Math.min(Math.max(Math.round(op.floor), 1), LAST_FLOOR);
      // Warping is also the rescue hatch out of a stuck phase or a dead run.
      delete state.shop;
      delete state.perkOffer;
      delete state.killedBy;
      state.phase = "playing";
      applyFloor(state, floor);
      state.player.ap = state.player.maxAp;
      emit({ kind: "floorStart", floor });
      pushLog(state, `[debug] warped to floor ${floor}.`);
      break;
    }

    case "spawn": {
      const def = enemyDef(op.defId); // throws on a bad id rather than spawning a ghost
      const p = state.player;
      const spot = freeTilesNear(
        state.map,
        p.x,
        p.y,
        1,
        (x, y) => !entityAt(state, x, y),
        false,
      )[0];
      if (!spot) {
        pushLog(state, "[debug] nowhere to put it.");
        break;
      }
      state.enemies.push(spawnEnemy(state.nextId++, op.defId, spot.x, spot.y));
      pushLog(state, `[debug] spawned ${def.name}.`);
      break;
    }

    case "give": {
      spawnItemNear(state, op.payload, state.player.x, state.player.y);
      pushLog(state, `[debug] dropped ${op.payload.kind} at your feet.`);
      break;
    }

    case "cash": {
      state.cash = Math.max(0, state.cash + op.amount);
      pushLog(state, `[debug] cash is now ${state.cash}.`);
      break;
    }

    case "xp": {
      state.xp += op.amount;
      pushLog(state, `[debug] xp is now ${state.xp}.`);
      break;
    }

    case "heal": {
      state.player.hp = state.player.maxHp;
      pushLog(state, "[debug] healed.");
      break;
    }

    case "god": {
      if (op.on) state.god = true;
      else delete state.god; // invariant 2: clear by deleting, never by undefined
      pushLog(state, `[debug] god mode ${op.on ? "on" : "off"}.`);
      break;
    }

    case "kill": {
      const doomed =
        op.targetId === undefined
          ? [...state.enemies]
          : state.enemies.filter((e) => e.id === op.targetId);
      for (const e of doomed) {
        emit({
          kind: "kill",
          target: e.id,
          defId: e.defId,
          x: e.x,
          y: e.y,
          xp: 0,
          ...(enemyDef(e.defId).machine ? { machine: true as const } : {}),
        });
      }
      const gone = new Set(doomed.map((e) => e.id));
      state.enemies = state.enemies.filter((e) => !gone.has(e.id));
      pushLog(state, `[debug] removed ${doomed.length} enem${doomed.length === 1 ? "y" : "ies"}.`);
      break;
    }
  }
}
