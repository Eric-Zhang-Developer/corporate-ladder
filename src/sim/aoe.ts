import { enemyDef } from "../data/enemies";
import { dealDamage } from "./combat";
import type { SimRNG } from "./rng";
import { distance, pushLog, type Entity, type GameState } from "./state";

/**
 * Radius effects. Bought once and used twice: the player's grenades throw
 * through here, and the kamikaze drone detonates through the same call with
 * itself as the origin.
 */
export type BlastTargets = "all" | "machines" | "organics";

export interface Blast {
  radius: number;
  damage?: number;
  /**
   * A complete one-turn stun: the victim's next refill lands on zero and its
   * turn simply does not happen. Same field the taser uses, turned to max —
   * the taser was the prototype for this all along.
   */
  stun?: boolean;
  targets?: BlastTargets;
  /** Whether the player is in the blast. Flashbangs are trained-for; frags are not. */
  sparesPlayer?: boolean;
}

function isMachine(state: GameState, entity: Entity): boolean {
  if (entity.id === state.player.id) return false;
  return enemyDef(entity.defId).machine === true;
}

function affected(state: GameState, entity: Entity, blast: Blast): boolean {
  const targets = blast.targets ?? "all";
  if (targets === "all") return true;
  const machine = isMachine(state, entity);
  return targets === "machines" ? machine : !machine;
}

/**
 * Applies a blast centred on a tile. Everything inside the radius is resolved
 * in one pass; nothing here consumes RNG, so a blast never shifts the stream
 * for the shots that follow it.
 */
export function detonate(
  state: GameState,
  rng: SimRNG,
  cx: number,
  cy: number,
  blast: Blast,
  attacker: Entity,
  killVerb: string,
): void {
  const centre = { x: cx, y: cy };
  const candidates: Entity[] = [...state.enemies];
  if (!blast.sparesPlayer) candidates.push(state.player);

  for (const entity of candidates) {
    if (distance(entity, centre) > blast.radius) continue;
    if (!affected(state, entity, blast)) continue;

    const def = entity.id === state.player.id ? null : enemyDef(entity.defId);
    if (blast.stun && def?.empOnce) {
      if (entity.empUsed) {
        pushLog(state, `The ${entity.name} has adapted. The pulse washes over it.`);
        if (blast.damage) dealDamage(state, rng, attacker, entity, blast.damage, killVerb);
        continue;
      }
      entity.empUsed = true; // one panic button per customer
    }
    if (blast.stun) {
      // Full drain: their next turn does not happen. Capped at one turn, always
      // — an AoE stun that lasts two is the strongest verb in the game.
      entity.pendingApDrain = Math.max(entity.pendingApDrain ?? 0, entity.maxAp);
      entity.alerted = true;
      pushLog(
        state,
        entity.id === state.player.id
          ? "The world goes white. You lose your turn."
          : `The ${entity.name} reels, blinded.`,
      );
    }
    if (blast.damage && blast.damage > 0) {
      entity.alerted = true;
      // Blasts go around plate, not through it: the shield pool still absorbs.
      dealDamage(state, rng, attacker, entity, blast.damage, killVerb);
    }
  }
}
