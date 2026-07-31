export type Action =
  | { type: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  /** Fire at a specific enemy, or the nearest visible one when omitted. */
  | { type: "fire"; targetId?: number }
  | { type: "reload" }
  | { type: "swap"; slot: 0 | 1 | 2 }
  | { type: "pickup" }
  | { type: "plate" }
  /** Take the stairs up (must be standing on them). */
  | { type: "ascend" }
  | { type: "wait" };
