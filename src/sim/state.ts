import { enemyDef } from "../data/enemies";
import { weaponDef, type Caliber } from "../data/weapons";

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
  /** Flat DR subtracted from EVERY pellet. Blades ignore it. */
  armor?: number;
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

export type GamePhase = "playing" | "dead" | "won";

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
  /** The way up. Standing here and ascending advances the floor. */
  stairs: { x: number; y: number };
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

// newGame lives in sim/floor.ts — it builds the first floor.

export function spawnEnemy(id: number, defId: string, x: number, y: number): Entity {
  const def = enemyDef(defId);
  const weapon = def.weaponId ? weaponDef(def.weaponId) : null;
  const entity: Entity = {
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
  // Copied onto the entity rather than read from the def at damage time so a
  // future cracked-armor mechanic has somewhere to write. Omitted when zero —
  // invariant 2 forbids undefined-valued keys.
  if (def.armor) entity.armor = def.armor;
  return entity;
}

