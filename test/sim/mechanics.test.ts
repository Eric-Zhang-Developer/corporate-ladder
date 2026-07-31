import { describe, expect, it } from "vitest";
import { AP_COSTS } from "../../src/data/costs";
import { WEAPONS, dmgPerAp, sustainedApPerShot, weaponDef } from "../../src/data/weapons";
import { apToFire, fireWeapon, meleeAttack } from "../../src/sim/combat";
import { createSimRng } from "../../src/sim/rng";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState } from "./helpers";

function alwaysHits() {
  return { next: () => 0, getState: () => [0, 0, 0, 1] };
}
function neverHits() {
  return { next: () => 0.999, getState: () => [0, 0, 0, 1] };
}

describe("bolt action", () => {
  it("fires for apFire and leaves the bolt open", () => {
    const target = makeEnemy({ x: 6, y: 2, hp: 40 });
    const state = makeState({
      player: { weaponId: "mosin", ammoInMag: 5, slots: [{ weaponId: "mosin", ammoInMag: 5 }, null, null] },
      enemies: [target],
    });
    const before = state.player.ap;
    fireWeapon(state, alwaysHits(), state.player, target);
    expect(state.player.ap).toBe(before - WEAPONS.mosin.apFire);
    expect(state.player.chambered).toBe(false);
  });

  it("auto-cycles when fired with the bolt open, charging both", () => {
    const target = makeEnemy({ x: 6, y: 2, hp: 40 });
    const state = makeState({
      player: { weaponId: "mosin", ammoInMag: 5, chambered: false },
      enemies: [target],
    });
    expect(apToFire(state.player, WEAPONS.mosin)).toBe(WEAPONS.mosin.apFire + AP_COSTS.cycle);
    const before = state.player.ap;
    fireWeapon(state, alwaysHits(), state.player, target);
    expect(state.player.ap).toBe(before - WEAPONS.mosin.apFire - AP_COSTS.cycle);
    expect(state.log.join(" ")).toContain("work the bolt");
  });

  it("lets the cycle be deferred across a turn — shoot, move, regret it", () => {
    const target = makeEnemy({ x: 6, y: 2, hp: 40 });
    const state = makeState({
      player: { weaponId: "mosin", ammoInMag: 5, slots: [{ weaponId: "mosin", ammoInMag: 5 }, null, null] },
      enemies: [target],
    });
    applyAction(state, { type: "fire", targetId: target.id }); // 1 AP
    applyAction(state, { type: "move", dx: 0, dy: 1 }); // 1 AP
    expect(state.player.chambered).toBe(false);
    applyAction(state, { type: "move", dx: 0, dy: 1 }); // 1 AP, turn ends
    // The open bolt survives the refill: next fight starts unchambered.
    expect(state.player.chambered).toBe(false);
    expect(state.player.ap).toBe(state.player.maxAp);
  });

  it("R works the bolt instead of reloading when the bolt is open", () => {
    const state = makeState({
      player: { weaponId: "mosin", ammoInMag: 4, chambered: false },
    });
    const before = state.player.ap;
    applyAction(state, { type: "reload" });
    expect(state.player.chambered).toBeUndefined();
    expect(state.player.ammoInMag).toBe(4); // cycled, not reloaded
    expect(state.player.ap).toBe(before - AP_COSTS.cycle);
  });

  it("a fresh magazine closes the bolt", () => {
    const state = makeState({
      player: { weaponId: "mosin", ammoInMag: 2, chambered: false },
      ammo: { pistol: 0, shell: 0, rifle: 0, heavy: 10 },
    });
    applyAction(state, { type: "reload" }); // cycles first
    applyAction(state, { type: "reload" }); // now actually reloads
    expect(state.player.ammoInMag).toBe(WEAPONS.mosin.magSize);
    expect(state.player.chambered).toBeUndefined();
  });

  it("the balance spreadsheet amortizes the cycle rather than crediting the split", () => {
    expect(sustainedApPerShot(WEAPONS.mosin)).toBe(2);
    expect(sustainedApPerShot(WEAPONS.glock)).toBe(1);
    // Splitting 2 AP into fire+cycle must not double the Mosin's dmg/AP.
    expect(dmgPerAp(WEAPONS.mosin, 5)).toBeCloseTo((8 * 0.9 * 1.0) / 2, 5);
  });

  it("swapping preserves the open bolt in the slot", () => {
    const state = makeState({
      player: {
        weaponId: "mosin",
        ammoInMag: 4,
        chambered: false,
        slots: [
          { weaponId: "mosin", ammoInMag: 4 },
          { weaponId: "glock", ammoInMag: 7 },
          null,
        ],
        activeSlot: 0,
      },
    });
    applyAction(state, { type: "swap", slot: 1 });
    expect(state.player.chambered).toBeUndefined(); // the Glock has no bolt
    expect(state.player.slots?.[0]?.chambered).toBe(false);
    applyAction(state, { type: "swap", slot: 0 });
    expect(state.player.chambered).toBe(false); // still open when drawn again
  });
});

