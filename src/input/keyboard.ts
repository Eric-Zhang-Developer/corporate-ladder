export interface MoveInput {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

const MOVES: Record<string, MoveInput> = {
  ArrowUp: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

export function moveForKey(e: KeyboardEvent): MoveInput | null {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return MOVES[key] ?? null;
}
