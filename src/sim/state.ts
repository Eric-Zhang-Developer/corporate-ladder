import { enemyDef } from "../data/enemies";
import { WEAPONS, weaponDef } from "../data/weapons";
import { generateMap } from "./mapgen";
import { recomputeFov } from "./fov";
import { createSimRng } from "./rng";

/** 0 = wall, 1 = floor */
export type Tile = 0 | 1;

export interface GameMap {
  width: number;
  height: number;
  /** Flat array, index = y * width + x. Plain data so state serializes. */
  tiles: Tile[];
}

export interface Entity {
  id: number;
  /** "player" or a key into ENEMIES. */
  defId: string;
  name: string;
  glyph: string;
  color: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  weaponId: string;
  ammoInMag: number;
  /** Enemies idle until they spot the player; always true for the player. */
  alerted: boolean;
}

export type GamePhase = "playing" | "dead";

export interface GameState {
  seed: number;
  /** SimRNG snapshot, updated after every action — replays stay exact. */
  rngState: number[];
  turn: number;
  phase: GamePhase;
  map: GameMap;
  /** Parallel to map.tiles: currently in FOV. */
  visible: boolean[];
  /** Parallel to map.tiles: ever seen. */
  explored: boolean[];
  player: Entity;
  enemies: Entity[];
  log: string[];
  /** Shareable death line, set when phase becomes "dead". */
  killedBy?: string;
}

export const PLAYER_MAX_HP = 10;
export const PLAYER_MAX_AP = 3;
const LOG_LIMIT = 30;

export function idx(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

export function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function isFloor(map: GameMap, x: number, y: number): boolean {
  return inBounds(map, x, y) && map.tiles[idx(map, x, y)] === 1;
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function entityAt(state: GameState, x: number, y: number): Entity | null {
  if (state.player.x === x && state.player.y === y) return state.player;
  return state.enemies.find((e) => e.x === x && e.y === y) ?? null;
}

export function pushLog(state: GameState, message: string): void {
  state.log.push(message);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

export function spawnEnemy(id: number, defId: string, x: number, y: number): Entity {
  const def = enemyDef(defId);
  const weapon = weaponDef(def.weaponId);
  return {
    id,
    defId,
    name: def.name,
    glyph: def.glyph,
    color: def.color,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    ap: def.ap,
    maxAp: def.ap,
    weaponId: def.weaponId,
    ammoInMag: weapon.magSize,
    alerted: false,
  };
}

export function newGame(seed: number): GameState {
  const gen = generateMap(seed);
  // XOR keeps the sim stream distinct from the map stream under the same seed.
  const rng = createSimRng((seed ^ 0x9e3779b9) >>> 0);

  const player: Entity = {
    id: 0,
    defId: "player",
    name: "You",
    glyph: "@",
    color: "#ffffff",
    x: gen.playerStart.x,
    y: gen.playerStart.y,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    ap: PLAYER_MAX_AP,
    maxAp: PLAYER_MAX_AP,
    weaponId: WEAPONS.glock.id,
    ammoInMag: WEAPONS.glock.magSize,
    alerted: true,
  };

  const state: GameState = {
    seed,
    rngState: rng.getState(),
    turn: 1,
    phase: "playing",
    map: gen.map,
    visible: new Array(gen.map.tiles.length).fill(false),
    explored: new Array(gen.map.tiles.length).fill(false),
    player,
    enemies: [spawnEnemy(1, "rentacop", gen.enemyStart.x, gen.enemyStart.y)],
    log: ["Floor 1. Find whoever signs the checks."],
  };
  recomputeFov(state);
  return state;
}
