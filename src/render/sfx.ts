/**
 * Pure event→sound mapping (docs/sound-design.md §7): SimEvent[] in, named
 * cues with gain and a timed playback plan out. No DOM, no WebAudio — that
 * lives in render/audio.ts. Tested in test/render/sfx.test.ts.
 */

import { FLOORS } from "../data/floors";
import { weaponDef } from "../data/weapons";
import type { SimEvent } from "../sim/events";
import { idx, type GameState } from "../sim/state";

export interface SoundCue {
  name: string;
  gain: number;
  /** 2 = always plays (your pain), 1 = important, 0 = droppable texture. */
  priority: 0 | 1 | 2;
}

export interface PlannedSound {
  name: string;
  gain: number;
  /** Milliseconds after the action resolves. */
  at: number;
}

/**
 * Enemy-tuned weapon variants speak with the base gun's voice — same gun,
 * same sound, and hearing your future gun in enemy hands is foreshadowing.
 * Ids missing here (fixer_pistol, m82, turret_gun, warden_slam, minigun and
 * every player gun) have WAVs of their own name.
 */
const GUN_VOICE: Record<string, string> = {
  glock_cop: "glock",
  serbu_guard: "serbu",
  tec9_thug: "tec9",
  mp5_sec: "mp5",
  m4_merc: "m4",
  m249_gunner: "m249",
  xm7_exo: "xm7",
  spas_detail: "spas12",
};

/** Landmark fights get a sting instead of a walkie chirp. */
const BOSS_IDS = new Set<string>([
  ...FLOORS.map((f) => f.boss).filter((b): b is string => b !== undefined),
  "ceo",
]);

/** Which reload mechanism a gun's stats imply. */
export function reloadVoice(weaponId: string): string {
  const def = weaponDef(weaponId);
  if (def.reloadDiscards) return "reload_enbloc";
  if (def.caliber === "shell") return "reload_shells";
  if (def.cls === "lmg" || def.apReload >= 3) return "reload_belt";
  return "reload_mag";
}

/**
 * Off-screen events are audible but distant (the design choice: telegraphs
 * stay audible countdowns, at a whisper). Visible events play full.
 */
function positionGain(state: GameState, x: number, y: number): number {
  return state.visible[idx(state.map, x, y)] === true ? 1 : 0.4;
}

