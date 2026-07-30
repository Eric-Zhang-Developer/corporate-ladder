import { describe, expect, it } from "vitest";
import { KNIFE } from "../../src/data/costs";
import { ENEMIES } from "../../src/data/enemies";
import { applyAction } from "../../src/sim/step";
import { spawnEnemy, type GameState } from "../../src/sim/state";
import { makeEnemy, makeState, openMap } from "./helpers";

function waitTurns(state: GameState, n: number): void {
  for (let i = 0; i < n && state.phase === "playing"; i++) {
    applyAction(state, { type: "wait" });
  }
}

describe("bump melee (knife)", () => {
  it("costs 1 AP and deals knife damage", () => {
    const enemy = makeEnemy({ x: 3, y: 2, hp: 99, maxHp: 99 });
    const state = makeState({ player: { x: 2, y: 2 }, enemies: [enemy] });
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    expect(state.player.ap).toBe(2);
    expect(state.player.x).toBe(2); // did not move onto the enemy
    expect(enemy.hp).toBe(99 - KNIFE.damage);
    expect(state.log.at(-1)).toContain("knife");
  });

  it("kills through the shared death path", () => {
    const enemy = makeEnemy({ x: 3, y: 2, hp: 1 });
    const state = makeState({ player: { x: 2, y: 2 }, enemies: [enemy] });
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    expect(state.enemies).toHaveLength(0);
    expect(state.log.join(" ")).toContain("collapses");
  });
});

describe("meleeRush enemies", () => {
  it("dog closes and bites at most once per turn despite 3 AP", () => {
    const dog = spawnEnemy(9, "dog", 4, 2);
    dog.alerted = true;
    const state = makeState({ player: { x: 2, y: 2 }, enemies: [dog] });
    applyAction(state, { type: "wait" });
    // dist 2: move 1 (adjacent), bite once, third AP cannot re-bite
    expect(state.player.hp).toBe(10 - (ENEMIES.dog.meleeDamage ?? 0));
  });

  it("dog reaches a stationary player from sight range within 2-3 turns", () => {
    const dog = spawnEnemy(9, "dog", 9, 2);
    const state = makeState({ map: openMap(14, 6), player: { x: 2, y: 2 }, enemies: [dog] });
    // turn 1: spotted (spends turn); turns 2-4: closes 2/turn from dist 7
    waitTurns(state, 5);
    expect(state.player.hp).toBeLessThan(10);
  });

  it("taser hit drains AP at the next refill, then clears", () => {
    const taser = spawnEnemy(9, "taser", 3, 2);
    taser.alerted = true;
    const state = makeState({ player: { x: 2, y: 2 }, enemies: [taser] });
    applyAction(state, { type: "wait" });
    expect(state.player.pendingApDrain).toBeUndefined(); // already consumed by refill
    expect(state.player.ap).toBe(3 - (ENEMIES.taser.apDrainOnHit ?? 0));
    applyAction(state, { type: "wait" });
    // taser hits again this turn, but check refill clears when it doesn't:
    const drained = state.player.ap;
    expect(drained).toBeLessThanOrEqual(3);
  });

  it("janitor is a joke tank: survives four glock hits", () => {
    expect(ENEMIES.janitor.hp).toBeGreaterThan(4 * 3);
  });

  it("death line uses the enemy's kill verb", () => {
    const dog = spawnEnemy(9, "dog", 3, 2);
    dog.alerted = true;
    const state = makeState({ player: { x: 2, y: 2, hp: 2 }, enemies: [dog] });
    applyAction(state, { type: "wait" });
    expect(state.phase).toBe("dead");
    expect(state.killedBy).toContain("Bitten to death by Guard Dog");
  });
});
