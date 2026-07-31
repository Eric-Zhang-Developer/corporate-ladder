/**
 * Weapons are data entries (handoff §6 rule 2). Damage-per-AP at each range
 * band is the only balance currency (§2, §8) — the shape here is the
 * balance spreadsheet in code.
 */
import { AP_COSTS } from "./costs";

/**
 * Four ammo channels, not three. Each is an economy valve rather than realism:
 * pistol is plentiful everywhere (it feeds the sidearm that never starves),
 * shell is chunky and room-scale, rifle is the mid/late workhorse, and heavy
 * feeds the most mouths of any channel (every sniper, battle rifle and the
 * Deagle) which is what makes carrying two heavy guns a real bet.
 */
export type Caliber = "pistol" | "shell" | "rifle" | "heavy";

/** Balance-test grouping: guns are compared within a tier, never across. */
export type WeaponClass = "pistol" | "smg" | "shotgun" | "rifle" | "dmr" | "sniper" | "lmg";

export interface RangeBand {
  /** Band applies up to this distance (Euclidean tiles). */
  maxDist: number;
  accMult: number;
  dmgMult: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  apFire: number;
  apReload: number;
  /** Per shot (per pellet), before band multipliers. */
  damage: number;
  /** Hit chance at point blank, before band multipliers. */
  baseAccuracy: number;
  /** Ordered by maxDist; ranges past the last band are out of range. */
  bands: RangeBand[];
  magSize: number;
  caliber: Caliber;
  /** Rounds per trigger pull, each rolled independently (Uzi volley). */
  pellets?: number;
  /** Index into bands: where this gun is meant to live (balance test). */
  intendedBand?: number;
  /**
   * Subtracted from the target's armor before per-pellet damage reduction.
   * Rare and T3+ — it is what lets a small gun stay relevant against plate.
   */
  armorPierce?: number;
  /**
   * Fire empties the chamber; the next shot needs a cycle first. Entity
   * .chambered === false means the bolt is open (absent means ready, so no
   * spawn or pickup site has to know about this).
   */
  boltAction?: boolean;
  /** While this gun is held, bump-melee does this instead of KNIFE.damage. */
  bayonet?: number;
  /** En-bloc clips: reloading throws away whatever was left in the magazine. */
  reloadDiscards?: boolean;
  /** Accuracy bonus when the shooter spent no AP moving this turn (LMGs). */
  bracedBonus?: number;
  /** Loot tier; absent on enemy-only variants, which are tuned separately. */
  tier?: 0 | 1 | 2 | 3 | 4;
  cls?: WeaponClass;
}

