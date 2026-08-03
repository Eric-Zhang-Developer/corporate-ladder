import { describe, expect, it } from "vitest";
import { enemyDef, ENEMIES } from "../../src/data/enemies";
import { HP_PER_PROMOTION, PERKS, PERK_IDS, PERK_OFFER_SIZE, xpForLevel } from "../../src/data/perks";
import { newGame } from "../../src/sim/floor";
import { fireWeapon, meleeAttack } from "../../src/sim/combat";
import { createSimRng } from "../../src/sim/rng";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState } from "./helpers";

function alwaysHits() {
  return { next: () => 0, getState: () => [0, 0, 0, 1] };
}

/** Drives a state to the brink of a promotion without touching the perk code. */
function atThreshold(opts: Parameters<typeof makeState>[0] = {}) {
  return makeState({ ...opts, xp: xpForLevel(2) - 1, level: 1 });
}

describe("XP and thresholds", () => {
  it("every enemy is worth something, scaled to its role", () => {
    for (const id of Object.keys(ENEMIES)) {
      expect(enemyDef(id).xp, id).toBeGreaterThan(0);
    }
    expect(enemyDef("camera").xp).toBeLessThan(enemyDef("rentacop").xp);
    expect(enemyDef("janitor").xp).toBeGreaterThan(enemyDef("rentacop").xp);
  });

  it("thresholds rise with each promotion", () => {
    for (let level = 3; level <= 9; level++) {
      expect(xpForLevel(level)).toBeGreaterThan(xpForLevel(level - 1));
    }
  });

  it("a kill grants XP — including a quiet one, so stealth never starves", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = makeState({ enemies: [target] });
    meleeAttack(state, createSimRng(1), state.player, target);
    expect(state.xp).toBe(enemyDef("rentacop").xp);
  });
});

describe("the promotion itself", () => {
  it("raises max HP, heals fully, and pauses the game for the review", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = atThreshold({ enemies: [target], player: { hp: 2 } });
    const maxBefore = state.player.maxHp;
    applyAction(state, { type: "move", dx: 1, dy: 0 }); // bump-kill
    applyAction(state, { type: "wait" }); // end the turn; review lands between turns
    expect(state.level).toBe(2);
    expect(state.player.maxHp).toBe(maxBefore + HP_PER_PROMOTION);
    expect(state.player.hp).toBe(state.player.maxHp); // the pressure-release valve
    expect(state.phase).toBe("promoting");
    expect(state.perkOffer).toHaveLength(PERK_OFFER_SIZE);
  });

  it("refuses every action except choosing, then resumes", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = atThreshold({ enemies: [target] });
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    applyAction(state, { type: "wait" });
    expect(state.phase).toBe("promoting");

    const frozen = JSON.parse(JSON.stringify(state));
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    applyAction(state, { type: "fire" });
    expect(state).toEqual(frozen); // the tower waits

    applyAction(state, { type: "choosePerk", perkId: state.perkOffer![0]! });
    expect(state.phase).toBe("playing");
    expect(state.perks).toEqual([frozen.perkOffer[0]]);
    expect(state.perkOffer).toBeUndefined();
  });

  it("ignores a perk that was not on the menu", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = atThreshold({ enemies: [target] });
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    applyAction(state, { type: "wait" });
    const notOffered = PERK_IDS.find((id) => !state.perkOffer!.includes(id))!;
    applyAction(state, { type: "choosePerk", perkId: notOffered });
    expect(state.phase).toBe("promoting");
    expect(state.perks).toEqual([]);
  });

  it("offers derive from the seed, not from sim history", () => {
    const offers = (seed: number) => {
      const s = makeState({ seed, xp: xpForLevel(2) - 1, enemies: [makeEnemy({ x: 3, y: 2, hp: 1 })] });
      applyAction(s, { type: "move", dx: 1, dy: 0 });
      applyAction(s, { type: "wait" });
      return s.perkOffer;
    };
    expect(offers(4242)).toEqual(offers(4242));
  });

  it("never offers a certification twice", () => {
    const state = newGame(31337);
    state.perks = [...PERK_IDS.slice(0, 3)];
    state.xp = xpForLevel(2);
    applyAction(state, { type: "wait" });
    for (const id of state.perkOffer ?? []) expect(state.perks).not.toContain(id);
  });
});

