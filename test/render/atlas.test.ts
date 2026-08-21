import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../src/data/enemies";
import { spriteSpecs } from "../../src/render/atlas";

// Keys the viewport blits (tiles.ts): terrain, the player, and ground items.
const STATIC_KEYS = [
  "floor",
  "wall",
  "stairs",
  "player",
  "item_weapon",
  "item_ammo",
  "item_plate",
  "item_carrier",
  "item_consumable",
  "vending",
];

describe("pixel atlas", () => {
  const specs = spriteSpecs();
  const byKey = new Map(specs.map((s) => [s.key, s]));

  it("covers every blit key: statics plus every enemy id", () => {
    for (const key of STATIC_KEYS) {
      expect(byKey.has(key), `missing sprite for "${key}"`).toBe(true);
    }
    for (const id of Object.keys(ENEMIES)) {
      expect(byKey.has(id), `missing sprite for enemy "${id}"`).toBe(true);
    }
  });

  it("keeps every grid inside 14×14", () => {
    for (const spec of specs) {
      for (const grid of spec.layers) {
        expect(grid.length, `${spec.key}: too many rows`).toBeLessThanOrEqual(14);
        for (const row of grid) {
          expect(row.length, `${spec.key}: row too wide: "${row}"`).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it("resolves every palette letter — a typo'd pixel must fail here, not vanish", () => {
    for (const spec of specs) {
      for (const grid of spec.layers) {
        for (const row of grid) {
          for (const ch of row) {
            if (ch === ".") continue;
            expect(
              spec.colors[ch],
              `${spec.key}: no color for '${ch}'`,
            ).toMatch(/^#[0-9a-f]{6}$/);
          }
        }
      }
    }
  });
});
