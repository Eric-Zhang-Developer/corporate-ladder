export const AP_COSTS = {
  move: 1,
  melee: 1,
  swap: 1,
  pickup: 1,
  /**
   * Working a bolt. Amortized this costs a bolt gun the same 2 AP per shot it
   * always paid — the point is that the cycle can be *deferred*: shoot, move
   * twice, and start the next fight with the bolt open and regretting it.
   */
  cycle: 1,
  /**
   * Slotting a plate mid-fight competes with shooting and moving, exactly like
   * reloading. That competition is what makes this turn-based rather than
   * borrowed from a shooter.
   */
  plate: 1,
} as const;

/**
 * The knife is a rule, not a weapon entry (§5 keeps melee to "a knife
 * slot"): bumping into an enemy always lands this, auto-hit.
 */
export const KNIFE = {
  name: "Knife",
  damage: 2,
} as const;