describe("bayonet", () => {
  it("replaces the knife while its rifle is held, and still ignores armor", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 40, armor: 3 });
    const state = makeState({ player: { weaponId: "sks", ammoInMag: 10 }, enemies: [target] });
    meleeAttack(state, createSimRng(1), state.player, target);
    expect(target.hp).toBe(40 - WEAPONS.sks.bayonet);
    expect(state.log.at(-1)).toContain("bayonet");
  });

  it("falls back to the knife with any other gun in hand", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 40 });
    const state = makeState({ enemies: [target] });
    meleeAttack(state, createSimRng(1), state.player, target);
    expect(state.log.at(-1)).toContain("knife");
  });
});

describe("en-bloc reload", () => {
  it("throws away the rounds left in the clip and says so", () => {
    const state = makeState({
      player: { weaponId: "garand", ammoInMag: 3 },
      ammo: { pistol: 0, shell: 0, rifle: 0, heavy: 20 },
    });
    applyAction(state, { type: "reload" });
    expect(state.player.ammoInMag).toBe(WEAPONS.garand.magSize);
    // A full clip was drawn from reserve; the 3 left in the gun are gone.
    expect(state.ammo.heavy).toBe(20 - WEAPONS.garand.magSize);
    expect(state.log.at(-1)).toContain("3 rounds wasted");
  });

  it("wastes nothing when shot dry", () => {
    const state = makeState({
      player: { weaponId: "garand", ammoInMag: 0 },
      ammo: { pistol: 0, shell: 0, rifle: 0, heavy: 20 },
    });
    applyAction(state, { type: "reload" });
    expect(state.log.at(-1)).not.toContain("wasted");
  });
});

describe("braced fire", () => {
  it("only applies when the shooter spent no AP moving this turn", () => {
    const shots = (moved: boolean) => {
      const target = makeEnemy({ x: 5, y: 2, hp: 500 });
      const state = makeState({
        player: { weaponId: "m249", ammoInMag: 50, ...(moved ? { movedThisTurn: true } : {}) },
        enemies: [target],
      });
      // 0.75 sits between the unbraced (0.612) and braced (0.762) accuracies,
      // so the same rolls hit only when braced.
      fireWeapon(state, { next: () => 0.75, getState: () => [0, 0, 0, 1] }, state.player, target);
      return 500 - target.hp;
    };
    expect(shots(true)).toBe(0);
    expect(shots(false)).toBeGreaterThan(0);
  });

  it("moving sets the flag and the refill clears it", () => {
    const state = makeState({ player: { weaponId: "m249", ammoInMag: 50 } });
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    expect(state.player.movedThisTurn).toBe(true);
    applyAction(state, { type: "wait" }); // ends the turn -> refill
    expect(state.player.movedThisTurn).toBeUndefined();
  });

  it("never pushes accuracy above certainty", () => {
    const target = makeEnemy({ x: 2, y: 3, hp: 500 });
    const state = makeState({ player: { weaponId: "m249", ammoInMag: 50 }, enemies: [target] });
    fireWeapon(state, neverHits(), state.player, target);
    expect(target.hp).toBe(500); // a 0.999 roll still misses a ~0.79 chance
  });
});
