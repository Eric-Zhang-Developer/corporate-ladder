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
  | { type: "wait" };
