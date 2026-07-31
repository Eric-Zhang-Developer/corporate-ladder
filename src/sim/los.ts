import { isFloor, type GameMap } from "./state";

/**
 * Shooting line-of-sight, symmetric: if A can shoot B, B can shoot A.
 * Bresenham rounds differently per direction, so we accept either ray.
 * Owned by the sim — render FOV is a separate concern.
 */
export function hasLos(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
  return ray(map, x0, y0, x1, y1) || ray(map, x1, y1, x0, y0);
}

function ray(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
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

/**
 * The tiles a shot passes through. Pure geometry, no wall test — the renderer
 * uses it to draw a marksman's covered lane during his telegraph, so the
 * player can see the line they are about to die in.
 */
export function lineTiles(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 512; guard++) {
    tiles.push({ x, y });
    if (x === x1 && y === y1) break;
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
  return tiles;
}
