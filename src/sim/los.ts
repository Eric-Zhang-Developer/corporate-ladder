import { isFloor, type GameMap } from "./state";

/**
 * Shooting line-of-sight: Bresenham between the two points, every cell
 * strictly between them must be floor. Owned by the sim — render FOV is a
 * separate concern.
 */
export function hasLos(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && !isFloor(map, x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
