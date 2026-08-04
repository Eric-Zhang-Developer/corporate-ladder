/**
 * Pure weapon-information formatters, shared by the sidebar gun card and the
 * ARSENAL overlay. Guns are patterns, not numbers (handoff §2) — the band
 * strip is that sentence made visible: a fixed distance axis shaded by dmg/AP
 * relative to the gun's own peak, so band structure reads as shape before
 * anyone reads a number.
 */
import { AP_COSTS } from "../data/costs";
import { dmgPerAp, type WeaponDef } from "../data/weapons";

/** One cell per tile of distance. 12 covers the longest band in the roster. */
export const STRIP_AXIS = 12;

export type StripLevel = "hi" | "mid" | "lo" | "out";

export interface StripCell {
  level: StripLevel;
  /** Set on the cell under the current target, so the caret is data too. */
  target?: true;
}

/**
 * Shading is relative to the gun's own peak, not a global scale: the strip
 * answers "where is THIS gun good", and cross-gun comparison is the overlay's
 * job, where the real dmg/AP numbers sit next to each other.
 */
export function stripCells(def: WeaponDef, targetDist: number | null): StripCell[] {
  const byDist = Array.from({ length: STRIP_AXIS }, (_, i) => dmgPerAp(def, i + 1));
  const peak = Math.max(...byDist);
  // Clamp instead of dropping: a target past the axis still reads as "past the
  // end", which is more honest than a caret that silently vanishes.
  const caret = targetDist === null ? null : Math.max(1, Math.min(STRIP_AXIS, Math.round(targetDist)));
  return byDist.map((dpa, i) => {
    const ratio = peak > 0 ? dpa / peak : 0;
    const level: StripLevel = dpa <= 0 ? "out" : ratio >= 0.7 ? "hi" : ratio >= 0.35 ? "mid" : "lo";
    return caret === i + 1 ? { level, target: true } : { level };
  });
}

const GLYPH: Record<StripLevel, string> = { hi: "█", mid: "▓", lo: "░", out: "·" };

/** The strip as HTML. Glyphs carry the shape even before the colors load. */
export function stripHtml(def: WeaponDef, targetDist: number | null): string {
  return stripCells(def, targetDist)
    .map((c) => `<span class="rs-${c.level}${c.target ? " rs-tgt" : ""}">${GLYPH[c.level]}</span>`)
    .join("");
}

/** "fire 1+1 AP · reload 2 AP · 4 rds/pull" — the costs the card never showed. */
export function apLine(def: WeaponDef): string {
  // A bolt gun's fire cost is honest only as fire+cycle; the cycle can be
  // deferred, never skipped (§ arsenal: the -12% premium already prices it).
  const fire = def.boltAction ? `${def.apFire}+${AP_COSTS.cycle}` : `${def.apFire}`;
  const parts = [`fire ${fire} AP`, `reload ${def.apReload} AP`];
  if (def.pellets) parts.push(`${def.pellets} rds/pull`);
  return parts.join(" · ");
}

export interface BandRow {
  /** "0–4" spans, then a terminal "8+" out-of-range row with dpa null. */
  span: string;
  dpa: number | null;
}

/** The band table for the overlay: real dmg/AP per band, then the cliff. */
export function bandRows(def: WeaponDef): BandRow[] {
  let prev = 0;
  const rows: BandRow[] = def.bands.map((band) => {
    const row: BandRow = { span: `${prev}–${band.maxDist}`, dpa: dmgPerAp(def, band.maxDist) };
    prev = band.maxDist;
    return row;
  });
  rows.push({ span: `${prev}+`, dpa: null });
  return rows;
}

/** The rare-flag line: only what this gun does that others don't. */
export function traitLine(def: WeaponDef): string {
  const traits: string[] = [];
  if (def.armorPierce) traits.push(`AP ${def.armorPierce}`);
  if (def.bayonet) traits.push(`BAYONET ${def.bayonet}`);
  if (def.boltAction) traits.push("BOLT");
  if (def.reloadDiscards) traits.push("DUMPS CLIP");
  if (def.bracedBonus) traits.push(`BRACED +${Math.round(def.bracedBonus * 100)}%`);
  return traits.join(" · ");
}
