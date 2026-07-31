import { describe, expect, it } from "vitest";
import { dmgPerAp, WEAPONS } from "../../src/data/weapons";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState } from "./helpers";

describe("reload from reserve", () => {
  it("moves rounds reserve -> mag and allows partial reloads", () => {
    const state = makeState({
      player: { ammoInMag: 2 },
      ammo: { pistol: 3, shell: 0, rifle: 0, heavy: 0 },
    });
    applyAction(state, { type: "reload" });
    expect(state.player.ammoInMag).toBe(5); // 2 + all 3 reserve, short of mag 7
    expect(state.ammo.pistol).toBe(0);
    expect(state.player.ap).toBe(2);
  });

  it("caps at mag size and leaves the rest in reserve", () => {
    const state = makeState({
      player: { ammoInMag: 0 },
      ammo: { pistol: 24, shell: 0, rifle: 0, heavy: 0 },
    });
    applyAction(state, { type: "reload" });
    expect(state.player.ammoInMag).toBe(WEAPONS.glock.magSize);
    expect(state.ammo.pistol).toBe(24 - WEAPONS.glock.magSize);
  });

  it("is denied free with an empty reserve", () => {
    const state = makeState({
      player: { ammoInMag: 1 },
      ammo: { pistol: 0, shell: 0, rifle: 0, heavy: 0 },
    });
    applyAction(state, { type: "reload" });
    expect(state.player.ap).toBe(3);
    expect(state.player.ammoInMag).toBe(1);
    expect(state.log.at(-1)).toContain("No pistol rounds");
  });
});

describe("pellets (Micro Uzi)", () => {
  const uziPlayer = {
    weaponId: "uzi",
    ammoInMag: 20,
    slots: [{ weaponId: "uzi", ammoInMag: 20 }, null, null],
  };

  it("one pull costs 1 AP and consumes 4 rounds", () => {
    const state = makeState({
      player: { ...uziPlayer },
      enemies: [makeEnemy({ x: 4, y: 2, hp: 999, maxHp: 999 })],
    });
    applyAction(state, { type: "fire" });
    expect(state.player.ap).toBe(2);
    expect(state.player.ammoInMag).toBe(16);
    expect(state.log.at(-1)).toMatch(/spray.*\/4 hit/);
  });

  it("with 3 rounds left, fires only 3 pellets", () => {
    const state = makeState({
      player: { ...uziPlayer, ammoInMag: 3 },
      enemies: [makeEnemy({ x: 4, y: 2, hp: 999, maxHp: 999 })],
    });
    applyAction(state, { type: "fire" });
    expect(state.player.ammoInMag).toBe(0);
    expect(state.log.at(-1)).toMatch(/\/3 hit/);
  });

  it("dmgPerAp accounts for pellets", () => {
    // Uzi at band 2 (dist 3): 4 pellets * 2 dmg * 0.5 * 0.85 = 3.4
    expect(dmgPerAp(WEAPONS.uzi, 3)).toBeCloseTo(3.4);
    // Revolver at band 2: 5 * 0.8 * 0.85 = 3.4 — parity, but 4x the ammo burn
    expect(dmgPerAp(WEAPONS.revolver, 3)).toBeCloseTo(3.4);
  });
});

describe("weapon slots", () => {
  it("swap costs 1 AP and each slot keeps its own mag count", () => {
    const state = makeState({
      player: {
        ammoInMag: 4,
        slots: [
          { weaponId: "glock", ammoInMag: 4 },
          { weaponId: "revolver", ammoInMag: 6 },
          null,
        ],
      },
    });
    applyAction(state, { type: "swap", slot: 1 });
    expect(state.player.ap).toBe(2);
    expect(state.player.weaponId).toBe("revolver");
    expect(state.player.ammoInMag).toBe(6);
    expect(state.player.slots?.[0]).toEqual({ weaponId: "glock", ammoInMag: 4 });

    applyAction(state, { type: "swap", slot: 0 });
    expect(state.player.weaponId).toBe("glock");
    expect(state.player.ammoInMag).toBe(4);
  });

  it("swapping to an empty or current slot is free", () => {
    const state = makeState();
    applyAction(state, { type: "swap", slot: 2 });
    expect(state.player.ap).toBe(3);
    applyAction(state, { type: "swap", slot: 0 });
    expect(state.player.ap).toBe(3);
  });
});

describe("pickup", () => {
  it("ammo goes to the reserve", () => {
    const state = makeState({
      items: [{ id: 1, x: 2, y: 2, kind: "ammo", caliber: "shell", amount: 5 }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.ammo.shell).toBe(5);
    expect(state.items).toHaveLength(0);
    expect(state.player.ap).toBe(2);
  });

  it("a weapon fills an empty slot without changing the active gun", () => {
    const state = makeState({
      items: [{ id: 1, x: 2, y: 2, kind: "weapon", weaponId: "serbu", ammoInMag: 3 }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.player.weaponId).toBe("glock");
    expect(state.player.slots?.[1]).toEqual({ weaponId: "serbu", ammoInMag: 3 });
    expect(state.items).toHaveLength(0);
  });

  it("with all slots full, swaps with the active gun which drops here", () => {
    const state = makeState({
      player: {
        slots: [
          { weaponId: "glock", ammoInMag: 7 },
          { weaponId: "revolver", ammoInMag: 6 },
          { weaponId: "uzi", ammoInMag: 20 },
        ],
      },
      items: [{ id: 1, x: 2, y: 2, kind: "weapon", weaponId: "mosin", ammoInMag: 5 }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.player.weaponId).toBe("mosin");
    expect(state.player.ammoInMag).toBe(5);
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ kind: "weapon", weaponId: "glock", x: 2, y: 2 });
  });

  it("kills drop ammo where the enemy fell", () => {
    const state = makeState({
      enemies: [makeEnemy({ x: 3, y: 2, hp: 1 })],
    });
    for (let i = 0; i < 50 && state.enemies.length > 0; i++) {
      if (state.player.ammoInMag === 0) applyAction(state, { type: "reload" });
      else applyAction(state, { type: "fire" });
    }
    expect(state.enemies).toHaveLength(0);
    const drop = state.items.find((i) => i.kind === "ammo");
    expect(drop).toBeDefined();
    expect(drop).toMatchObject({ x: 3, y: 2, caliber: "pistol" });
  });
});
