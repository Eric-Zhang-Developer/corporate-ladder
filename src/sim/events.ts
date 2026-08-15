/**
 * The sim's event stream: an ordered record of everything that happened
 * during one applyAction — "the diary". Renderers consume it (sound and
 * staggered turn playback today; death recaps and replay viewers are future
 * readers), which is why events carry actor ids, positions, damage numbers
 * and weaponIds even where sound alone would not need them.
 *
 * Rules:
 * - Events are plain data. No undefined-valued fields (spread optionals in,
 *   same discipline as GameState), no Map/Set — the stream must serialize
 *   exactly like state does.
 * - Emission is ADDITIVE ONLY: it must never consume RNG or alter log text.
 *   The golden test snapshots both and is the tripwire.
 * - Events are a product of the action, not state: they are returned from
 *   applyAction and never stored on GameState, so saves, the serialization
 *   round-trip and the golden summarize() are structurally unaffected.
 */

/** One telegraph kind, six styles — every "something is about to happen". */
export type TelegraphStyle = "camera" | "lock" | "spinup" | "dive" | "reveal" | "wake";

export type PickupKind = "ammo" | "plate" | "carrier" | "consumable" | "weapon";
export type DropKind = "ammo" | "cash" | "consumable" | "weapon";

export type SimEvent =
  // ---- combat
  | { kind: "shot"; by: number; weaponId: string; x: number; y: number; target: number;
      tx: number; ty: number; pellets: number; hits: number; dmg: number;
      wide?: true; clatter?: true; machine?: true }
  | { kind: "boltCycle"; by: number; x: number; y: number }
  | { kind: "dryClick" }
  | { kind: "melee"; by: number; target: number; x: number; y: number; dmg: number;
      blade?: true; zap?: true; machine?: true }
  | { kind: "plateHit"; target: number; x: number; y: number; absorbed: number; broken?: true }
  | { kind: "hurt"; target: number; dmg: number; x: number; y: number;
      machine?: true; melee?: true }
  | { kind: "kill"; target: number; defId: string; x: number; y: number;
      xp: number; machine?: true }
  | { kind: "death" }
  | { kind: "reload"; by: number; weaponId: string; x: number; y: number; discarded?: number }
  | { kind: "drop"; x: number; y: number; what: DropKind }
  // ---- enemy signatures
  | { kind: "spot"; by: number; defId: string; x: number; y: number; machine?: true }
  | { kind: "step"; by: number; defId: string; fromX: number; fromY: number;
      x: number; y: number }
  | { kind: "telegraph"; style: TelegraphStyle; by: number; defId: string;
      x: number; y: number; weaponId?: string }
  | { kind: "alarmWave"; by: number; spawned: number; x: number; y: number }
  | { kind: "duelistPlate"; by: number; x: number; y: number }
  | { kind: "duelistStim"; by: number; x: number; y: number }
  // ---- area effects
  | { kind: "blast"; x: number; y: number; radius: number; damage?: number;
      stun?: true; targets?: "all" | "machines" | "organics" }
  | { kind: "throw"; x: number; y: number }
  // ---- player economy & items
  | { kind: "pickup"; what: PickupKind }
  | { kind: "plateSlot" }
  | { kind: "swap"; weaponId: string }
  | { kind: "useItem"; itemId: string }
  | { kind: "purchase"; ok: boolean; source: "shop" | "vending" }
  // ---- structure
  | { kind: "promote"; level: number }
  | { kind: "perkPick"; perkId: string }
  | { kind: "shopEnter" }
  | { kind: "floorStart"; floor: number }
  | { kind: "win" };

/**
 * Module-level collector so combat/ai/aoe emit without threading a sink
 * through every signature. applyAction never nests, so one begin/drain per
 * call is safe. `emit` is a NO-OP while no collection is open — the tests
 * that call fireWeapon/meleeAttack/detonate directly stay inert and leak
 * nothing into the next applyAction.
 */
let buffer: SimEvent[] | null = null;

export function beginEvents(): void {
  buffer = [];
}

export function emit(event: SimEvent): void {
  buffer?.push(event);
}

export function drainEvents(): SimEvent[] {
  const out = buffer ?? [];
  buffer = null;
  return out;
}
