import { enemyDef } from "../data/enemies";
import type { ShopState } from "../data/shop";
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
  /**
   * Plate pool. Absorbs before HP, does not regenerate, and melee ignores it
   * entirely — so plates buy confidence against gunfire and none at all
   * against the things that punish camping. Deleted at zero.
   */
  shield?: number;
  /**
   * Bolt guns only, and only ever set to false: absent means the chamber is
   * loaded. Storing the exceptional state means no spawn, pickup, or test
   * fixture has to know bolts exist.
   */
  chambered?: boolean;
  /** Set by moving, cleared at refill — the braced-fire gate for LMGs. */
  movedThisTurn?: boolean;
  /** Taser rule (§4.1): AP lost at the next refill, then cleared. */
  pendingApDrain?: number;
  /** Camera only: turns until the response team arrives. */
  alarmTimer?: number;
  /** Alarm callers: waves already sent. Past the cap they go dark. */
  alarmWaves?: number;
  /** Overwatch / spin-up telegraph: turns until the thing goes off. */
  chargeTimer?: number;
  /**
   * Stealth units before the reveal. Neither rendered nor targetable — the
   * absence on screen is the design.
   */
  hidden?: boolean;
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
  /** Preserved across swaps: stowing a bolt gun does not close its bolt. */
  chambered?: boolean;
}

/** What a ground item *is*, without where it lies. */
export type GroundItemPayload =
  | { kind: "weapon"; weaponId: string; ammoInMag: number }
  | { kind: "ammo"; caliber: Caliber; amount: number }
  | { kind: "plate" }
  | { kind: "carrier"; carrierId: string }
  | { kind: "consumable"; itemId: string }
  /** A machine, not an item: it is never picked up, only bought from. */
  | { kind: "vending" };

export type GroundItem = { id: number; x: number; y: number } & GroundItemPayload;

/** One item type per hotbar slot, stacked to the type's cap. */
export interface ItemStack {
  itemId: string;
  count: number;
}

export type GamePhase = "playing" | "promoting" | "shopping" | "dead" | "won";

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
  /**
   * Run-scoped player possessions live flat on the state alongside `ammo`,
   * rather than on the player Entity, which stays about position and combat.
   */
  carrierId: string | null;
  spareplates: number;
  /** Six typed stacks on keys 4-9. There is no bag; this is the inventory. */
  hotbar: (ItemStack | null)[];
  /** Meridian scrip. Humans carry it; machines are capital expenditure. */
  cash: number;
  /** Present only while phase is "shopping" — the landing between floors. */
  shop?: ShopState;
  xp: number;
  level: number;
  /** Chosen certification ids, in the order they were taken. */
  perks: string[];
  /** The two on offer while phase is "promoting". */
  perkOffer?: string[];
  /** Golden Parachute is once per run; this is that "once". */
  parachuteUsed?: boolean;
  /** OSHA Compliance: cleared each turn so only the first plate is free. */
  platedThisTurn?: boolean;
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

/**
 * Breadth-first search outward for open floor tiles. One helper for the three
 * callers that each grew their own: floor generation placing loot, the camera
 * shipping a response team, and dropped items scattering rather than stacking.
 *
 * `isFree` decides what "open" means per caller (unoccupied by entities, not
 * already claimed by another item, ...). `includeOrigin` exists because
 * spawning a response team on top of the camera's own tile is not the same
 * question as dropping a magazine at your feet.
 */
export function freeTilesNear(
  map: GameMap,
  ox: number,
  oy: number,
  count: number,
  isFree: (x: number, y: number) => boolean,
  includeOrigin = true,
): { x: number; y: number }[] {
  const found: { x: number; y: number }[] = [];
  const seen = new Set<string>([`${ox},${oy}`]);
  const queue: [number, number][] = [[ox, oy]];
  if (includeOrigin && isFloor(map, ox, oy) && isFree(ox, oy)) found.push({ x: ox, y: oy });

  while (queue.length > 0 && found.length < count) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isFloor(map, nx, ny)) continue;
      queue.push([nx, ny]);
      if (isFree(nx, ny)) {
        found.push({ x: nx, y: ny });
        if (found.length >= count) break;
      }
    }
  }
  return found;
}

/** Perk lookup. Cheap enough to call at a touchpoint; perks is a short list. */
export function hasPerk(state: GameState, id: string): boolean {
  return state.perks.includes(id);
}

/**
 * Places an item at (x,y) or the nearest free tile. One item per tile is law:
 * piles would mean pickup menus, and stacking loot under a vending machine
 * makes the tile's other contents unreachable.
 */
export function spawnItemNear(
  state: GameState,
  payload: GroundItemPayload,
  x: number,
  y: number,
): void {
  const spot = freeTilesNear(
    state.map,
    x,
    y,
    1,
    (fx, fy) => !state.items.some((i) => i.x === fx && i.y === fy),
  )[0];
  if (!spot) return; // nowhere to put it down
  state.items.push({ ...payload, id: state.nextId++, x: spot.x, y: spot.y });
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
  // Camo is on from the moment it exists, not from the moment it notices you.
  if (def.revealRange) entity.hidden = true;
  return entity;
}

