export type Action =
  | { type: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  /** Fire at a specific enemy, or the nearest visible one when omitted. */
  | { type: "fire"; targetId?: number }
  | { type: "reload" }
  | { type: "wait" };
