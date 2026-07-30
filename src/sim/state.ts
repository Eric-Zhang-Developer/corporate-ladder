import { generateMap } from "./mapgen";
import { recomputeFov } from "./fov";

/** 0 = wall, 1 = floor */
export type Tile = 0 | 1;

export interface GameMap {
  width: number;
  height: number;
  /** Flat array, index = y * width + x. Plain data so state serializes. */
  tiles: Tile[];
}

export interface GameState {
  seed: number;
  turn: number;
  map: GameMap;
  /** Parallel to map.tiles: currently in FOV. */
  visible: boolean[];
  /** Parallel to map.tiles: ever seen. */
  explored: boolean[];
  player: { x: number; y: number };
}

export function idx(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

export function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function isFloor(map: GameMap, x: number, y: number): boolean {
  return inBounds(map, x, y) && map.tiles[idx(map, x, y)] === 1;
}

export function newGame(seed: number): GameState {
  const gen = generateMap(seed);
  const state: GameState = {
    seed,
    turn: 1,
    map: gen.map,
    visible: new Array(gen.map.tiles.length).fill(false),
    explored: new Array(gen.map.tiles.length).fill(false),
    player: { x: gen.playerStart.x, y: gen.playerStart.y },
  };
  recomputeFov(state);
  return state;
}

export function movePlayer(state: GameState, dx: number, dy: number): void {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!isFloor(state.map, nx, ny)) return;
  state.player.x = nx;
  state.player.y = ny;
  recomputeFov(state);
}
