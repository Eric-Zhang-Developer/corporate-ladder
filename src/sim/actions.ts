export type Action =
  | { type: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  | { type: "wait" };
