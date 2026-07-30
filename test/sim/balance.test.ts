import { describe, expect, it } from "vitest";
import { dmgPerAp, WEAPONS, type WeaponDef } from "../../src/data/weapons";

/**
 * §6 rule 4 and §8 as CI: damage-per-AP within a tier stays within ±20%
 * at each weapon's intended band and falls off a cliff outside it. Any
 * buff that breaks the window fails here before it ships.
 */
const TIER1 = [WEAPONS.revolver, WEAPONS.uzi, WEAPONS.serbu, WEAPONS.mosin];

function intendedMidpoint(def: WeaponDef): number {
  const i = def.intendedBand ?? 0;
  const lo = i === 0 ? 1 : def.bands[i - 1]!.maxDist + 1;
  const hi = def.bands[i]!.maxDist;
  return (lo + hi) / 2;
}

describe("tier-1 balance window", () => {
  const values = TIER1.map((w) => dmgPerAp(w, intendedMidpoint(w)));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  it("every tier-1 weapon sits within ±20% of the tier mean at its intended band", () => {
    TIER1.forEach((w, i) => {
      const v = values[i]!;
      expect(v, `${w.name} dmg/AP ${v.toFixed(2)} vs tier mean ${mean.toFixed(2)}`).toBeGreaterThanOrEqual(mean * 0.8);
      expect(v, `${w.name} dmg/AP ${v.toFixed(2)} vs tier mean ${mean.toFixed(2)}`).toBeLessThanOrEqual(mean * 1.2);
    });
  });

  it("tier 1 is a generational step over the Glock", () => {
    const glock = dmgPerAp(WEAPONS.glock, intendedMidpoint(WEAPONS.glock));
    expect(mean).toBeGreaterThan(glock * 1.25);
  });
});

describe("range-band cliffs (patterns, not numbers — §2 pillar 2)", () => {
  it("Serbu is devastating at 1 and a paperweight at 3", () => {
    expect(dmgPerAp(WEAPONS.serbu, 1)).toBeGreaterThan(4);
    expect(dmgPerAp(WEAPONS.serbu, 3)).toBeLessThan(1);
  });

  it("Mosin hates adjacency", () => {
    const intended = dmgPerAp(WEAPONS.mosin, intendedMidpoint(WEAPONS.mosin));
    expect(dmgPerAp(WEAPONS.mosin, 1)).toBeLessThan(intended * 0.6);
  });

  it("Uzi sprays to nothing at range", () => {
    const intended = dmgPerAp(WEAPONS.uzi, intendedMidpoint(WEAPONS.uzi));
    expect(dmgPerAp(WEAPONS.uzi, 5)).toBeLessThanOrEqual(intended * 0.5);
  });

  it("Uzi pays for revolver-parity dmg/AP with 4x the ammo burn", () => {
    const uziPerRound = dmgPerAp(WEAPONS.uzi, 2.5) / (WEAPONS.uzi.pellets ?? 1);
    const revolverPerRound = dmgPerAp(WEAPONS.revolver, 3);
    expect(uziPerRound).toBeLessThan(revolverPerRound / 3);
  });
});