describe("perk touchpoints", () => {
  it("Corporate Wellness raises the ceiling on top of the promotion", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = atThreshold({ enemies: [target] });
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    applyAction(state, { type: "wait" });
    state.perkOffer = ["wellness"];
    const before = state.player.maxHp;
    applyAction(state, { type: "choosePerk", perkId: "wellness" });
    expect(state.player.maxHp).toBe(before + PERKS.wellness.value);
  });

  it("Severance Bonus applies only to the shot that gives you away", () => {
    const shoot = (perks: string[], alerted: boolean) => {
      const target = makeEnemy({ x: 3, y: 2, hp: 60, alerted });
      const state = makeState({ perks, player: { weaponId: "revolver", ammoInMag: 6 }, enemies: [target] });
      fireWeapon(state, alwaysHits(), state.player, target);
      return 60 - target.hp;
    };
    expect(shoot(["severance"], false)).toBe(shoot([], false) + PERKS.severance.value);
    expect(shoot(["severance"], true)).toBe(shoot([], true)); // already spotted: nothing
  });

  it("Letter Opener sharpens both the knife and the bayonet", () => {
    const stab = (perks: string[], weaponId: string | null) => {
      const target = makeEnemy({ x: 3, y: 2, hp: 60 });
      const state = makeState({ perks, player: { weaponId, ammoInMag: 10 }, enemies: [target] });
      meleeAttack(state, createSimRng(1), state.player, target);
      return 60 - target.hp;
    };
    expect(stab(["letter_opener"], null)).toBe(stab([], null) + PERKS.letter_opener.value);
    expect(stab(["letter_opener"], "sks")).toBe(stab([], "sks") + PERKS.letter_opener.value);
  });

  it("IT Certification only helps against machines", () => {
    const shoot = (perks: string[], defId: string) => {
      const target = makeEnemy({ defId, x: 3, y: 2, hp: 60, weaponId: null as never });
      const state = makeState({ perks, player: { weaponId: "revolver", ammoInMag: 6 }, enemies: [target] });
      fireWeapon(state, alwaysHits(), state.player, target);
      return 60 - target.hp;
    };
    expect(shoot(["it_cert"], "camera")).toBe(shoot([], "camera") + PERKS.it_cert.value);
    expect(shoot(["it_cert"], "janitor")).toBe(shoot([], "janitor"));
  });

  it("Time Management shaves an AP off reloads but never below one", () => {
    const state = makeState({
      perks: ["time_management"],
      player: { weaponId: "revolver", ammoInMag: 0 },
    });
    applyAction(state, { type: "reload" });
    expect(state.player.ap).toBe(state.player.maxAp - 1); // revolver is 2 AP normally

    const glock = makeState({ perks: ["time_management"], player: { ammoInMag: 0 } });
    applyAction(glock, { type: "reload" });
    expect(glock.player.ap).toBe(glock.player.maxAp - 1); // already 1; floored, not zeroed
  });

  it("OSHA Compliance frees the first plate each turn and only the first", () => {
    const state = makeState({ perks: ["osha"], carrierId: "carrier_iii", spareplates: 3 });
    applyAction(state, { type: "plate" });
    expect(state.player.ap).toBe(state.player.maxAp);
    applyAction(state, { type: "plate" });
    expect(state.player.ap).toBe(state.player.maxAp - 1);
  });

  it("Deep Pockets raises the spare-plate cap", () => {
    const state = makeState({
      perks: ["deep_pockets"],
      spareplates: 3,
      items: [{ id: 1, x: 2, y: 2, kind: "plate" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.spareplates).toBe(4);
  });

  it("Golden Parachute saves you once, and only once", () => {
    const state = makeState({ perks: ["golden_parachute"], player: { hp: 2 } });
    const dog = makeEnemy({ defId: "dog", x: 3, y: 2, weaponId: null as never });
    meleeAttack(state, createSimRng(1), dog, state.player);
    expect(state.player.hp).toBe(1);
    expect(state.phase).toBe("playing");

    meleeAttack(state, createSimRng(1), dog, state.player);
    expect(state.phase).toBe("dead");
  });
});

describe("perk lint (the no-multipliers rule as a test)", () => {
  it("no perk carries a factor — every magnitude is absolute", () => {
    for (const id of PERK_IDS) {
      const def = PERKS[id as keyof typeof PERKS] as Record<string, unknown>;
      for (const key of Object.keys(def)) {
        expect(key, `${id}.${key} smells like a multiplier`).not.toMatch(/mult|factor|scale|percent/i);
      }
    }
  });

  it("no perk grants max AP — the one reward that would beat every other", () => {
    for (const id of PERK_IDS) {
      const blurb = PERKS[id as keyof typeof PERKS].blurb.toLowerCase();
      expect(blurb, id).not.toMatch(/maximum ap|\+1 max/);
    }
  });
});
