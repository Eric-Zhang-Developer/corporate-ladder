import { SPARE_PLATE_CAP, carrierCapacity } from "../data/carriers";
import { perkDef } from "../data/perks";
import type { GameState } from "./state";

/** Maximum loose plates the player can carry under the current perk loadout. */
export function sparePlateCapacity(state: GameState): number {
  const bonus = state.perks.includes("deep_pockets")
    ? (perkDef("deep_pockets").value ?? 0)
    : 0;
  return SPARE_PLATE_CAP + bonus;
}

/** Carrier swaps are accepted only when they strictly increase shield capacity. */
export function carrierIsUpgrade(state: GameState, candidateId: string): boolean {
  return (
    state.carrierId === null ||
    carrierCapacity(candidateId) > carrierCapacity(state.carrierId)
  );
}

/** Existing stack of this type, else the first empty hotbar slot, else -1. */
export function hotbarSlotFor(state: GameState, itemId: string): number {
  const existing = state.hotbar.findIndex((slot) => slot?.itemId === itemId);
  if (existing !== -1) return existing;
  return state.hotbar.findIndex((slot) => slot === null);
}
