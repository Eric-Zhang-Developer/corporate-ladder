import { describe, expect, it } from "vitest";
import { CAMERA_SPAWN_CAP } from "../../src/sim/ai";
import { applyAction } from "../../src/sim/step";
import { spawnEnemy, type GameState } from "../../src/sim/state";
import { makeState, openMap, setWall } from "./helpers";

function waitTurns(state: GameState, n: number): void {
  for (let i = 0; i < n && state.phase === "playing"; i++) {
    applyAction(state, { type: "wait" });
  }
}

function cameraState(opts: { withLos?: boolean } = {}) {
  const map = openMap(14, 8);
  if (opts.withLos === false) setWall(map, 5, 2);
  const camera = spawnEnemy(50, "camera", 8, 2);
  const state = makeState({ map, player: { x: 2, y: 2 }, enemies: [camera] });
  return { state, camera };
}

describe("cameraAlarm", () => {
  it("does not arm without LOS", () => {
    const { state, camera } = cameraState({ withLos: false });
    waitTurns(state, 3);
    expect(camera.alarmTimer).toBeUndefined();
    expect(state.enemies).toHaveLength(1);
  });

  it("arms on LOS and spawns a 2-cop response team at the entrance on expiry", () => {
    const { state, camera } = cameraState();
    applyAction(state, { type: "wait" }); // camera arms (timer 2)
    expect(camera.alarmTimer).toBe(2);
    waitTurns(state, 2); // countdown 2 -> 1 -> 0: spawn
    const cops = state.enemies.filter((e) => e.spawnedBy === "camera");
    expect(cops).toHaveLength(2);
    for (const cop of cops) {
      expect(Math.abs(cop.x - state.entrance.x) + Math.abs(cop.y - state.entrance.y)).toBeLessThanOrEqual(3);
      expect(cop.alerted).toBe(true);
    }
  });

  it("destroying the camera before expiry spawns nothing", () => {
    const { state } = cameraState();
    applyAction(state, { type: "wait" }); // armed
    applyAction(state, { type: "fire" }); // hp 1 — any hit kills... unless it misses
    // fire until the camera is dead, then wait out where the countdown would land
    for (let i = 0; i < 20 && state.enemies.length > 0; i++) {
      if (state.player.ammoInMag === 0) applyAction(state, { type: "reload" });
      else applyAction(state, { type: "fire" });
    }
    waitTurns(state, 4);
    expect(state.enemies.filter((e) => e.spawnedBy === "camera")).toHaveLength(0);
  });

  it("re-arms after spawning and respects the alive cap", () => {
    const { state, camera } = cameraState();
    // let it cycle many times; player never fights back and cops can't melee
    // (they shoot — player will die eventually, so cap check happens first)
    let maxCops = 0;
    for (let i = 0; i < 12 && state.phase === "playing"; i++) {
      applyAction(state, { type: "wait" });
      maxCops = Math.max(maxCops, state.enemies.filter((e) => e.spawnedBy === "camera").length);
    }
    expect(maxCops).toBeLessThanOrEqual(CAMERA_SPAWN_CAP);
    expect(maxCops).toBeGreaterThanOrEqual(2);
    expect(camera.hp).toBe(1); // camera itself never acts beyond the alarm
  });
});

describe("shotgun guard", () => {
  it("advances to preferred range 2 before firing", () => {
    const guard = spawnEnemy(60, "shotgun", 10, 2);
    guard.alerted = true;
    const state = makeState({ map: openMap(14, 6), player: { x: 2, y: 2 }, enemies: [guard] });
    const firedAt: number[] = [];
    for (let i = 0; i < 10 && state.phase === "playing"; i++) {
      const before = state.player.hp;
      applyAction(state, { type: "wait" });
      if (state.player.hp !== before || state.log.slice(-2).join(" ").includes("Shotgun Guard fires")) {
        firedAt.push(Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
      }
    }
    expect(firedAt.length).toBeGreaterThan(0);
    for (const d of firedAt) expect(d).toBeLessThanOrEqual(2);
  });
});
