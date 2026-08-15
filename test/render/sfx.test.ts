import { describe, expect, it } from "vitest";
import type { SimEvent } from "../../src/sim/events";
import { planPlayback, reloadVoice, soundsFor } from "../../src/render/sfx";
import { makeState } from "../sim/helpers";

/**
 * The pure half of the sound layer: event → cue mapping, attenuation, and
 * the §6 mix plan. The WebAudio side stays untested by convention.
 */

function names(events: SimEvent[], state = makeState()): string[] {
  return soundsFor(events, state).map((c) => c.name);
}

const shot = (weaponId: string, over: Partial<Extract<SimEvent, { kind: "shot" }>> = {}): SimEvent => ({
  kind: "shot", by: 0, weaponId, x: 2, y: 2, target: 9, tx: 3, ty: 2,
  pellets: 1, hits: 1, dmg: 3, ...over,
});

describe("soundsFor", () => {
  it("enemy weapon variants speak with the base gun's voice", () => {
    expect(names([shot("glock_cop")])).toContain("glock");
    expect(names([shot("serbu_guard")])).toContain("serbu");
    expect(names([shot("spas_detail")])).toContain("spas12");
    // Enemy-only guns keep their own voices.
    expect(names([shot("m82")])).toContain("m82");
    expect(names([shot("minigun")])).toContain("minigun");
  });

  it("shot feedback: clatter beats ricochet, hits beat both", () => {
    expect(names([shot("glock", { hits: 0, dmg: 0 })])).toContain("miss_ricochet");
    expect(names([shot("glock", { hits: 1, dmg: 0, clatter: true })])).toContain("armor_clatter");
    const clean = names([shot("glock")]);
    expect(clean).not.toContain("miss_ricochet");
    expect(clean).not.toContain("armor_clatter");
  });

  it("reload voice derives from the weapon's stats", () => {
    expect(reloadVoice("garand")).toBe("reload_enbloc");
    expect(reloadVoice("m870")).toBe("reload_shells");
    expect(reloadVoice("m249")).toBe("reload_belt");
    expect(reloadVoice("m249_gunner")).toBe("reload_belt"); // no cls, apReload 3
    expect(reloadVoice("glock")).toBe("reload_mag");
  });

  it("hurt maps by victim: the player's pain outranks and distinguishes melee", () => {
    const state = makeState();
    const cues = soundsFor(
      [
        { kind: "hurt", target: state.player.id, dmg: 2, x: 2, y: 2, melee: true },
        { kind: "hurt", target: 9, dmg: 2, x: 5, y: 5, machine: true },
      ],
      state,
    );
    const blade = cues.find((c) => c.name === "player_hurt_blade");
    expect(blade?.priority).toBe(2);
    expect(cues.map((c) => c.name)).toContain("hit_hard");
  });

  it("low_hp rides along only when the player is in the red", () => {
    const state = makeState({ player: { hp: 2 } });
    const cues = names([{ kind: "hurt", target: state.player.id, dmg: 1, x: 2, y: 2 }], state);
    expect(cues).toContain("low_hp");
    const healthy = makeState();
    expect(names([{ kind: "hurt", target: healthy.player.id, dmg: 1, x: 2, y: 2 }], healthy))
      .not.toContain("low_hp");
  });

  it("off-screen events play quieter, structural events do not attenuate", () => {
    const state = makeState();
    // (8,8) is outside the default FOV from (2,2)? Force it: visible=false there.
    state.visible.fill(false);
    const cues = soundsFor([shot("akm", { x: 8, y: 8, by: 9, target: 0, tx: 2, ty: 2 })], state);
    const gun = cues.find((c) => c.name === "akm");
    expect(gun?.gain).toBeCloseTo(0.4);
    const promo = soundsFor([{ kind: "promote", level: 2 }], state);
    expect(promo[0]?.gain).toBe(1);
  });

  it("blasts discriminate by payload", () => {
    const base = { kind: "blast" as const, x: 3, y: 3, radius: 1 };
    expect(names([{ ...base, damage: 12, stun: true, targets: "machines" }])).toContain("emp_blast");
    expect(names([{ ...base, stun: true }])).toContain("flashbang_blast");
    expect(names([{ ...base, damage: 9 }])).toContain("frag_blast");
  });

  it("bosses sting instead of chirping", () => {
    const spot = (defId: string): SimEvent => ({ kind: "spot", by: 9, defId, x: 3, y: 3 });
    expect(names([spot("ceo")])).toContain("boss_sting");
    expect(names([spot("dog")])).toContain("dog_bark");
    expect(names([spot("rentacop")])).toContain("spot_human");
  });

  it("spinup telegraph picks its voice by the gun behind it", () => {
    const tel = (weaponId?: string): SimEvent => ({
      kind: "telegraph", style: "spinup", by: 9, defId: "dozer", x: 3, y: 3,
      ...(weaponId ? { weaponId } : {}),
    });
    expect(names([tel("minigun")])).toContain("minigun_spinup");
    expect(names([tel("warden_slam")])).toContain("warden_spinup");
  });
});

describe("planPlayback", () => {
  it("staggers cues 100ms apart in order", () => {
    const plan = planPlayback([
      { name: "a", gain: 1, priority: 0 },
      { name: "b", gain: 1, priority: 0 },
      { name: "c", gain: 1, priority: 0 },
    ]);
    expect(plan.map((p) => p.at)).toEqual([0, 100, 200]);
    expect(plan.map((p) => p.name)).toEqual(["a", "b", "c"]);
  });

  it("caps the pile-up, dropping texture before information, never pain", () => {
    const cues = [
      ...Array.from({ length: 10 }, () => ({ name: "miss_ricochet", gain: 1, priority: 0 as const })),
      { name: "player_hurt", gain: 1, priority: 2 as const },
      { name: "spot_human", gain: 1, priority: 1 as const },
    ];
    const plan = planPlayback(cues);
    expect(plan.length).toBeLessThanOrEqual(8);
    expect(plan.map((p) => p.name)).toContain("player_hurt");
    expect(plan.map((p) => p.name)).toContain("spot_human");
  });
});
