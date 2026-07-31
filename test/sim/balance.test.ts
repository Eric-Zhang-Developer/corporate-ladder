import { describe, expect, it } from "vitest";
import {
  WEAPONS,
  ammoPremium,
  dmgPerAp,
  dmgPerApVs,
  roundsPerAp,
  sustainedApPerShot,
  weaponDef,
  type WeaponDef,
} from "../../src/data/weapons";

/**
 * §6 rule 4 and §8 as CI: the balance spreadsheet, executable. Guns are
 * compared only within a tier, and the currency is expected damage per AP at
 * the band the gun was designed to fight in. Any buff that breaks a window
 * fails here before it ships.
 *
 * The window is SLOPED, not flat (§10): a gun's target is its tier baseline
 * scaled by an ammo premium, because AP renews every turn and ammo does not.
 * Damage-per-AP parity between a revolver and an Uzi looked fair and meant the
 * Uzi was never worth firing.
 *
 * Two sanctioned exemptions, both design decisions rather than fudge:
 *   - Pistols sit off the tier curve entirely. They cap at T2 and stay
 *     relevant through the chaff economy, not through stats.
 *   - Shotguns run hot at their intended band; the cliff past it is the price.
 */
const PLAYER_GUNS: WeaponDef[] = Object.keys(WEAPONS)
  .map(weaponDef)
  .filter((w) => w.tier !== undefined && w.tier > 0);

const TIERS = [1, 2, 3, 4] as const;
const WINDOW = 0.2;
const SHOTGUN_HEAT_CAP = 0.25;

/** Midpoint of the band a gun was designed to fight in. */
function intendedMidpoint(def: WeaponDef): number {
  const i = def.intendedBand ?? 0;
  const lo = i === 0 ? 1 : def.bands[i - 1]!.maxDist + 1;
  const hi = def.bands[i]!.maxDist;
  return (lo + hi) / 2;
}

function atIntended(def: WeaponDef): number {
  return dmgPerAp(def, intendedMidpoint(def));
}

function tierGuns(tier: number): WeaponDef[] {
  return PLAYER_GUNS.filter((w) => w.tier === tier);
}

/** Pistols are off the curve, so they must not skew the tier mean either. */
function curveGuns(tier: number): WeaponDef[] {
  return tierGuns(tier).filter((w) => w.cls !== "pistol");
}

/**
 * The tier's damage-per-AP for a gun with no compensating trait: single-shot
 * (no ammo premium), not a shotgun (no heat allowance), and no pierce (which
 * is itself paid for with nominal damage). Those are the guns that define the
 * line everything else is scaled from.
 */
function tierBaseline(tier: number): number {
  const anchors = curveGuns(tier).filter(
    (w) => roundsPerAp(w) === 1 && w.cls !== "shotgun" && !w.armorPierce,
  );
  const pool = anchors.length > 0 ? anchors : curveGuns(tier);
  return pool.reduce((sum, w) => sum + atIntended(w), 0) / pool.length;
}

/** Where this gun should sit: baseline, scaled for ammo burn and shotgun heat. */
function targetFor(gun: WeaponDef): number {
  const heat = gun.cls === "shotgun" ? 1 + SHOTGUN_HEAT_CAP * 0.6 : 1;
  return tierBaseline(gun.tier!) * (1 + ammoPremium(gun)) * heat;
}

