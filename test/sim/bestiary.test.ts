import { describe, expect, it } from "vitest";
import { ENEMIES, enemyDef, type EnemyDef } from "../../src/data/enemies";
import { FLOORS } from "../../src/data/floors";
import { bandFor, weaponDef } from "../../src/data/weapons";
import { CAMERA_WAVE_CAP } from "../../src/sim/ai";
import { buildFloor } from "../../src/sim/floor";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState, openMap } from "./helpers";

/**
 * The bestiary's half of the §8 contract. Enemy lethality is tuned by data —
 * their own weapon entries and melee numbers — never by special-casing combat,
 * so it can be checked here rather than played for.
 */
const ANCHORS: Record<number, number> = { 1: 3, 2: 4.5, 3: 6.5, 4: 8.5 };

/**
 * Damage from ONE connecting attack — the anchor is about how hard a hit lands,
 * not how often, so accuracy is deliberately left out.
 */
function damagePerHit(def: EnemyDef): number {
  if (def.weaponId) {
    const w = weaponDef(def.weaponId);
    const band = bandFor(w, def.preferredRange ?? 3) ?? w.bands[w.bands.length - 1]!;
    return (w.pellets ?? 1) * w.damage * band.dmgMult;
  }
  return def.meleeDamage ?? def.detonateDamage ?? 0;
}

/**
 * The anchor governs enemies whose threat IS their damage. Three roles are
 * exempt by design, not by convenience: chaff stays soft on every floor so the
 * pistol contract holds; the taser's threat is a stolen turn attached to
 * deliberately trivial damage; and a detonator spends its life on one hit.
 */
function anchorApplies(def: EnemyDef): boolean {
  if (def.boss) return false;
  if (def.xp <= 3) return false;
  if (def.apDrainOnHit) return false;
  if (def.behavior === "detonate") return false;
  return damagePerHit(def) > 0;
}

/** Which tier an enemy belongs to, from the floors that spawn it. */
function tierOf(id: string): number | null {
  const depths = FLOORS.filter((f) => id in f.weights || f.boss === id).map((f) => f.depth);
  if (depths.length === 0) return null;
  return Math.ceil(Math.min(...depths) / 2);
}

describe("damage anchors", () => {
  it("every enemy hits within ±40% of its tier's anchor", () => {
    for (const id of Object.keys(ENEMIES)) {
      const def = enemyDef(id);
      const tier = tierOf(id);
      if (tier === null || !anchorApplies(def)) continue;
      const anchor = ANCHORS[tier];
      if (!anchor) continue;
      const hit = damagePerHit(def);
      expect(hit, `${id} hits for ${hit.toFixed(1)} vs T${tier} anchor ${anchor}`)
        .toBeGreaterThan(anchor * 0.6);
      expect(hit, `${id} hits for ${hit.toFixed(1)} vs T${tier} anchor ${anchor}`)
        .toBeLessThan(anchor * 1.4);
    }
  });

  it("every enemy is worth XP, and bosses are worth much more", () => {
    for (const id of Object.keys(ENEMIES)) expect(enemyDef(id).xp, id).toBeGreaterThan(0);
    expect(enemyDef("janitor").xp).toBeGreaterThanOrEqual(25);
    expect(enemyDef("handler").xp).toBeGreaterThanOrEqual(25);
  });
});

describe("the machine contract", () => {
  it("machines never pay cash — capital expenditure is not salaried", () => {
    for (const id of Object.keys(ENEMIES)) {
      const def = enemyDef(id);
      if (!def.machine) continue;
      expect((def.drops ?? []).some((d) => d.cash), `${id} pays a wage`).toBe(false);
    }
  });

  it("the new machines are flagged and the new humans are not", () => {
    for (const id of ["roomba", "k9", "fpv", "camera"]) {
      expect(enemyDef(id).machine, id).toBe(true);
    }
    for (const id of ["baton", "contractor", "riot", "supervisor", "handler", "janitor"]) {
      expect(enemyDef(id).machine, id).toBeUndefined();
    }
  });
});

describe("the behavior budget (invariant 3's tripwire)", () => {
  it("stays at eight behaviors or fewer", () => {
    const behaviors = new Set(Object.keys(ENEMIES).map((id) => enemyDef(id).behavior));
    // A ninth means a content addition demanded systems code. Consolidate
    // before adding, or replace one on merit.
    expect(behaviors.size).toBeLessThanOrEqual(8);
  });

  it("~15 enemies ride on those few behaviors", () => {
    const count = Object.keys(ENEMIES).length;
    const behaviors = new Set(Object.keys(ENEMIES).map((id) => enemyDef(id).behavior));
    expect(count / behaviors.size).toBeGreaterThan(2.5); // data-to-systems ratio
  });
});

describe("alarms are finite", () => {
  it("a camera goes dark after its waves are spent", () => {
    const camera = makeEnemy({ defId: "camera", x: 5, y: 2, hp: 1, weaponId: null as never, ap: 0 });
    const state = makeState({ map: openMap(20, 12), enemies: [camera] });
    let waves = 0;
    let lastCount = state.enemies.length;
    for (let i = 0; i < 40; i++) {
      applyAction(state, { type: "wait" });
      if (state.enemies.length > lastCount) waves += 1;
      lastCount = state.enemies.length;
    }
    expect(waves).toBeLessThanOrEqual(CAMERA_WAVE_CAP);
    expect(camera.alarmWaves).toBeLessThanOrEqual(CAMERA_WAVE_CAP);
  });

  it("the supervisor calls exactly one", () => {
    expect(enemyDef("supervisor").alarmWaves).toBe(1);
  });
});

describe("bosses", () => {
  it("the Janitor left the regular pool and became an event", () => {
    for (const floor of FLOORS) expect(floor.weights).not.toHaveProperty("janitor");
    expect(FLOORS.find((f) => f.depth === 2)?.boss).toBe("janitor");
    expect(enemyDef("janitor").boss).toBe(true);
  });

  it("spawn exactly once on their floor, with their escorts", () => {
    for (const seed of [1, 7, 42]) {
      const build = buildFloor(seed, 4, 100, ["pistol"]);
      const handlers = build.enemies.filter((e) => e.defId === "handler");
      expect(handlers, `seed ${seed}`).toHaveLength(1);
      const dogs = build.enemies.filter((e) => e.defId === "k9");
      expect(dogs.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("never appear on a floor that does not name them", () => {
    const build = buildFloor(1, 1, 100, ["pistol"]);
    expect(build.enemies.some((e) => enemyDef(e.defId).boss)).toBe(false);
  });
});

describe("the FPV drone", () => {
  it("trades itself for a blast when it reaches you", () => {
    const drone = makeEnemy({ defId: "fpv", x: 3, y: 2, hp: 1, weaponId: null as never, ap: 4 });
    const state = makeState({ map: openMap(16, 12), enemies: [drone], player: { hp: 40, maxHp: 40 } });
    applyAction(state, { type: "wait" }); // it spots (spending the turn)
    applyAction(state, { type: "wait" }); // it closes and detonates
    expect(state.enemies).toHaveLength(0); // it is the cost
    expect(state.player.hp).toBeLessThan(40);
  });
});
