import { describe, expect, it } from "vitest";
import { bandFor, dmgPerAp, WEAPONS } from "../../src/data/weapons";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState, openMap, setWall } from "./helpers";

describe("range bands", () => {
  const glock = WEAPONS.glock;

  it("selects the band by distance and rejects out-of-range", () => {
    expect(bandFor(glock, 1)?.accMult).toBe(1.0);
    expect(bandFor(glock, 3)?.accMult).toBe(0.9);
    expect(bandFor(glock, 6)?.accMult).toBe(0.55);
    expect(bandFor(glock, 9)).toBeNull();
  });

  it("computes damage-per-AP (the balance spreadsheet)", () => {
    expect(dmgPerAp(glock, 1)).toBeCloseTo(2.85);
    expect(dmgPerAp(glock, 3)).toBeCloseTo(2.565);
    expect(dmgPerAp(glock, 6)).toBeCloseTo(1.5675);
    expect(dmgPerAp(glock, 9)).toBe(0);
  });
});

describe("fire action", () => {
  it("spends 1 AP and 1 round per shot", () => {
    const state = makeState({ enemies: [makeEnemy({ x: 4, y: 2, hp: 999, maxHp: 999 })] });
    applyAction(state, { type: "fire" });
    expect(state.player.ap).toBe(2);
    expect(state.player.ammoInMag).toBe(6);
  });

  it("clicks for free on an empty magazine", () => {
    const state = makeState({
      player: { ammoInMag: 0 },
      enemies: [makeEnemy({ x: 4, y: 2 })],
    });
    applyAction(state, { type: "fire" });
    expect(state.player.ap).toBe(3);
    expect(state.log.at(-1)).toContain("Click");
  });

  it("costs nothing when no target is in sight", () => {
    const map = openMap();
    setWall(map, 4, 2); // wall between player (2,2) and enemy (6,2)
    const state = makeState({ map, enemies: [makeEnemy({ x: 6, y: 2 })] });
    applyAction(state, { type: "fire" });
    expect(state.player.ap).toBe(3);
    expect(state.player.ammoInMag).toBe(7);
    expect(state.log.at(-1)).toContain("No target");
  });

  it("removes a killed enemy from the state", () => {
    const state = makeState({ enemies: [makeEnemy({ x: 3, y: 2, hp: 1 })] });
    for (let i = 0; i < 100 && state.enemies.length > 0; i++) {
      if (state.player.ammoInMag === 0) applyAction(state, { type: "reload" });
      else applyAction(state, { type: "fire" });
    }
    expect(state.enemies).toHaveLength(0);
    expect(state.log.join(" ")).toContain("collapses");
  });

  it("is deterministic: identical state and actions give identical results", () => {
    const run = () => {
      const state = makeState({ seed: 9, enemies: [makeEnemy({ x: 5, y: 2 })] });
      for (let i = 0; i < 12; i++) {
        if (state.player.ammoInMag === 0) applyAction(state, { type: "reload" });
        else applyAction(state, { type: "fire" });
        if (state.enemies.length === 0) break;
      }
      return state;
    };
    expect(run()).toEqual(run());
  });
});

describe("reload action", () => {
  it("refills the magazine for the weapon's reload cost", () => {
    const state = makeState({ player: { ammoInMag: 2 } });
    applyAction(state, { type: "reload" });
    expect(state.player.ammoInMag).toBe(WEAPONS.glock.magSize);
    expect(state.player.ap).toBe(2);
  });

  it("is free when the magazine is already full", () => {
    const state = makeState();
    applyAction(state, { type: "reload" });
    expect(state.player.ap).toBe(3);
    expect(state.log.at(-1)).toContain("already full");
  });
});
