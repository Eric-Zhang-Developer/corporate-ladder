import { describe, expect, it } from "vitest";
import { generateMap } from "../../src/sim/mapgen";
import { idx, isFloor } from "../../src/sim/state";

describe("generateMap", () => {
  it("is deterministic for a given seed", () => {
    const a = generateMap(42);
    const b = generateMap(42);
    expect(a.map.tiles).toEqual(b.map.tiles);
    expect(a.playerStart).toEqual(b.playerStart);
    expect(a.enemyStart).toEqual(b.enemyStart);
  });

  it("produces different maps for different seeds", () => {
    const a = generateMap(1);
    const b = generateMap(2);
    expect(a.map.tiles).not.toEqual(b.map.tiles);
  });

  it("spawns player and enemy on floor tiles connected to each other", () => {
    for (const seed of [1, 7, 88412]) {
      const { map, playerStart, enemyStart } = generateMap(seed);
      expect(isFloor(map, playerStart.x, playerStart.y)).toBe(true);
      expect(isFloor(map, enemyStart.x, enemyStart.y)).toBe(true);

      // flood fill from the player start
      const reached = new Set<number>([idx(map, playerStart.x, playerStart.y)]);
      const queue = [[playerStart.x, playerStart.y] as [number, number]];
      while (queue.length > 0) {
        const [x, y] = queue.pop()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (!isFloor(map, nx, ny)) continue;
          const i = idx(map, nx, ny);
          if (reached.has(i)) continue;
          reached.add(i);
          queue.push([nx, ny]);
        }
      }
      expect(reached.has(idx(map, enemyStart.x, enemyStart.y))).toBe(true);
    }
  });
});
