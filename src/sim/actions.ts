export type Action =
  | { type: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  /** Fire at a specific enemy, or the nearest visible one when omitted. */
  | { type: "fire"; targetId?: number }
  | { type: "reload" }
  | { type: "swap"; slot: 0 | 1 | 2 }
  | { type: "pickup" }
  | { type: "plate" }
  | { type: "useItem"; slot: number }
  | { type: "throwItem"; slot: number; x: number; y: number }
  /** Deliberate slot management; swap-drop already covers upgrades in place. */
  | { type: "drop"; kind: "weapon" | "item"; slot: number }
  /** Take the stairs up (must be standing on them). */
  | { type: "ascend" }
  | { type: "choosePerk"; perkId: string }
  /**
   * `replaceSlot` names the gun being traded in when all three slots are full.
   * The choice rides in the action rather than in a sim sub-state so a replay
   * reproduces the whole decision from the action log alone.
   */
  | { type: "buy"; index: number; replaceSlot?: 0 | 1 | 2 }
  | { type: "leaveShop" }
  | { type: "wait" };
