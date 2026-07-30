import type { Action } from "../sim/actions";

const MOVES: Record<string, { dx: -1 | 0 | 1; dy: -1 | 0 | 1 }> = {
  ArrowUp: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

export function actionForKey(e: KeyboardEvent): Action | null {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const move = MOVES[key];
  if (move) return { type: "move", dx: move.dx, dy: move.dy };
  if (key === "f") return { type: "fire" };
  if (key === "r") return { type: "reload" };
  if (key === "g") return { type: "pickup" };
  if (key === "1") return { type: "swap", slot: 0 };
  if (key === "2") return { type: "swap", slot: 1 };
  if (key === "3") return { type: "swap", slot: 2 };
  if (key === " " || key === ".") return { type: "wait" };
  return null;
}
