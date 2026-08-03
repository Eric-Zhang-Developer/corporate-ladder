/**
 * Consumables are data entries like everything else. The rule that keeps this
 * from becoming a status-effect framework: an effect is one plain-data field
 * plus one check site, or it does not get in. The taser set that precedent —
 * it is not a "status system", it is `pendingApDrain` read at one place.
 *
 * AP cost is the healing balance lever, not the HP number. A heal's power is
 * *when you can afford to use it*: 1 AP heals are combat verbs, 2 AP heals are
 * between-fights verbs, and the 3 AP heal is a whole helpless turn — the LMG
 * reload trade wearing a red cross. Rarity runs opposite to AP cost.
 */
export type ItemEffect =
  | { kind: "heal"; amount: number }
  | { kind: "healFull" }
  /** One glorious turn, one hangover. Rides the existing AP-drain machinery. */
  | { kind: "stim"; bonus: number; comedown: number }
  /** Layout only — knowing where the stairs are changes routing; knowing where
   *  everything is deletes exploration. */
  | { kind: "reveal" }
  /**
   * Thrown radius effects. Each grenade answers a different half of the mixed
   * bestiary, so a throwable loadout is a bet on what you expect to fight.
   */
  | {
      kind: "throw";
      range: number;
      radius: number;
      damage?: number;
      stun?: boolean;
      targets?: "all" | "machines" | "organics";
      sparesPlayer?: boolean;
    };

export interface ItemDef {
  id: string;
  name: string;
  glyph: string;
  color: string;
  apUse: number;
  /** Hotbar stack cap. */
  stack: number;
  effect: ItemEffect;
}

export const ITEMS = {
  snack: {
    id: "snack",
    name: "Vending Snack",
    glyph: "%",
    color: "#dd8844",
    apUse: 1,
    stack: 5,
    effect: { kind: "heal", amount: 3 },
  },
  bandage: {
    id: "bandage",
    name: "Bandage",
    glyph: "+",
    color: "#dddddd",
    apUse: 2,
    stack: 5,
    effect: { kind: "heal", amount: 5 },
  },
  medshot: {
    id: "medshot",
    name: "Med Shot",
    glyph: "!",
    color: "#dd4466",
    apUse: 1,
    stack: 3,
    effect: { kind: "heal", amount: 7 },
  },
  medkit: {
    id: "medkit",
    name: "Medkit",
    glyph: "&",
    color: "#ff5577",
    apUse: 3,
    stack: 1,
    effect: { kind: "healFull" },
  },
  stim: {
    id: "stim",
    name: "Adrenal Stim",
    glyph: "^",
    color: "#66ddaa",
    apUse: 1,
    stack: 3,
    // Immediate rather than next-turn: you jab it and act. Net +2 AP this
    // turn after paying for the jab, then a 1-AP hangover.
    effect: { kind: "stim", bonus: 3, comedown: 1 },
  },
  schematics: {
    id: "schematics",
    name: "Building Schematics",
    glyph: "?",
    color: "#88bbdd",
    apUse: 1,
    stack: 3,
    effect: { kind: "reveal" },
  },
  frag: {
    id: "frag",
    name: "Frag Grenade",
    glyph: "o",
    color: "#cc7744",
    apUse: 1,
    stack: 3,
    // Hits everyone, including you. Throwing it at your own feet is a mistake
    // the game will let you make.
    effect: { kind: "throw", range: 5, radius: 1, damage: 9 },
  },
  flashbang: {
    id: "flashbang",
    name: "Flashbang",
    glyph: "o",
    color: "#eeeecc",
    apUse: 1,
    stack: 3,
    // No damage at all: the whole item is one stolen turn. Organics only —
    // machines have no eyes to take away.
    effect: {
      kind: "throw",
      range: 5,
      radius: 1,
      stun: true,
      targets: "organics",
      sparesPlayer: true,
    },
  },
  emp: {
    id: "emp",
    name: "EMP Grenade",
    glyph: "o",
    color: "#66ccee",
    apUse: 1,
    stack: 3,
    // The other half of the bestiary, and the anti-chassis panic button.
    effect: { kind: "throw", range: 5, radius: 1, damage: 12, stun: true, targets: "machines" },
  },
} satisfies Record<string, ItemDef>;

export function itemDef(id: string): ItemDef {
  const def = (ITEMS as Record<string, ItemDef>)[id];
  if (!def) throw new Error(`Unknown item: ${id}`);
  return def;
}

/**
 * Six, because the keyboard settles it: 1-3 are weapons, so 4-9 is what is
 * left. Against a ten-type catalog that still forces loadout choices; it just
 * kills "I cannot take the medkit, I am carrying snacks".
 */
export const HOTBAR_SLOTS = 6;
