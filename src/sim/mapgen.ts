import { Map as RotMap, RNG } from "rot-js";
import type { GameMap, Tile } from "./state";

export const MAP_W = 60;
export const MAP_H = 22;

export interface MapGenResult {
  map: GameMap;
  playerStart: { x: number; y: number };
  /** Center of the room farthest from the player — Stage 1 enemy spawn. */
  enemyStart: { x: number; y: number };
}

/**
 * rot.js map generators consume the global RNG singleton, so we seed it for
 * the duration of generation and restore it after. Map layout therefore
 * depends only on the seed, never on how much sim RNG has been consumed.
 */
export function generateMap(seed: number, width = MAP_W, height = MAP_H): MapGenResult {
  const saved = RNG.getState();
  RNG.setSeed(seed);
  try {
    const digger = new RotMap.Digger(width, height);
    const tiles: Tile[] = new Array(width * height).fill(0);
    digger.create((x, y, wall) => {
      tiles[y * width + x] = wall ? 0 : 1;
    });

    const rooms = digger.getRooms();
    if (rooms.length === 0) throw new Error("mapgen produced no rooms");
    const centers = rooms.map((room) => {
      const [cx, cy] = room.getCenter() as [number, number];
      return { x: cx, y: cy };
    });

    const playerStart = centers[0]!;
    let enemyStart = playerStart;
    let bestDist = -1;
    for (const c of centers) {
      const d = Math.hypot(c.x - playerStart.x, c.y - playerStart.y);
      if (d > bestDist) {
        bestDist = d;
        enemyStart = c;
      }
    }

    return { map: { width, height, tiles }, playerStart, enemyStart };
  } finally {
    RNG.setState(saved);
  }
}
