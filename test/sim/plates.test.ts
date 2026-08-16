import { describe, expect, it } from "vitest";
import { CARRIERS, SPARE_PLATE_CAP, carrierCapacity } from "../../src/data/carriers";
import { AP_COSTS } from "../../src/data/costs";
import { fireWeapon, meleeAttack } from "../../src/sim/combat";
import { createSimRng } from "../../src/sim/rng";
import { newGame } from "../../src/sim/floor";
import { applyAction } from "../../src/sim/step";
import { makeEnemy, makeState } from "./helpers";

function alwaysHits() {
  return { next: () => 0, getState: () => [0, 0, 0, 1] };
}

describe("slotting plates", () => {
  it("starts the SALARIED baseline with one Level I plate inserted", () => {
    const state = newGame(1);
    expect(state.carrierId).toBe(CARRIERS.carrier_i.id);
    expect(state.player.shield).toBe(CARRIERS.carrier_i.plateValue);
    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.spareplates).toBe(0);
  });

  it("costs 1 AP and fills by the carrier's plate value", () => {
    const state = makeState({ carrierId: "carrier_ii", spareplates: 2 });
    const before = state.player.ap;
    applyAction(state, { type: "plate" });
    expect(state.player.shield).toBe(CARRIERS.carrier_ii.plateValue);
    expect(state.spareplates).toBe(1);
    expect(state.player.ap).toBe(before - AP_COSTS.plate);
  });

  it("never exceeds the carrier's capacity", () => {
    const state = makeState({ carrierId: "carrier_ii", spareplates: 3 });
    applyAction(state, { type: "plate" });
    applyAction(state, { type: "plate" });
    expect(state.player.shield).toBe(carrierCapacity("carrier_ii"));
    applyAction(state, { type: "plate" });
    expect(state.log.at(-1)).toContain("carrier is full");
    expect(state.spareplates).toBe(1); // the refused plate is not consumed
  });

  it("is free to attempt with no carrier, no spares, or a full rack", () => {
    const noCarrier = makeState({ spareplates: 2 });
    applyAction(noCarrier, { type: "plate" });
    expect(noCarrier.player.ap).toBe(noCarrier.player.maxAp);
    expect(noCarrier.log.at(-1)).toContain("no plate carrier");

    const noPlates = makeState({ carrierId: "carrier_ii" });
    applyAction(noPlates, { type: "plate" });
    expect(noPlates.player.ap).toBe(noPlates.player.maxAp);
    expect(noPlates.log.at(-1)).toContain("No spare plates");
  });
});

describe("absorption order", () => {
  it("plates soak gunfire before HP and are consumed doing it", () => {
    const state = makeState({
      player: { shield: 8 },
      enemies: [makeEnemy({ x: 4, y: 2, weaponId: "glock_cop" })],
    });
    const shooter = state.enemies[0]!;
    fireWeapon(state, alwaysHits(), shooter, state.player);
    expect(state.player.hp).toBe(state.player.maxHp); // nothing reached HP
    expect(state.player.shield).toBe(6); // glock_cop hits for 2
  });

  it("spills the remainder into HP when a hit overruns the plates", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 20, shield: 2 });
    const state = makeState({ player: { weaponId: "revolver", ammoInMag: 6 }, enemies: [target] });
    fireWeapon(state, alwaysHits(), state.player, target);
    expect(target.shield).toBeUndefined(); // deleted at zero, not left as 0
    expect(target.hp).toBe(17); // 5 damage - 2 absorbed
  });

  it("announces the last plate breaking", () => {
    const state = makeState({
      player: { shield: 1 },
      enemies: [makeEnemy({ x: 4, y: 2, weaponId: "glock_cop" })],
    });
    fireWeapon(state, alwaysHits(), state.enemies[0]!, state.player);
    expect(state.log.join(" ")).toContain("last plate shatters");
  });
});

describe("melee bypasses plates (the load-bearing rule)", () => {
  it("a knife ignores the target's plates entirely", () => {
    const target = makeEnemy({ x: 3, y: 2, hp: 20, shield: 50 });
    const state = makeState({ enemies: [target] });
    meleeAttack(state, createSimRng(1), state.player, target);
    expect(target.shield).toBe(50); // untouched
    expect(target.hp).toBe(18);
  });

  it("and the rule is symmetric — a dog goes straight through the player's", () => {
    const dog = makeEnemy({ defId: "dog", x: 3, y: 2, weaponId: null as unknown as string });
    const state = makeState({ player: { shield: 50 }, enemies: [dog] });
    meleeAttack(state, createSimRng(1), dog, state.player);
    expect(state.player.shield).toBe(50);
    expect(state.player.hp).toBeLessThan(state.player.maxHp);
  });
});

describe("carriers and spares", () => {
  it("picking up a carrier wears it", () => {
    const state = makeState({
      items: [{ id: 1, x: 2, y: 2, kind: "carrier", carrierId: "carrier_ii" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.carrierId).toBe("carrier_ii");
    expect(state.items).toHaveLength(0);
  });

  it("upgrading drops the old carrier rather than deleting it", () => {
    const state = makeState({
      carrierId: "carrier_ii",
      items: [{ id: 1, x: 2, y: 2, kind: "carrier", carrierId: "carrier_iv" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.carrierId).toBe("carrier_iv");
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ kind: "carrier", carrierId: "carrier_ii" });
  });

  it("refuses a sideways or downgrade swap for free — no pickup loop", () => {
    const state = makeState({
      carrierId: "carrier_iv",
      items: [{ id: 1, x: 2, y: 2, kind: "carrier", carrierId: "carrier_ii" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.carrierId).toBe("carrier_iv");
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.items).toHaveLength(1);
  });

  it("caps spare plates so floor-1 thoroughness is not floor-7 invincibility", () => {
    const state = makeState({
      spareplates: SPARE_PLATE_CAP,
      items: [{ id: 1, x: 2, y: 2, kind: "plate" }],
    });
    applyAction(state, { type: "pickup" });
    expect(state.spareplates).toBe(SPARE_PLATE_CAP);
    expect(state.player.ap).toBe(state.player.maxAp); // refused for free
    expect(state.items).toHaveLength(1);
  });
});
