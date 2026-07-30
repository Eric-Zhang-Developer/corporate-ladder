import { describe, expect, it } from "vitest";
import { applyAction } from "../../src/sim/step";
import { isFloor, newGame, type GameState } from "../../src/sim/state";

function legalMove(state: GameState): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } {
  const { player, map } = state;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (isFloor(map, player.x + dx, player.y + dy)) return { dx, dy };
  }
  throw new Error("player is walled in");
}

describe("AP system", () => {
  it("charges 1 AP per move and ends the turn at 0 AP", () => {
    const state = newGame(1);
    expect(state.player.ap).toBe(3);
    expect(state.turn).toBe(1);

    for (let i = 0; i < 3; i++) {
      const move = legalMove(state);
      applyAction(state, { type: "move", ...move });
    }

    expect(state.turn).toBe(2);
    expect(state.player.ap).toBe(3); // refilled after the turn ended
  });

  it("does not charge AP for bumping into a wall", () => {
    const state = newGame(1);
    // walk into a wall: find a blocked direction
    const { player, map } = state;
    const blocked = ([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const).find(([dx, dy]) => !isFloor(map, player.x + dx, player.y + dy));
    if (blocked) {
      applyAction(state, { type: "move", dx: blocked[0], dy: blocked[1] });
      expect(state.player.ap).toBe(3);
      expect(state.turn).toBe(1);
    }
  });

  it("wait ends the turn immediately", () => {
    const state = newGame(1);
    applyAction(state, { type: "wait" });
    expect(state.turn).toBe(2);
    expect(state.player.ap).toBe(3);
  });

  it("state survives a JSON round-trip (sim/render separation canary)", () => {
    const state = newGame(7);
    const move = legalMove(state);
    applyAction(state, { type: "move", ...move });
    const roundTripped = JSON.parse(JSON.stringify(state));
    expect(roundTripped).toEqual(state);
  });
});
