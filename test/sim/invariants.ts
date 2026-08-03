import type { GameState } from "../../src/sim/state";
import { idx, isFloor } from "../../src/sim/state";

/**
 * Runtime enforcement of the four architecture invariants, callable after any
 * action. Throws with a named violation rather than a deep-equal diff, so a
 * failing bot run points at the rule it broke instead of dumping the state.
 */
export function assertStateInvariants(state: GameState, context = ""): void {
  const where = context ? ` [${context}]` : "";
  const fail = (msg: string): never => {
    throw new Error(`invariant violated${where}: ${msg}`);
  };

  assertSerializable(state, "state", fail);

  const { player, map } = state;
  if (player.ap < 0) fail(`player AP negative (${player.ap})`);
  if (player.hp > player.maxHp) fail(`player HP ${player.hp} exceeds max ${player.maxHp}`);
  if (state.phase === "playing" && player.hp <= 0) fail("player at 0 HP but phase is still playing");

  for (const [caliber, count] of Object.entries(state.ammo)) {
    if (count < 0) fail(`${caliber} reserve negative (${count})`);
  }

  if (state.visible.length !== map.tiles.length) fail("visible array desynced from map");
  if (state.explored.length !== map.tiles.length) fail("explored array desynced from map");

  const ids = new Set<number>([player.id]);
  for (const e of state.enemies) {
    if (ids.has(e.id)) fail(`duplicate entity id ${e.id}`);
    ids.add(e.id);
    if (e.hp <= 0) fail(`${e.defId} (${e.id}) is alive at ${e.hp} HP`);
    if (e.ap < 0) fail(`${e.defId} (${e.id}) AP negative (${e.ap})`);
    if (!isFloor(map, e.x, e.y)) fail(`${e.defId} (${e.id}) standing on a wall at ${e.x},${e.y}`);
  }

  const itemIds = new Set<number>();
  for (const item of state.items) {
    if (itemIds.has(item.id)) fail(`duplicate item id ${item.id}`);
    itemIds.add(item.id);
    if (!isFloor(map, item.x, item.y)) fail(`item ${item.id} inside a wall at ${item.x},${item.y}`);
  }

  if (!isFloor(map, player.x, player.y)) fail(`player inside a wall at ${player.x},${player.y}`);
  if (state.visible[idx(map, player.x, player.y)] !== true) fail("player's own tile is not visible");
}

/**
 * Invariant 2: GameState survives a JSON round-trip. Walks for the things that
 * silently break it — functions, class instances, Map/Set, and `undefined`
 * values (which is why the codebase deletes optional fields instead of
 * assigning undefined).
 */
function assertSerializable(value: unknown, path: string, fail: (msg: string) => never): void {
  if (value === null) return;
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean") return;
  if (t === "function") fail(`${path} is a function`);
  if (t !== "object") fail(`${path} is a ${t}`);

  if (value instanceof Map || value instanceof Set) fail(`${path} is a ${value.constructor.name}`);
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertSerializable(v, `${path}[${i}]`, fail));
    return;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    fail(`${path} is a class instance (${(value as object).constructor?.name})`);
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) fail(`${path}.${key} is undefined (delete the field instead)`);
    assertSerializable(v, `${path}.${key}`, fail);
  }
}
