import { describe, expect, it } from "vitest";
import { ENEMIES, enemyDef } from "../../src/data/enemies";
import { CALIBERS } from "../../src/data/floors";
import { WEAPONS, dmgPerAp, dmgPerApVs, weaponDef } from "../../src/data/weapons";
import { fireWeapon, meleeAttack } from "../../src/sim/combat";
import { createSimRng } from "../../src/sim/rng";
import { makeEnemy, makeState } from "./helpers";

/** A rig where every shot lands, so damage maths are exact rather than sampled. */
function alwaysHits() {
  return { next: () => 0, getState: () => [0, 0, 0, 1] };
}

describe("armor as flat per-pellet DR", () => {
  it("taxes each pellet separately — the spray weapon folds, the revolver does not", () => {
    // Uzi: 4 pellets x 3 damage. Against armor 3 every pellet is fully absorbed.
    const target = makeEnemy({ x: 3, y: 2, hp: 40, armor: 3 });
    const state = makeState({ player: { weaponId: "uzi", ammoInMag: 20 }, enemies: [target] });
    fireWeapon(state, alwaysHits(), state.player, target);
    expect(target.hp).toBe(40);
    expect(state.log.at(-1)).toContain("clatter off");

    // Revolver: one 5-damage round, same armor, still lands 2.
    const target2 = makeEnemy({ x: 3, y: 2, hp: 40, armor: 3 });
    const state2 = makeState({ player: { weaponId: "revolver", ammoInMag: 6 }, enemies: [target2] });
    fireWeapon(state2, alwaysHits(), state2.player, target2);
    expect(target2.hp).toBe(38);
  });

  it("still costs a spray far more of itself than a single heavy round", () => {
    // The claim in expectation rather than on a rigged always-hit roll: the
    // ammo premium raised the Uzi's per-pellet damage, so the gap narrowed —
    // but plate must still hurt the spray roughly twice as much.
    const uziKept = dmgPerApVs(WEAPONS.uzi, 3, 2) / dmgPerAp(WEAPONS.uzi, 3);
    const revolverKept = dmgPerApVs(WEAPONS.revolver, 3, 2) / dmgPerAp(WEAPONS.revolver, 3);
    expect(uziKept).toBeLessThan(revolverKept * 0.75);
  });

  it("partially absorbs rather than zeroing when the pellet outweighs the plate", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 40, armor: 1 });
    const state = makeState({ player: { weaponId: "uzi", ammoInMag: 20 }, enemies: [target] });
    fireWeapon(state, alwaysHits(), state.player, target);
    // 4 pellets, each 3 - 1 = 2.
    expect(target.hp).toBe(32);
  });

  it("armorPierce is subtracted from armor before the reduction, never below zero", () => {
    const piercing = { ...weaponDef("revolver"), id: "test_pierce", armorPierce: 3 };
    expect(dmgPerApVs(piercing, 3, 2)).toBeCloseTo(dmgPerAp(piercing, 3), 6);
    // Overkill pierce does not turn into bonus damage.
    expect(dmgPerApVs(piercing, 3, 0)).toBeCloseTo(dmgPerAp(piercing, 3), 6);
  });

  it("blades ignore armor entirely — gaps in the plate", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 40, armor: 4 });
    const state = makeState({ enemies: [target] });
    meleeAttack(state, createSimRng(1), state.player, target);
    expect(target.hp).toBe(38); // full KNIFE damage, undiminished
  });

  it("an unarmored target is unaffected by the new code path", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 40 });
    const state = makeState({ player: { weaponId: "revolver", ammoInMag: 6 }, enemies: [target] });
    fireWeapon(state, alwaysHits(), state.player, target);
    expect(target.hp).toBe(35);
  });
});

describe("data integrity after the caliber migration", () => {
  it("every weapon's caliber is one of the four channels", () => {
    for (const weapon of Object.values(WEAPONS)) {
      expect(CALIBERS).toContain(weapon.caliber);
    }
  });

  it("every ammo drop names a real channel", () => {
    for (const id of Object.keys(ENEMIES)) {
      for (const drop of enemyDef(id).drops ?? []) {
        if (drop.ammo) expect(CALIBERS).toContain(drop.ammo.caliber);
      }
    }
  });

  it("machines are flagged so EMP/flashbang targeting has something to read", () => {
    expect(enemyDef("camera").machine).toBe(true);
    expect(enemyDef("rentacop").machine).toBeUndefined();
  });
});
