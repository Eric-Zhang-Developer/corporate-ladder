/**
 * Promotions. The repo is named for this: levels are advancement, XP is
 * performance, and perks are certifications and benefits.
 *
 * Two rules keep the system from eating the game:
 *
 * 1. NO MULTIPLIERS. Damage-per-AP-at-band is the entire balance currency, so
 *    a stacking +X% would debase every tier window and gun identity at once.
 *    Every perk below is flat, discrete and bounded. `value` is an absolute
 *    amount, never a factor, and a test asserts it.
 * 2. ONE TOUCHPOINT. A perk must be implementable as one conditional at one
 *    site in the sim. Anything needing systems code across several files is
 *    two perks or zero perks.
 *
 * Corollary: no perk ever grants max AP. +1 AP in a 3-AP economy is a 33%
 * action inflation that beats every other reward, and the moment it is on the
 * menu the menu has one item.
 */
export interface PerkDef {
  id: string;
  name: string;
  blurb: string;
  /** Flat magnitude where the effect needs one. Never a multiplier. */
  value?: number;
}

export const PERKS = {
  wellness: {
    id: "wellness",
    name: "Corporate Wellness",
    blurb: "+6 maximum HP. The gym membership finally pays out.",
    value: 6,
  },
  severance: {
    id: "severance",
    name: "Severance Bonus",
    blurb: "+4 damage on your first shot at anyone who has not noticed you.",
    value: 4,
  },
  letter_opener: {
    id: "letter_opener",
    name: "Letter Opener",
    blurb: "+2 melee damage. Knives and bayonets both.",
    value: 2,
  },
  it_cert: {
    id: "it_cert",
    name: "IT Certification",
    blurb: "+2 damage against machines. You have read the manual.",
    value: 2,
  },
  time_management: {
    id: "time_management",
    name: "Time Management",
    blurb: "Reloads cost 1 less AP, to a minimum of 1.",
    value: 1,
  },
  osha: {
    id: "osha",
    name: "OSHA Compliance",
    blurb: "The first plate you slot each turn is free.",
  },
  ergonomic: {
    id: "ergonomic",
    name: "Ergonomic Workspace",
    blurb: "Standing still steadies every gun, not just the belt-feds.",
    value: 0.12,
  },
  follow_up: {
    id: "follow_up",
    name: "Follow-Up Meeting",
    blurb: "One missed pellet per volley gets a second chance.",
  },
  asset_recovery: {
    id: "asset_recovery",
    name: "Asset Recovery",
    blurb: "Ammo drops are half again as large.",
  },
  expense_account: {
    id: "expense_account",
    name: "Expense Account",
    blurb: "Merchants and vending machines charge you 25% less.",
  },
  deep_pockets: {
    id: "deep_pockets",
    name: "Deep Pockets",
    blurb: "Carry 2 more spare plates.",
    value: 2,
  },
  field_awareness: {
    id: "field_awareness",
    name: "Field Awareness",
    blurb: "+1 tile of sight.",
    value: 1,
  },
  hazard_pay: {
    id: "hazard_pay",
    name: "Hazard Pay",
    blurb: "+1 AP on any turn that starts with nothing in sight.",
    value: 1,
  },
  golden_parachute: {
    id: "golden_parachute",
    name: "Golden Parachute",
    blurb: "Once per run, a killing blow leaves you standing on 1 HP.",
  },
} satisfies Record<string, PerkDef>;

export function perkDef(id: string): PerkDef {
  const def = (PERKS as Record<string, PerkDef>)[id];
  if (!def) throw new Error(`Unknown perk: ${id}`);
  return def;
}

export const PERK_IDS = Object.keys(PERKS);

/** Max HP granted by every promotion, on top of whatever perk is chosen. */
export const HP_PER_PROMOTION = 3;

/** Offers per promotion. Two keeps the choice fast and the pool from draining. */
export const PERK_OFFER_SIZE = 2;

/**
 * TOTAL career XP required to reach a level — cumulative, not per-level, since
 * that is what the check compares against.
 *
 * Fitted to observed floor yields (a full floor-1 clear is ~35 XP and each
 * floor above pays roughly 16 more) so that one floor buys roughly one
 * promotion: level tracks floor for a normal-violence run, runs ahead for
 * completionists, behind for stair-sprinters. Reaching level 9 means clearing
 * most of the tower.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 35 * n + 8 * n * (n - 1);
}
