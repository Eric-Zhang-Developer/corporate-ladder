export const AP_COSTS = {
  move: 1,
  melee: 1,
  swap: 1,
  pickup: 1,
} as const;

/**
 * The knife is a rule, not a weapon entry (§5 keeps melee to "a knife
 * slot"): bumping into an enemy always lands this, auto-hit.
 */
export const KNIFE = {
  name: "Knife",
  damage: 2,
} as const;