export const WEAPONS = {
  glock: {
    id: "glock",
    name: "Glock",
    apFire: 1,
    apReload: 1,
    damage: 3,
    baseAccuracy: 0.95,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      // The long-band accuracy cliff is the repositioning incentive.
      { maxDist: 8, accMult: 0.55, dmgMult: 1.0 },
    ],
    magSize: 7,
    caliber: "pistol",
    intendedBand: 1,
    tier: 0,
    cls: "pistol",
  },
  revolver: {
    id: "revolver",
    name: "Revolver",
    apFire: 1,
    apReload: 2,
    damage: 5,
    baseAccuracy: 0.8,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.45, dmgMult: 1.0 },
    ],
    magSize: 6,
    caliber: "pistol",
    intendedBand: 1,
    tier: 1,
    cls: "pistol",
  },
  uzi: {
    id: "uzi",
    name: "Micro Uzi",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.5,
    bands: [
      { maxDist: 1, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.4, dmgMult: 1.0 },
    ],
    magSize: 20,
    caliber: "pistol",
    pellets: 4,
    intendedBand: 1,
    tier: 1,
    cls: "smg",
  },
  serbu: {
    id: "serbu",
    name: "Serbu Shorty",
    apFire: 1,
    apReload: 2,
    damage: 6,
    baseAccuracy: 0.7,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 2, accMult: 0.9, dmgMult: 0.9 },
      // Devastating at arm's length, a paperweight past it (§4.2).
      { maxDist: 3, accMult: 0.5, dmgMult: 0.35 },
    ],
    magSize: 3,
    caliber: "shell",
    intendedBand: 0,
    tier: 1,
    cls: "shotgun",
  },
  mosin: {
    id: "mosin",
    name: "Mosin-Nagant",
    apFire: 1,
    apReload: 2,
    damage: 8,
    baseAccuracy: 0.9,
    bands: [
      // Hates adjacency; sings at range — the kiting gun.
      { maxDist: 2, accMult: 0.55, dmgMult: 1.0 },
      { maxDist: 8, accMult: 1.0, dmgMult: 1.0 },
    ],
    magSize: 5,
    caliber: "heavy",
    // 1 AP to fire, 1 to cycle: the same 2 AP per shot it always cost, except
    // the cycle can now be deferred to buy a repositioning turn.
    boltAction: true,
    intendedBand: 1,
    tier: 1,
    cls: "sniper",
  },
  sks: {
    id: "sks",
    name: "SKS",
    apFire: 1,
    apReload: 2,
    damage: 6,
    baseAccuracy: 0.65,
    bands: [
      { maxDist: 1, accMult: 0.8, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.5, dmgMult: 1.0 },
    ],
    magSize: 10,
    caliber: "rifle",
    // The folding bayonet is the whole identity: every other rifle panics when
    // the dog closes, this one shrugs and stabs.
    bayonet: 4,
    intendedBand: 1,
    tier: 1,
    cls: "dmr",
  },
  garand: {
    id: "garand",
    name: "M1 Garand",
    apFire: 1,
    apReload: 1,
    damage: 6,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 2, accMult: 0.7, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.7, dmgMult: 1.0 },
    ],
    magSize: 8,
    caliber: "heavy",
    // En-bloc: the clip goes in whole and comes out whole. Topping up throws
    // away what is left, in the scarcest channel in the game.
    reloadDiscards: true,
    intendedBand: 1,
    tier: 2,
    cls: "dmr",
  },
  m249: {
    id: "m249",
    name: "M249",
    apFire: 1,
    apReload: 3,
    damage: 2,
    baseAccuracy: 0.68,
    bands: [
      { maxDist: 1, accMult: 0.8, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.5, dmgMult: 1.0 },
    ],
    magSize: 50,
    caliber: "rifle",
    pellets: 5,
    // Set your feet and hold the doorway; the 3-AP reload is a full helpless
    // turn, which is the enemy punish-window mechanic pointed at the player.
    bracedBonus: 0.15,
    intendedBand: 1,
    tier: 3,
    cls: "lmg",
  },
  tec9: {
    id: "tec9",
    name: "Tec-9",
    apFire: 1,
    apReload: 1,
    damage: 3,
    baseAccuracy: 0.6,
    bands: [
      { maxDist: 1, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.35, dmgMult: 1.0 },
    ],
    magSize: 32,
    caliber: "pistol",
    pellets: 2,
    // Sprays almost like an SMG, hits almost like a Glock. "Almost" is the
    // whole personality.
    intendedBand: 1,
    tier: 1,
    cls: "pistol",
  },
  mini14: {
    id: "mini14",
    name: "Ruger Mini-14",
    apFire: 1,
    apReload: 1,
    damage: 4,
    baseAccuracy: 0.92,
    bands: [
      { maxDist: 1, accMult: 0.6, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 10,
    caliber: "rifle",
    // Deliberately gimmick-free: the marksman's starter, so the SKS beside it
    // on the pawnshop shelf reads as a temperament choice, not a stat line.
    intendedBand: 1,
    tier: 1,
    cls: "rifle",
  },
  deagle: {
    id: "deagle",
    name: "Desert Eagle",
    apFire: 1,
    apReload: 1,
    damage: 7,
    // Biggest single pistol hit in the game, and the least reliable: dialled
    // down from .72 because at that accuracy it out-damaged the AR-15, which
    // the pistol contract forbids.
    baseAccuracy: 0.65,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.4, dmgMult: 1.0 },
    ],
    magSize: 7,
    caliber: "heavy",
    // The armor puncher you wear, not carry — and it drinks from the same
    // scarce channel as your sniper, so owning both is a standing bet.
    intendedBand: 1,
    tier: 2,
    cls: "pistol",
  },
  fiveseven: {
    id: "fiveseven",
    name: "Five-seveN",
    apFire: 1,
    apReload: 1,
    damage: 4,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.5, dmgMult: 1.0 },
    ],
    magSize: 20,
    caliber: "pistol",
    // Situationally first-rate, generally third-rate: machines take it at face
    // value while every other pistol bounces.
    armorPierce: 2,
    intendedBand: 1,
    tier: 2,
    cls: "pistol",
  },
  b93r: {
    id: "b93r",
    name: "Beretta 93R",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.68,
    bands: [
      { maxDist: 1, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.35, dmgMult: 1.0 },
    ],
    magSize: 21,
    caliber: "pistol",
    pellets: 3,
    // The last word in the pistol class: after this there are no better
    // pistols, only different ones. The class completes instead of inflating.
    intendedBand: 1,
    tier: 2,
    cls: "pistol",
  },
  mp5: {
    id: "mp5",
    name: "MP5",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 1, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.4, dmgMult: 1.0 },
    ],
    magSize: 30,
    caliber: "pistol",
    pellets: 3,
    // If the Uzi is a slot machine, the MP5 is a salary.
    intendedBand: 1,
    tier: 2,
    cls: "smg",
  },
  ump45: {
    id: "ump45",
    name: "UMP-45",
    apFire: 1,
    apReload: 1,
    damage: 4,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 1, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.45, dmgMult: 1.0 },
    ],
    magSize: 25,
    caliber: "pistol",
    pellets: 2,
    // Two fat pellets instead of four thin ones, so flat DR taxes it half as
    // often. It exists so armor does not silently delete the SMG class.
    intendedBand: 1,
    tier: 3,
    cls: "smg",
  },
  p90: {
    id: "p90",
    name: "P90",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.88,
    bands: [
      { maxDist: 1, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.5, dmgMult: 1.0 },
    ],
    magSize: 50,
    caliber: "pistol",
    pellets: 5,
    // Nominal dmg/AP sits under the tier target on purpose: the pierce makes
    // it up against exactly the armored things T4 is about. Pierce 2, not 1 —
    // at 1 these 2-damage pellets retain nothing past armor 2 and the gun lost
    // to the UMP-45 it is meant to outclass.
    armorPierce: 2,
    intendedBand: 1,
    tier: 4,
    cls: "smg",
  },
  m870: {
    id: "m870",
    name: "Remington 870",
    apFire: 1,
    apReload: 2,
    damage: 8,
    baseAccuracy: 0.7,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.85, dmgMult: 0.8 },
      { maxDist: 4, accMult: 0.4, dmgMult: 0.35 },
    ],
    magSize: 5,
    caliber: "shell",
    // The Serbu's cliff with room to breathe: the ledge moves 2 -> 3 tiles.
    intendedBand: 0,
    tier: 2,
    cls: "shotgun",
  },
  spas12: {
    id: "spas12",
    name: "SPAS-12",
    apFire: 1,
    apReload: 2,
    damage: 10,
    baseAccuracy: 0.75,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.9, dmgMult: 0.85 },
      { maxDist: 4, accMult: 0.5, dmgMult: 0.4 },
    ],
    magSize: 8,
    caliber: "shell",
    // Semi-auto: three shells into a doorway in one turn, if you spend it all.
    intendedBand: 0,
    tier: 3,
    cls: "shotgun",
  },
  aa12: {
    id: "aa12",
    name: "AA-12",
    apFire: 1,
    apReload: 2,
    damage: 6,
    baseAccuracy: 0.8,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.9, dmgMult: 0.85 },
      { maxDist: 4, accMult: 0.5, dmgMult: 0.4 },
    ],
    magSize: 20,
    caliber: "shell",
    pellets: 2,
    // The cliff turned into weather. Deepest ammo furnace in the roster.
    intendedBand: 0,
    tier: 4,
    cls: "shotgun",
  },
  ar15: {
    id: "ar15",
    name: "AR-15",
    apFire: 1,
    apReload: 1,
    damage: 5,
    baseAccuracy: 0.9,
    bands: [
      { maxDist: 1, accMult: 0.7, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.65, dmgMult: 1.0 },
    ],
    magSize: 20,
    caliber: "rifle",
    // The run's spine weapon and the T2 reference point: if any T2 gun beats
    // the AR-15 everywhere, that gun is wrong.
    intendedBand: 1,
    tier: 2,
    cls: "rifle",
  },
  m4: {
    id: "m4",
    name: "M4",
    apFire: 1,
    apReload: 1,
    damage: 3,
    baseAccuracy: 0.78,
    bands: [
      { maxDist: 1, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.45, dmgMult: 1.0 },
    ],
    magSize: 30,
    caliber: "rifle",
    pellets: 3,
    // Wants soft targets and meets fewer every floor it climbs — the intended
    // pressure toward the AKM, the FAL, or discipline.
    intendedBand: 1,
    tier: 3,
    cls: "rifle",
  },
  akm: {
    id: "akm",
    name: "AKM",
    apFire: 1,
    apReload: 1,
    damage: 9,
    baseAccuracy: 0.78,
    bands: [
      // Full performance out to 2 tiles: the rifle that fights in the doorway.
      { maxDist: 2, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.4, dmgMult: 1.0 },
    ],
    magSize: 30,
    caliber: "rifle",
    intendedBand: 0,
    tier: 3,
    cls: "rifle",
  },
  an94: {
    id: "an94",
    name: "AN-94",
    apFire: 1,
    apReload: 1,
    damage: 5,
    baseAccuracy: 0.9,
    bands: [
      { maxDist: 1, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 30,
    caliber: "rifle",
    pellets: 2,
    // Hyperburst: the second round leaves before the recoil arrives, so both
    // pellets keep full accuracy. Every other multi-hit gun pays a spray tax;
    // this is the one that breaks a rule the player spent six floors learning.
    intendedBand: 1,
    tier: 4,
    cls: "rifle",
  },
  fal: {
    id: "fal",
    name: "FN FAL",
    apFire: 1,
    apReload: 2,
    damage: 9,
    baseAccuracy: 0.82,
    bands: [
      { maxDist: 2, accMult: 0.75, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 20,
    caliber: "heavy",
    // Zero pierce, deliberately: it exists to make the XM7 mean something.
    // Correct answer to almost every human, a loud way to ask for help
    // against a chassis.
    intendedBand: 1,
    tier: 3,
    cls: "dmr",
  },
  xm7: {
    id: "xm7",
    name: "XM7",
    apFire: 1,
    apReload: 2,
    damage: 10,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 2, accMult: 0.8, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 20,
    caliber: "heavy",
    // The lore is the mechanic: it exists because the program demanded a rifle
    // that defeats body armor. A T3 gun (the FAL) beating it on soft targets
    // is the armor axis working as designed.
    armorPierce: 2,
    intendedBand: 1,
    tier: 4,
    cls: "dmr",
  },
  sr25: {
    id: "sr25",
    name: "SR-25",
    apFire: 1,
    apReload: 2,
    damage: 9,
    baseAccuracy: 0.95,
    bands: [
      { maxDist: 2, accMult: 0.6, dmgMult: 1.0 },
      { maxDist: 9, accMult: 1.0, dmgMult: 1.0 },
    ],
    magSize: 10,
    caliber: "heavy",
    // Two aimed nines a turn against the AWP's one eighteen-and-cycle: the
    // same arithmetic, opposite decisions. The professional's answer to
    // "what if I miss?"
    intendedBand: 1,
    tier: 4,
    cls: "dmr",
  },
  rem700: {
    id: "rem700",
    name: "Remington 700",
    apFire: 1,
    apReload: 2,
    damage: 11,
    baseAccuracy: 0.92,
    bands: [
      { maxDist: 2, accMult: 0.5, dmgMult: 1.0 },
      { maxDist: 9, accMult: 1.0, dmgMult: 1.0 },
    ],
    magSize: 4,
    caliber: "heavy",
    boltAction: true,
    // The reliable middle of the sniper line, so the VSS can be weird and the
    // AWP can be mythic.
    intendedBand: 1,
    tier: 2,
    cls: "sniper",
  },
  vss: {
    id: "vss",
    name: "VSS Vintorez",
    apFire: 1,
    apReload: 2,
    damage: 8,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 2, accMult: 0.55, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.95, dmgMult: 1.0 },
    ],
    magSize: 10,
    caliber: "heavy",
    // The assassin's sniper: semi-auto, integrally suppressed, deliberately
    // short-legged. Its silent-kill rule lands with the stealth milestone,
    // where there is finally something to be silent about.
    intendedBand: 1,
    tier: 3,
    cls: "sniper",
  },
  awp: {
    id: "awp",
    name: "AWP",
    apFire: 1,
    apReload: 2,
    damage: 18,
    baseAccuracy: 0.95,
    bands: [
      { maxDist: 3, accMult: 0.45, dmgMult: 1.0 },
      { maxDist: 10, accMult: 1.0, dmgMult: 1.0 },
    ],
    magSize: 5,
    caliber: "heavy",
    boltAction: true,
    // Fire, cycle, and the room has moved. Inside three tiles it is a very
    // expensive walking stick, which keeps the sidearm ritual alive.
    intendedBand: 1,
    tier: 4,
    cls: "sniper",
  },
  xm250: {
    id: "xm250",
    name: "XM250",
    apFire: 1,
    apReload: 3,
    damage: 3,
    baseAccuracy: 0.62,
    bands: [
      { maxDist: 1, accMult: 0.8, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.55, dmgMult: 1.0 },
    ],
    magSize: 60,
    caliber: "rifle",
    pellets: 5,
    // The XM7's issued sibling: the top floors feel like fighting a
    // procurement catalog because they are.
    bracedBonus: 0.15,
    intendedBand: 1,
    tier: 4,
    cls: "lmg",
  },
  // Enemy-tuned variants — separate entries so enemy lethality tunes
  // independently of the player's guns.
  glock_cop: {
    id: "glock_cop",
    name: "Glock",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.65,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 4, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 5,
    caliber: "pistol",
  },
  serbu_guard: {
    id: "serbu_guard",
    name: "Serbu Shorty",
    apFire: 1,
    apReload: 2,
    damage: 4,
    baseAccuracy: 0.6,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 2, accMult: 0.9, dmgMult: 0.9 },
      { maxDist: 4, accMult: 0.5, dmgMult: 0.35 },
    ],
    magSize: 3,
    caliber: "shell",
  },
  tec9_thug: {
    id: "tec9_thug",
    name: "Tec-9",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.55,
    bands: [
      { maxDist: 1, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.85, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.35, dmgMult: 1.0 },
    ],
    magSize: 32,
    caliber: "pistol",
    pellets: 2,
  },
  // T2 anchor: ~4.5 damage per connecting burst.
  mp5_sec: {
    id: "mp5_sec",
    name: "MP5",
    apFire: 1,
    apReload: 1,
    damage: 2,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 1, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 5, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 8, accMult: 0.45, dmgMult: 1.0 },
    ],
    magSize: 30,
    caliber: "pistol",
    pellets: 3,
  },
  // T3 anchors: ~6.5 per burst.
  m4_merc: {
    id: "m4_merc",
    name: "M4",
    apFire: 1,
    apReload: 1,
    damage: 3,
    baseAccuracy: 0.8,
    bands: [
      { maxDist: 1, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.5, dmgMult: 1.0 },
    ],
    magSize: 30,
    caliber: "rifle",
    pellets: 3,
  },
  m249_gunner: {
    id: "m249_gunner",
    name: "M249",
    apFire: 1,
    apReload: 3,
    damage: 2,
    baseAccuracy: 0.72,
    bands: [
      { maxDist: 1, accMult: 0.8, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.5, dmgMult: 1.0 },
    ],
    magSize: 50,
    caliber: "rifle",
    pellets: 5,
    bracedBonus: 0.15,
  },
  // T4 anchors: ~8.5 per hit.
  xm7_exo: {
    id: "xm7_exo",
    name: "XM7",
    apFire: 1,
    apReload: 2,
    damage: 11,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 2, accMult: 0.8, dmgMult: 1.0 },
      { maxDist: 7, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 20,
    caliber: "heavy",
    armorPierce: 2,
  },
  spas_detail: {
    id: "spas_detail",
    name: "SPAS-12",
    apFire: 1,
    apReload: 2,
    damage: 10,
    baseAccuracy: 0.85,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 3, accMult: 0.9, dmgMult: 0.85 },
      { maxDist: 5, accMult: 0.5, dmgMult: 0.4 },
    ],
    magSize: 8,
    caliber: "shell",
  },
  /** The Fixer's suppressed pistol: it hits like a rifle and never misses. */
  fixer_pistol: {
    id: "fixer_pistol",
    name: "Suppressed Pistol",
    apFire: 1,
    apReload: 1,
    damage: 9,
    baseAccuracy: 0.9,
    bands: [
      { maxDist: 1, accMult: 1.0, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.95, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.6, dmgMult: 1.0 },
    ],
    magSize: 12,
    caliber: "pistol",
  },
  /** Overwatch rifle. Never player-obtainable: one shot strips plates whole. */
  m82: {
    id: "m82",
    name: "M82",
    apFire: 1,
    apReload: 2,
    damage: 15,
    baseAccuracy: 0.95,
    bands: [
      { maxDist: 3, accMult: 0.4, dmgMult: 1.0 },
      { maxDist: 12, accMult: 1.0, dmgMult: 1.0 },
    ],
    magSize: 10,
    caliber: "heavy",
    armorPierce: 2,
  },
  /** The Dozer's. Spin-up is the telegraph; the burst is the punishment. */
  minigun: {
    id: "minigun",
    name: "Minigun",
    apFire: 1,
    apReload: 3,
    damage: 3,
    baseAccuracy: 0.6,
    bands: [
      { maxDist: 2, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 6, accMult: 0.9, dmgMult: 1.0 },
      { maxDist: 9, accMult: 0.5, dmgMult: 1.0 },
    ],
    magSize: 100,
    caliber: "rifle",
    pellets: 6,
  },
} satisfies Record<string, WeaponDef>;

