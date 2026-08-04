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
  //
  // Ceil, never round: band edges are integers and bandFor tests dist <= max,
  // so ceil(dist) always lands in the band the sim will actually roll. Round
  // put the caret at 4.1 on the bright side of a boundary the shot had
  // already crossed (and a diagonal-adjacent 1.41 on the point-blank cell).
  const caret = targetDist === null ? null : Math.max(1, Math.min(STRIP_AXIS, Math.ceil(targetDist)));
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

/** "fire 1+1 AP · reload 2 AP" — the costs the card never showed. */
export function costLine(def: WeaponDef): string {
  // A bolt gun's fire cost is honest only as fire+cycle; the cycle can be
  // deferred, never skipped (§ arsenal: the -12% premium already prices it).
  const fire = def.boltAction ? `${def.apFire}+${AP_COSTS.cycle}` : `${def.apFire}`;
  return `fire ${fire} AP · reload ${def.apReload} AP`;
}

/** The sidebar variant: costs plus the pull size, one line. */
export function apLine(def: WeaponDef): string {
  return def.pellets ? `${costLine(def)} · ${def.pellets} rds/pull` : costLine(def);
}

export interface BandRow {
  /** "0–4" spans, then a terminal "8+" out-of-range row, all stats null. */
  span: string;
  /** Effective hit chance in this band (base × band mult), 0–1. */
  acc: number | null;
  /** Per-round damage in this band (base × band mult). */
  dmg: number | null;
  dpa: number | null;
  /** The gun's home band, straight from the data's intendedBand. */
  intended?: true;
}

/**
 * The band table for the overlay: the numbers the sim actually rolls, band by
 * band, then the cliff. The out-row's stats are null, not zero — past the
 * last band there is no roll at all, and 0% would imply the curve continues.
 */
export function bandRows(def: WeaponDef): BandRow[] {
  let prev = 0;
  const rows: BandRow[] = def.bands.map((band, i) => {
    const row: BandRow = {
      span: `${prev}–${band.maxDist}`,
      acc: def.baseAccuracy * band.accMult,
      dmg: def.damage * band.dmgMult,
      dpa: dmgPerAp(def, band.maxDist),
      ...(i === def.intendedBand ? { intended: true as const } : {}),
    };
    prev = band.maxDist;
    return row;
  });
  rows.push({ span: `${prev}+`, acc: null, dmg: null, dpa: null });
  return rows;
}

/**
 * One worked example of the dmg/AP arithmetic, at the gun's home band, in the
 * gun's true form — the Uzi shows its "4 rds ×" term, a bolt gun shows
 * "÷ (1+1) AP". Teaches the formula once; the table is legible after that.
 */
export function formulaLine(def: WeaponDef): string {
  const band = def.bands[def.intendedBand ?? 0]!;
  const dpa = dmgPerAp(def, band.maxDist);
  const dmg = (def.damage * band.dmgMult).toFixed(1);
  const acc = Math.round(def.baseAccuracy * band.accMult * 100);
  const ap = def.boltAction ? `(${def.apFire}+${AP_COSTS.cycle})` : `${def.apFire}`;
  const rds = def.pellets ? `${def.pellets} rds × ` : "";
  return `${dpa.toFixed(2)} = ${rds}${dmg} dmg × ${acc}% ÷ ${ap} AP`;
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
