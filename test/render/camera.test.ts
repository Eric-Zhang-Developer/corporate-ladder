import { describe, expect, it } from "vitest";
import { PERKS } from "../../src/data/perks";
import {
  CAMERA_COLUMNS,
  CAMERA_ROWS,
  cameraRect,
  chargeLineIsVisible,
} from "../../src/render/camera";
import { FOV_RADIUS } from "../../src/sim/fov";

describe("follow camera", () => {
  it("centers its odd-height view on the player", () => {
    const camera = cameraRect(48, 30, 24, 15);
    expect(camera).toEqual({ x: 7, y: 5, width: 34, height: 21 });
    expect(15 - camera.y).toBe(10);
  });

  it("clamps at the top-left floor edge", () => {
    expect(cameraRect(48, 30, 2, 2)).toEqual({ x: 0, y: 0, width: 34, height: 21 });
  });

  it("clamps at the bottom-right floor edge", () => {
    expect(cameraRect(48, 30, 47, 29)).toEqual({ x: 14, y: 9, width: 34, height: 21 });
  });

  it("shows a smaller floor in full", () => {
    expect(cameraRect(20, 12, 10, 6)).toEqual({ x: 0, y: 0, width: 20, height: 12 });
  });

  it("always contains the player", () => {
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 48; x++) {
        const camera = cameraRect(48, 30, x, y);
        expect(x).toBeGreaterThanOrEqual(camera.x);
        expect(x).toBeLessThan(camera.x + camera.width);
        expect(y).toBeGreaterThanOrEqual(camera.y);
        expect(y).toBeLessThan(camera.y + camera.height);
      }
    }
  });

  it("contains the complete player FOV, including Field Awareness", () => {
    const maxFov = FOV_RADIUS + (PERKS.field_awareness.value ?? 0);
    expect(CAMERA_ROWS).toBeGreaterThanOrEqual(maxFov * 2 + 1);
    expect(CAMERA_COLUMNS).toBeGreaterThanOrEqual(maxFov * 2 + 1);
  });
});

describe("charge lines under a cropped camera", () => {
  it("keeps ordinary visible charge warnings", () => {
    expect(chargeLineIsVisible(1, false, true, "spinup", false)).toBe(true);
  });

  it("allows overwatch to warn from beyond FOV", () => {
    expect(chargeLineIsVisible(1, false, false, "overwatch", false)).toBe(true);
  });

  it("does not leak another off-screen charge source", () => {
    expect(chargeLineIsVisible(1, false, false, "spinup", false)).toBe(false);
  });

  it("does not reveal a hidden source outside DEV reveal mode", () => {
    expect(chargeLineIsVisible(1, true, false, "overwatch", false)).toBe(false);
    expect(chargeLineIsVisible(1, true, false, "overwatch", true)).toBe(true);
  });
});
