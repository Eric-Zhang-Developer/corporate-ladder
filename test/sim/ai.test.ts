import { describe, expect, it } from "vitest";
import { applyAction } from "../../src/sim/step";
import { distance, type GameState } from "../../src/sim/state";
import { makeEnemy, makeState, openMap, setWall } from "./helpers";

function waitTurns(state: GameState, n: number): void {
  for (let i = 0; i < n && state.phase === "playing"; i++) {
    applyAction(state, { type: "wait" });
  }
}

describe("pursueAndShoot", () => {
  it("idles until it spots the player, and spotting spends the turn", () => {
    const enemy = makeEnemy({ x: 13, y: 2, alerted: false });
    const state = makeState({ map: openMap(16, 6), player: { x: 2, y: 2 }, enemies: [enemy] });

    // out of sight range (distance 11 > 8): stays put and asleep
    waitTurns(state, 3);
    expect(enemy.alerted).toBe(false);
    expect(enemy.x).toBe(13);

    // walk into sight range; the spotting turn is spent shouting, not shooting
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    applyAction(state, { type: "move", dx: 1, dy: 0 });
    applyAction(state, { type: "move", dx: 1, dy: 0 }); // turn ends, cop spots us
    expect(enemy.alerted).toBe(true);
    expect(enemy.x).toBe(13); // did not act on the spotting turn
    expect(state.player.hp).toBe(state.player.maxHp);
  });

  it("closes to preferred range and opens fire on a stationary player", () => {
    const enemy = makeEnemy({ x: 13, y: 2 });
    const state = makeState({
      map: openMap(16, 6),
      player: { x: 2, y: 2 },
      enemies: [enemy],
    });

    let minDist = distance(state.player, enemy);
    let shotsSeen = false;
    for (let i = 0; i < 40 && state.phase === "playing"; i++) {
      applyAction(state, { type: "wait" });
      minDist = Math.min(minDist, distance(state.player, enemy));
      if (state.log.join(" ").match(/Rent-a-Cop (hits|fires)/)) shotsSeen = true;
    }

    expect(minDist).toBeLessThanOrEqual(4);
    expect(shotsSeen).toBe(true);
    // §8 guardrail: a player who never answers dies
    expect(state.phase).toBe("dead");
    expect(state.killedBy).toContain("Rent-a-Cop");
    expect(state.killedBy).toContain(`Seed ${state.seed}`);
  });

  it("paths around walls to reach the player", () => {
    const map = openMap(14, 14);
    // vertical wall at x=6 with a gap at the bottom (y=11)
    for (let y = 1; y <= 10; y++) setWall(map, 6, y);
    const enemy = makeEnemy({ x: 10, y: 2 });
    const state = makeState({ map, player: { x: 2, y: 2 }, enemies: [enemy] });

    const start = distance(state.player, enemy);
    let minDist = start;
    for (let i = 0; i < 30 && state.phase === "playing"; i++) {
      applyAction(state, { type: "wait" });
      minDist = Math.min(minDist, distance(state.player, enemy));
    }
    expect(minDist).toBeLessThan(start);
    expect(minDist).toBeLessThanOrEqual(4);
  });

  it("is deterministic for a fixed seed", () => {
    const run = () => {
      const state = makeState({
        seed: 77,
        map: openMap(16, 6),
        player: { x: 2, y: 2 },
        enemies: [makeEnemy({ id: 500, x: 13, y: 2 })],
      });
      for (let i = 0; i < 25 && state.phase === "playing"; i++) {
        applyAction(state, { type: "wait" });
      }
      return state;
    };
    expect(run()).toEqual(run());
  });
});