export function soundsFor(events: SimEvent[], state: GameState): SoundCue[] {
  const cues: SoundCue[] = [];
  const cue = (name: string, gain: number, priority: 0 | 1 | 2 = 0): void => {
    cues.push({ name, gain, priority });
  };

  for (const e of events) {
    switch (e.kind) {
      case "shot": {
        const gain = positionGain(state, e.x, e.y);
        cue(GUN_VOICE[e.weaponId] ?? e.weaponId, gain, e.by === state.player.id ? 1 : 0);
        if (e.clatter) cue("armor_clatter", positionGain(state, e.tx, e.ty), 1);
        else if (e.hits === 0) cue("miss_ricochet", positionGain(state, e.tx, e.ty), 0);
        break;
      }
      case "boltCycle":
        cue("bolt_cycle", positionGain(state, e.x, e.y));
        break;
      case "dryClick":
        cue("dry_click", 1, 1); // always the player's own gun — information
        break;
      case "melee":
        if (e.zap) cue("taser_zap", positionGain(state, e.x, e.y), 1);
        else if (e.by === state.player.id) cue("knife_stab", 1, 1);
        break;
      case "plateHit":
        if (e.broken) cue("plate_break", positionGain(state, e.x, e.y), 2);
        break;
      case "hurt":
        if (e.target === state.player.id) {
          cue(e.melee ? "player_hurt_blade" : "player_hurt", 1, 2);
          // The death spiral, audible without a sidebar glance.
          if (state.player.hp > 0 && state.player.hp <= 3) cue("low_hp", 0.8, 1);
        } else if (!e.melee) {
          cue(e.machine ? "hit_hard" : "hit_flesh", positionGain(state, e.x, e.y));
        }
        break;
      case "kill":
        cue(e.machine ? "kill_machine" : "kill_human", positionGain(state, e.x, e.y), 1);
        break;
      case "reload":
        cue(reloadVoice(e.weaponId), positionGain(state, e.x, e.y));
        break;
      case "drop":
        if (e.what === "cash") cue("pickup_cash", 1);
        break;
      case "spot":
        if (BOSS_IDS.has(e.defId)) cue("boss_sting", 1, 1);
        else if (e.defId === "dog" || e.defId === "k9") cue("dog_bark", positionGain(state, e.x, e.y), 1);
        else cue(e.machine ? "spot_machine" : "spot_human", positionGain(state, e.x, e.y), 1);
        break;
      case "step":
        break; // the animation reader's event; sound ignores it
      case "telegraph": {
        const gain = positionGain(state, e.x, e.y);
        const voice = {
          camera: "camera_alert",
          lock: "turret_lock",
          spinup: e.weaponId === "minigun" ? "minigun_spinup" : "warden_spinup",
          dive: "drone_arm",
          reveal: "stealth_reveal",
          wake: "alarm_klaxon",
        }[e.style];
        cue(voice, gain, 1); // telegraphs are gameplay — they outrank texture
        break;
      }
      case "alarmWave":
        cue("elevator_arrival", positionGain(state, e.x, e.y), 1);
        break;
      case "duelistPlate":
        cue("plate_slot", positionGain(state, e.x, e.y), 1);
        break;
      case "duelistStim":
        cue("stim_use", positionGain(state, e.x, e.y), 1);
        break;
      case "blast":
        cue(
          e.targets === "machines" ? "emp_blast" : e.stun ? "flashbang_blast" : "frag_blast",
          positionGain(state, e.x, e.y),
          1,
        );
        break;
      case "throw":
        cue("grenade_throw", 1);
        break;
      case "pickup":
        cue(
          e.what === "ammo" ? "pickup_ammo" : e.what === "weapon" ? "pickup_weapon" : "pickup_item",
          1,
        );
        break;
      case "plateSlot":
        cue("plate_slot", 1, 1);
        break;
      case "swap":
        cue("pickup_weapon", 0.5);
        break;
      case "useItem": {
        const voice =
          {
            snack: "heal_small",
            bandage: "heal_small",
            medshot: "heal_big",
            medkit: "heal_big",
            stim: "stim_use",
            schematics: "schematics",
          }[e.itemId] ?? "pickup_item";
        cue(voice, 1, 1);
        break;
      }
      case "purchase":
        cue(e.ok ? "buy_ok" : "buy_denied", 1, 1);
        break;
      case "promote":
        cue("promote", 1, 2);
        break;
      case "perkPick":
        cue("perk_pick", 1, 1);
        break;
      case "shopEnter":
        cue("ascend_elevator", 1, 1);
        break;
      case "floorStart":
        cue("game_start", 1, 1); // badge-scan: clocking in to a fresh floor
        break;
      case "death":
        cue("death", 1, 2);
        break;
      case "win":
        cue("win", 1, 2);
        break;
    }
  }
  return cues;
}

/**
 * The §6 mix rules as data: fan cues out ~50 ms apart in sim order (which
 * also makes the enemy turn FEEL sequential), cap the pile-up, and when
 * dropping, drop texture before information and your own pain never.
 */
export function planPlayback(cues: SoundCue[], spacingMs = 50, cap = 8): PlannedSound[] {
  const kept = [...cues];
  for (const priority of [0, 1] as const) {
    for (let i = kept.length - 1; i >= 0 && kept.length > cap; i--) {
      if (kept[i]!.priority === priority) kept.splice(i, 1);
    }
  }
  return kept.map((c, i) => ({ name: c.name, gain: c.gain, at: i * spacingMs }));
}
