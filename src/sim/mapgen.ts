import { Map as RotMap, RNG } from "rot-js";
import type { GameMap, Tile } from "./state";

// Near-viewport aspect (taller, narrower than the old 60x22 strip) so the
// map fills the play area instead of letterboxing into a band.
export const MAP_W = 48;
export const MAP_H = 30;

export interface MapGenResult {
  map: GameMap;
  playerStart: { x: number; y: number };
  /** All room centers; index 0 is the player's start room. */
  rooms: Array<{ x: number; y: number }>;
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

    return { map: { width, height, tiles }, playerStart: centers[0]!, rooms: centers };
  } finally {
    RNG.setState(saved);
  }
}