describe("tier windows", () => {
  for (const tier of TIERS) {
    it(`every T${tier} weapon sits inside its ammo-adjusted window`, () => {
      for (const gun of curveGuns(tier)) {
        const value = atIntended(gun);
        const target = targetFor(gun);
        const label =
          `${gun.name} (R=${roundsPerAp(gun)}, premium ${(ammoPremium(gun) * 100).toFixed(0)}%) ` +
          `is ${value.toFixed(2)} vs target ${target.toFixed(2)}`;
        expect(value, label).toBeGreaterThanOrEqual(target * (1 - WINDOW));
        expect(value, label).toBeLessThanOrEqual(target * (1 + WINDOW));
      }
    });
  }

  it("each tier is a generational step over the one below", () => {
    expect(tierBaseline(1)).toBeGreaterThan(atIntended(weaponDef("glock")) * 1.25);
    for (const tier of [2, 3, 4] as const) {
      const step = tierBaseline(tier) / tierBaseline(tier - 1);
      const label = `T${tier} is only ${((step - 1) * 100).toFixed(0)}% over T${tier - 1}`;
      expect(step, label).toBeGreaterThan(1.25);
    }
  });

  it("every tiered gun declares a band it was designed for", () => {
    for (const gun of PLAYER_GUNS) {
      expect(gun.intendedBand ?? 0, gun.name).toBeLessThan(gun.bands.length);
    }
  });
});

describe("the pistol contract", () => {
  const CHAFF_HP = 2; // the custodial-unit profile: soft on every floor, forever
  const pistols = PLAYER_GUNS.filter((w) => w.cls === "pistol");

  it("caps at T2 — the class completes instead of inflating", () => {
    for (const p of pistols) expect(p.tier, p.name).toBeLessThanOrEqual(2);
  });

  it("every pistol still deletes chaff in at most two trigger pulls", () => {
    for (const p of pistols) {
      const perPull = atIntended(p) * sustainedApPerShot(p);
      expect(perPull * 2, p.name).toBeGreaterThanOrEqual(CHAFF_HP);
    }
  });

  it("no pistol competes with a same-tier rifle-class gun against elites", () => {
    for (const p of pistols) {
      const rivals = tierGuns(p.tier!).filter((w) => w.cls === "rifle" || w.cls === "dmr");
      for (const rival of rivals) {
        expect(atIntended(p), `${p.name} vs ${rival.name}`).toBeLessThan(atIntended(rival));
      }
    }
  });
});

describe("range-band cliffs (patterns, not numbers — §2 pillar 2)", () => {
  it("every shotgun becomes a paperweight past its band", () => {
    for (const gun of PLAYER_GUNS.filter((w) => w.cls === "shotgun")) {
      const past = dmgPerAp(gun, gun.bands[gun.bands.length - 1]!.maxDist);
      expect(past, `${gun.name} past its cliff`).toBeLessThan(atIntended(gun) * 0.45);
    }
  });

  it("every sniper hates adjacency", () => {
    for (const gun of PLAYER_GUNS.filter((w) => w.cls === "sniper")) {
      expect(dmgPerAp(gun, 1), `${gun.name} at point blank`).toBeLessThan(atIntended(gun) * 0.7);
    }
  });

  it("Serbu is devastating at 1 and a paperweight at 3", () => {
    expect(dmgPerAp(WEAPONS.serbu, 1)).toBeGreaterThan(4);
    expect(dmgPerAp(WEAPONS.serbu, 3)).toBeLessThan(1);
  });

  it("Uzi sprays to nothing at range", () => {
    expect(dmgPerAp(WEAPONS.uzi, 5)).toBeLessThanOrEqual(atIntended(WEAPONS.uzi) * 0.5);
  });

  it("the Uzi buys tempo with ammo — better per AP, far worse per round", () => {
    // The trade the sloped window exists to express. Damage-per-AP parity made
    // this gun strictly worse and nobody fired it.
    const uziPerAp = dmgPerAp(WEAPONS.uzi, 2.5);
    const revolverPerAp = dmgPerAp(WEAPONS.revolver, 3);
    expect(uziPerAp).toBeGreaterThan(revolverPerAp * 1.25);

    const uziPerRound = uziPerAp / (WEAPONS.uzi.pellets ?? 1);
    expect(uziPerRound).toBeLessThan(revolverPerAp * 0.5);
  });

  it("a magazine is counted in trigger pulls, not rounds", () => {
    const pulls = (w: WeaponDef) => Math.floor(w.magSize / (w.pellets ?? 1));
    // An SMG getting fewer pulls than a revolver was the insult no percentage
    // repairs; every spray weapon now gets at least as many.
    for (const gun of PLAYER_GUNS.filter((w) => (w.pellets ?? 1) > 1)) {
      expect(pulls(gun), `${gun.name} gets ${pulls(gun)} pulls`).toBeGreaterThanOrEqual(
        pulls(WEAPONS.revolver),
      );
    }
  });
});

