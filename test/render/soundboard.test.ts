import { describe, expect, it } from "vitest";
import {
  categoryStart,
  flatten,
  step,
  type ManifestCategory,
} from "../../src/render/dom/soundboard";

// The DOM half of the soundboard stays untested by convention; the
// navigation math is pure and this is what keeps arrow-stepping honest.

const MANIFEST: ManifestCategory[] = [
  { category: "Pistols", sounds: ["glock", "revolver"] },
  { category: "Empty", sounds: [] },
  { category: "UI", sounds: ["promote"] },
];

describe("soundboard navigation", () => {
  it("flattens the manifest in category order", () => {
    expect(flatten(MANIFEST)).toEqual([
      { name: "glock", category: 0 },
      { name: "revolver", category: 0 },
      { name: "promote", category: 2 },
    ]);
  });

  it("steps with wrapping in both directions", () => {
    expect(step(0, 1, 3)).toBe(1);
    expect(step(2, 1, 3)).toBe(0);
    expect(step(0, -1, 3)).toBe(2);
    expect(step(0, -1, 0)).toBe(0); // empty list never divides by zero
  });

  it("finds the first sound of a category, skipping empty ones", () => {
    const flat = flatten(MANIFEST);
    expect(categoryStart(flat, 0)).toBe(0);
    expect(categoryStart(flat, 2)).toBe(2);
    expect(categoryStart(flat, 1)).toBe(0); // empty category falls back
  });
});