export function weaponDef(id: string): WeaponDef {
  const def = (WEAPONS as Record<string, WeaponDef>)[id];
  if (!def) throw new Error(`Unknown weapon: ${id}`);
  return def;
}

export function bandFor(def: WeaponDef, dist: number): RangeBand | null {
  for (const band of def.bands) {
    if (dist <= band.maxDist) return band;
  }
  return null;
}

export function maxRange(def: WeaponDef): number {
  return def.bands[def.bands.length - 1]?.maxDist ?? 0;
}

/** Expected damage per AP at a distance — the live spreadsheet (§6 rule 4). */
export function dmgPerAp(def: WeaponDef, dist: number): number {
  return dmgPerApVs(def, dist, 0);
}

/**
 * The same spreadsheet against an armored target. Armor is subtracted from
 * every pellet independently, so a four-pellet spray loses four times as much
 * as a single heavy hit — this is the whole reason the roster differentiates
 * by target type and not just by distance.
 */
export function dmgPerApVs(def: WeaponDef, dist: number, armor: number): number {
  const band = bandFor(def, dist);
  if (!band) return 0;
  const pellets = def.pellets ?? 1;
  const effective = Math.max(0, armor - (def.armorPierce ?? 0));
  const perPellet = Math.max(0, def.damage * band.dmgMult - effective);
  return (pellets * perPellet * def.baseAccuracy * band.accMult) / sustainedApPerShot(def);
}

/**
 * A bolt gun's true cost per shot includes working the bolt. Amortizing here
 * keeps the balance currency honest: deferring the cycle buys tempo, paid for
 * with an open bolt at the start of the next fight — never with free damage.
 */
export function sustainedApPerShot(def: WeaponDef): number {
  return def.apFire + (def.boltAction ? AP_COSTS.cycle : 0);
}