describe("the armored column (§8 — the second axis)", () => {
  /**
   * Two armor profiles, and the distinction matters. 2 is the common armored
   * enemy (riot guard, exo trooper, turret) — the value the roster is expected
   * to have answers for. 4 is the Dozer, which is *designed* to shrug off
   * everything but heavy calibers, so it is the wrong yardstick for asking
   * whether pierce works.
   */
  const COMMON = 2;
  const DOZER = 4;

  /** Fraction of a gun's output that survives flat DR at its intended band. */
  function retention(gun: WeaponDef, armor: number): number {
    return dmgPerApVs(gun, intendedMidpoint(gun), armor) / atIntended(gun);
  }

  it("pierce guns keep more of themselves against common plate than their peers", () => {
    for (const tier of [2, 3, 4] as const) {
      const piercing = tierGuns(tier).filter((w) => (w.armorPierce ?? 0) > 0);
      const plain = tierGuns(tier).filter((w) => (w.armorPierce ?? 0) === 0);
      if (piercing.length === 0 || plain.length === 0) continue;
      const worstPierce = Math.min(...piercing.map((w) => retention(w, COMMON)));
      const meanPlain = plain.reduce((s, w) => s + retention(w, COMMON), 0) / plain.length;
      expect(worstPierce, `T${tier} pierce guns fold like their peers`).toBeGreaterThan(meanPlain);
    }
  });

  it("spray folds against plate where a single heavy hit punches through", () => {
    // Same tier, same ammo channel: only the pellet count differs.
    expect(retention(WEAPONS.m4, COMMON)).toBeLessThan(retention(WEAPONS.akm, COMMON));
  });

  it("the T3 flesh specialist loses to its T4 piercing counterpart on a chassis", () => {
    // The FAL is competitive with the XM7 on soft targets and must not be
    // against armor — a T3 gun beating a T4 gun on the wrong target is the
    // armor axis working, not a balance failure.
    expect(atIntended(WEAPONS.fal)).toBeGreaterThan(atIntended(WEAPONS.xm7) * 0.8);
    expect(dmgPerApVs(WEAPONS.fal, intendedMidpoint(WEAPONS.fal), DOZER)).toBeLessThan(
      dmgPerApVs(WEAPONS.xm7, intendedMidpoint(WEAPONS.xm7), DOZER),
    );
  });

  it("nothing but heavy single hits does honest work on a Dozer", () => {
    // The design promise: only heavy calibers, the AWP, EMPs and blades. The
    // P90 is the deliberate exception — "the only hose that still cuts" is its
    // entire identity and what pierce 2 is paying for — so the claim is about
    // UNPIERCED sprays.
    const sprays = PLAYER_GUNS.filter((w) => (w.pellets ?? 1) >= 3 && !w.armorPierce);
    for (const gun of sprays) {
      expect(retention(gun, DOZER), `${gun.name} still hoses a Dozer`).toBeLessThan(0.25);
    }
    // Even the exception is far worse at it than the gun built for the job.
    expect(dmgPerApVs(WEAPONS.p90, intendedMidpoint(WEAPONS.p90), DOZER)).toBeLessThan(
      dmgPerApVs(WEAPONS.awp, intendedMidpoint(WEAPONS.awp), DOZER),
    );
    expect(retention(WEAPONS.awp, DOZER)).toBeGreaterThan(0.7);
  });
});

describe("bolt amortization", () => {
  it("splitting fire and cycle never buys free damage per AP", () => {
    for (const gun of PLAYER_GUNS.filter((w) => w.boltAction)) {
      expect(sustainedApPerShot(gun), gun.name).toBeGreaterThan(gun.apFire);
    }
  });
});
