import { enemyDef } from "../data/enemies";
import { WEAPONS, weaponDef, type Caliber } from "../data/weapons";
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
  /** null for pure-melee and support enemies. */
  weaponId: string | null;
  ammoInMag: number;
  /** Enemies idle until they spot the player; always true for the player. */
  alerted: boolean;
  /** Taser rule (§4.1): AP lost at the next refill, then cleared. */
  pendingApDrain?: number;
  /** Camera only: turns until the response team arrives. */
  alarmTimer?: number;
  /** Set on response-team cops so the alive-cap can count them. */
  spawnedBy?: string;
  /**
   * Player only: three carried guns (§9.5). weaponId/ammoInMag above mirror
   * the ACTIVE slot; the stored copy is written back on swap.
   */
  slots?: (WeaponSlot | null)[];
  activeSlot?: number;
}

export interface WeaponSlot {
  weaponId: string;
  ammoInMag: number;
}

export type GroundItem = { id: number; x: number; y: number } & (
  | { kind: "weapon"; weaponId: string; ammoInMag: number }
  | { kind: "ammo"; caliber: Caliber; amount: number }
);

export type GamePhase = "playing" | "dead";

export interface GameState {
  seed: number;
  /** SimRNG snapshot, updated after every action — replays stay exact. */
  rngState: number[];
  turn: number;
  floor: number;
  phase: GamePhase;
  map: GameMap;
  /** Where the player entered this floor — response teams arrive here. */
  entrance: { x: number; y: number };
  /** Parallel to map.tiles: currently in FOV. */
  visible: boolean[];
  /** Parallel to map.tiles: ever seen. */
  explored: boolean[];
  player: Entity;
  enemies: Entity[];
  /** Weapons and ammo lying on the floor. */
  items: GroundItem[];
  /** Player's per-caliber ammo reserve — the soft clock (§4.3). */
  ammo: Record<Caliber, number>;
  /** Monotonic id source for spawned entities and items. */
  nextId: number;
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
  const weapon = def.weaponId ? weaponDef(def.weaponId) : null;
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
    weaponId: def.weaponId ?? null,
    ammoInMag: weapon?.magSize ?? 0,
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
    slots: [{ weaponId: WEAPONS.glock.id, ammoInMag: WEAPONS.glock.magSize }, null, null],
    activeSlot: 0,
  };

  const state: GameState = {
    seed,
    rngState: rng.getState(),
    turn: 1,
    floor: 1,
    phase: "playing",
    map: gen.map,
    entrance: { x: gen.playerStart.x, y: gen.playerStart.y },
    visible: new Array(gen.map.tiles.length).fill(false),
    explored: new Array(gen.map.tiles.length).fill(false),
    player,
    enemies: [spawnEnemy(1, "rentacop", gen.enemyStart.x, gen.enemyStart.y)],
    items: [],
    ammo: { small: 24, medium: 0, large: 0 },
    nextId: 2,
    log: ["Floor 1. Find whoever signs the checks."],
  };
  recomputeFov(state);
  return state;
}
