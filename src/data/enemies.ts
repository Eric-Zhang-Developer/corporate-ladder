import type { Caliber } from "./weapons";

/**
 * Enemies are data entries (handoff §6 rule 2): adding one later must be a
 * new entry here plus, at most, one behavior function in sim/ai.ts.
 */
export type BehaviorId =
  | "pursueAndShoot"
  | "meleeRush"
  | "cameraAlarm"
  | "detonate"
  | "stealthApproach"
  | "overwatch"
  | "spinup";

export interface EnemyDrop {
  /** 0..1 — rolled independently per entry. */
  chance: number;
  weaponId?: string;
  /** A consumable from data/items.ts. */
  itemId?: string;
  /** Meridian scrip. Never on a machine — capital expenditure is not salaried. */
  cash?: { min: number; max: number };
  ammo?: { caliber: Caliber; min: number; max: number };
}

export interface EnemyDef {
  id: string;
  name: string;
  glyph: string;
  color: string;
  hp: number;
  ap: number;
  /** Absent for pure-melee and support enemies. */
  weaponId?: string;
  /** Spots the player at this distance (with LOS); spotting spends the turn. */
  sightRange: number;
  /** Ranged only: advances until this close before it starts shooting. */
  preferredRange?: number;
  /**
   * Flat damage reduction applied to EVERY pellet of every shot. Blades
   * (knife, bayonet) ignore it entirely — gaps in the plate — which is what
   * turns an armored enemy into something you would rather charge than spray.
   */
  armor?: number;
  /**
   * Machines: EMP hurts them, flashbangs do not, they drop no cash, and they
   * never flinch or flee. Also the tone valve — machines are polite while
   * they kill you.
   */
  machine?: boolean;
  /** Melee only: damage per hit. */
  meleeDamage?: number;
  /** Melee hits per turn regardless of AP left (default 1). */
  attacksPerTurn?: number;
  /** Taser rule (§4.1): victim loses this much AP at its next refill. */
  apDrainOnHit?: number;
  /** Flat XP for the kill. Chaff 2-3, standard 5-7, elite 10-14, boss 25+. */
  xp: number;
  behavior: BehaviorId;
  /** Detonators: damage dealt to everything adjacent when it goes off. */
  detonateDamage?: number;
  /**
   * Alarm callers: how many response waves before going dark. Finite by
   * design — the response team bills hourly, and infinite waves would make
   * camera-farming a strategy instead of a trap.
   */
  alarmWaves?: number;
  /** Escorts spawned alongside a boss. */
  escorts?: string[];
  /** One per floor pair, placed deliberately rather than rolled. */
  boss?: boolean;
  /** Stealth units: invisible until the player is this close. */
  revealRange?: number;
  /** Turns of telegraph before an overwatch shot or a spin-up burst. */
  chargeTurns?: number;
  /** 0..1 chance of a wasted, random step — breaks kiting arithmetic. */
  erratic?: number;
  /** Log line on spotting the player. */
  spotLine?: string;
  /** Death-screen prefix, e.g. "Bitten to death by". */
  killVerb?: string;
  drops?: EnemyDrop[];
}

export const ENEMIES = {
  rentacop: {
    id: "rentacop",
    name: "Rent-a-Cop",
    glyph: "c",
    color: "#8899ff",
    hp: 6,
    ap: 2,
    weaponId: "glock_cop",
    sightRange: 8,
    preferredRange: 4,
    xp: 5,
    behavior: "pursueAndShoot",
    spotLine: `The Rent-a-Cop shouts, "Hey! You can't be up here!"`,
    killVerb: "Shot to death by",
    drops: [
      { chance: 1, ammo: { caliber: "pistol", min: 4, max: 8 } },
      { chance: 0.25, itemId: "bandage" },
      { chance: 1, cash: { min: 5, max: 10 } },
    ],
  },
  dog: {
    id: "dog",
    name: "Guard Dog",
    glyph: "d",
    color: "#cc8844",
    hp: 4,
    ap: 3,
    sightRange: 9,
    meleeDamage: 3,
    attacksPerTurn: 1,
    xp: 5,
    behavior: "meleeRush",
    spotLine: "The Guard Dog snarls.",
    killVerb: "Bitten to death by",
  },
  taser: {
    id: "taser",
    name: "Taser Guard",
    glyph: "t",
    color: "#ffee66",
    hp: 6,
    ap: 2,
    sightRange: 8,
    meleeDamage: 1,
    attacksPerTurn: 1,
    apDrainOnHit: 2,
    xp: 6,
    behavior: "meleeRush",
    spotLine: `The Taser Guard yells, "Compliance is mandatory!"`,
    killVerb: "Tased into retirement by",
    drops: [
      { chance: 1, ammo: { caliber: "pistol", min: 2, max: 4 } },
      { chance: 1, cash: { min: 5, max: 10 } },
    ],
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun Guard",
    glyph: "s",
    color: "#ff9955",
    hp: 7,
    ap: 2,
    weaponId: "serbu_guard",
    sightRange: 8,
    preferredRange: 2,
    xp: 7,
    behavior: "pursueAndShoot",
    spotLine: `The Shotgun Guard racks a shell. "Wrong floor, buddy."`,
    killVerb: "Turned into a memo by",
    drops: [
      { chance: 1, ammo: { caliber: "shell", min: 3, max: 5 } },
      { chance: 0.25, itemId: "bandage" },
      { chance: 1, cash: { min: 6, max: 12 } },
    ],
  },
  camera: {
    id: "camera",
    name: "Security Camera",
    glyph: "^",
    color: "#ff5555",
    hp: 1,
    ap: 0,
    machine: true,
    sightRange: 8,
    xp: 3,
    behavior: "cameraAlarm",
    killVerb: "Watched to death by",
  },
  janitor: {
    id: "janitor",
    name: "Janitor",
    glyph: "j",
    color: "#88bb88",
    hp: 26,
    ap: 2,
    sightRange: 7,
    meleeDamage: 6,
    attacksPerTurn: 1,
    xp: 25,
    boss: true,
    behavior: "meleeRush",
    // The joke boss, and the joke IS the fight: slow, unarmored, immune to
    // nothing, and simply does not stop. A wall of seniority.
    spotLine: "The Janitor puts down the mop and picks up the wrench. Thirty years of this.",
    killVerb: "Mopped up by",
    // Thirty years on the job and OSHA-certified for every one of them.
    drops: [
      { chance: 1, itemId: "medkit" },
      { chance: 1, cash: { min: 20, max: 35 } },
    ],
  },
  // ---- T1: the lobby economy ----
  roomba: {
    id: "roomba",
    name: "Custodial Unit",
    glyph: "o",
    color: "#88aa99",
    hp: 2,
    ap: 2,
    xp: 2,
    machine: true,
    sightRange: 6,
    meleeDamage: 1,
    attacksPerTurn: 1,
    behavior: "meleeRush",
    // The tutorial robot: teaches every machine rule at one damage a bite.
    spotLine: `The Custodial Unit chirps. "Cleaning in progress."`,
    killVerb: "Buffed to death by",
  },
  baton: {
    id: "baton",
    name: "Baton Guard",
    glyph: "b",
    color: "#99aacc",
    hp: 5,
    ap: 3,
    xp: 5,
    sightRange: 8,
    meleeDamage: 3,
    attacksPerTurn: 1,
    behavior: "meleeRush",
    // The plain melee statistic, so the taser reads as the *scary* one.
    spotLine: "The Baton Guard sighs and unclips his baton.",
    killVerb: "Beaten down by",
    drops: [{ chance: 1, cash: { min: 4, max: 9 } }],
  },
  // ---- T2: duty gear and the first machines with teeth ----
  contractor: {
    id: "contractor",
    name: "Security Contractor",
    glyph: "C",
    color: "#7788dd",
    hp: 10,
    ap: 2,
    xp: 8,
    weaponId: "mp5_sec",
    sightRange: 8,
    preferredRange: 4,
    behavior: "pursueAndShoot",
    // A 30-round magazine: the punish windows the player learned to farm get
    // scarcer exactly when the player got comfortable.
    spotLine: `The Security Contractor keys his radio. "Got eyes on."`,
    killVerb: "Shot to death by",
    drops: [
      { chance: 1, ammo: { caliber: "pistol", min: 6, max: 12 } },
      { chance: 0.25, itemId: "bandage" },
      { chance: 1, cash: { min: 8, max: 14 } },
    ],
  },
  riot: {
    id: "riot",
    name: "Riot Guard",
    glyph: "R",
    color: "#ccbb66",
    hp: 12,
    armor: 2,
    ap: 2,
    xp: 10,
    sightRange: 7,
    meleeDamage: 5,
    attacksPerTurn: 1,
    behavior: "meleeRush",
    // The armor system's teaching moment: the Uzi does nothing, the knife does
    // everything. Deliberately over the hits-to-kill guardrail with the wrong
    // tool — he is the exception that teaches the rule.
    spotLine: "The Riot Guard raises his shield and advances.",
    killVerb: "Shield-bashed by",
    drops: [{ chance: 1, cash: { min: 10, max: 18 } }],
  },
  k9: {
    id: "k9",
    name: "K9 Unit",
    glyph: "k",
    color: "#aa8866",
    hp: 9,
    armor: 1,
    ap: 3,
    xp: 9,
    machine: true,
    sightRange: 9,
    meleeDamage: 5,
    attacksPerTurn: 1,
    behavior: "meleeRush",
    // The guard dog's product-line successor. Armor 1 quietly taxes every
    // pellet, so the player who answered "dog" with "spray" learns to read the
    // machine tag as "check your caliber".
    spotLine: "The K9 Unit plays a recorded bark. Somehow that is worse.",
    killVerb: "Torn apart by",
  },
  fpv: {
    id: "fpv",
    name: "FPV Drone",
    glyph: "v",
    color: "#dd6644",
    hp: 1,
    ap: 4,
    xp: 3,
    machine: true,
    sightRange: 10,
    detonateDamage: 8,
    behavior: "detonate",
    // The counter to fighting from a fortified doorway is a thing that does
    // not care about doorways. It cannot be ignored and dies to anything.
    spotLine: "A motor whine rises somewhere above you.",
    killVerb: "Blown apart by",
  },
  supervisor: {
    id: "supervisor",
    name: "Supervisor",
    glyph: "S",
    color: "#dd99dd",
    hp: 8,
    ap: 2,
    xp: 8,
    sightRange: 9,
    alarmWaves: 1,
    behavior: "cameraAlarm",
    // A human camera with a lanyard: his threat is procedure, not damage.
    // Kill him first or fight the room and the cavalry.
    spotLine: `The Supervisor reaches for his radio. "Logging a workplace incident."`,
    killVerb: "Reported to death by",
    drops: [{ chance: 1, cash: { min: 15, max: 25 } }],
  },
  handler: {
    id: "handler",
    name: "K9 Handler",
    glyph: "H",
    color: "#ffaa55",
    hp: 18,
    ap: 2,
    xp: 25,
    boss: true,
    weaponId: "tec9_thug",
    sightRange: 9,
    preferredRange: 4,
    behavior: "pursueAndShoot",
    // Ordinary man, extraordinary context: he arrives with two K9 units and
    // stands behind them, so reaching him means eating the charge.
    escorts: ["k9", "k9"],
    spotLine: "The K9 Handler whistles. Two speakers answer.",
    killVerb: "Put down by",
    drops: [
      { chance: 1, cash: { min: 30, max: 50 } },
      { chance: 1, itemId: "medshot" },
      { chance: 1, ammo: { caliber: "pistol", min: 10, max: 18 } },
    ],
  },
  // ---- T3: R&D and the data center ----
  rifleman: {
    id: "rifleman",
    name: "Merc Rifleman",
    glyph: "M",
    color: "#6699cc",
    hp: 14,
    ap: 2,
    xp: 11,
    weaponId: "m4_merc",
    sightRange: 9,
    preferredRange: 5,
    behavior: "pursueAndShoot",
    // The first enemy who backs off while firing, which breaks the two-floor
    // habit of walking at shooters because they stand still.
    spotLine: `The Merc Rifleman calls it in. "Contact, moving."`,
    killVerb: "Shot to death by",
    drops: [
      { chance: 1, ammo: { caliber: "rifle", min: 10, max: 18 } },
      { chance: 1, cash: { min: 12, max: 20 } },
      { chance: 0.3, itemId: "medshot" },
    ],
  },
  gunner: {
    id: "gunner",
    name: "Heavy Gunner",
    glyph: "G",
    color: "#dd8844",
    hp: 16,
    ap: 2,
    xp: 12,
    weaponId: "m249_gunner",
    sightRange: 9,
    preferredRange: 6,
    behavior: "pursueAndShoot",
    // The player's own LMG rules pointed backwards: murderous in his lane,
    // helpless for the full turn of his 3-AP reload. Fighting him fair is the
    // mistake; fighting him during the belt change is the ritual.
    spotLine: "The Heavy Gunner plants his feet and the barrel comes around.",
    killVerb: "Cut down by",
    drops: [
      { chance: 1, ammo: { caliber: "rifle", min: 16, max: 26 } },
      { chance: 1, cash: { min: 12, max: 22 } },
    ],
  },
  stealth: {
    id: "stealth",
    name: "Stealth Unit",
    glyph: "u",
    color: "#99aabb",
    hp: 10,
    ap: 3,
    xp: 12,
    machine: true,
    sightRange: 10,
    revealRange: 2,
    meleeDamage: 7,
    attacksPerTurn: 1,
    behavior: "stealthApproach",
    // The counter to sniping from darkness. One tile of surprise is worth more
    // than any stat in a turn-based game; the camo IS its armor budget.
    spotLine: "Something shimmers, close.",
    killVerb: "Gutted by",
  },
  turret: {
    id: "turret",
    name: "Sentry Turret",
    glyph: "T",
    color: "#cc6666",
    hp: 12,
    armor: 2,
    ap: 2,
    xp: 10,
    machine: true,
    weaponId: "turret_gun",
    sightRange: 10,
    chargeTurns: 1,
    behavior: "overwatch",
    // The lane made literal. It cannot follow you around the corner, so map
    // knowledge is the whole fight — and schematics quietly appreciate.
    spotLine: "A sentry turret swivels. Servos whine.",
    killVerb: "Perforated by",
  },
  prototype: {
    id: "prototype",
    name: "Malfunctioning Prototype",
    glyph: "P",
    color: "#bb77dd",
    hp: 15,
    ap: 3,
    xp: 11,
    machine: true,
    sightRange: 8,
    meleeDamage: 7,
    attacksPerTurn: 1,
    erratic: 0.34,
    behavior: "meleeRush",
    // The habit it counters is optimisation itself: players who turned melee
    // kiting into arithmetic meet the one enemy whose arithmetic is broken.
    spotLine: `The Prototype greets you. "THANK YOU FOR CHOOSING MERI—" It lurches.`,
    killVerb: "Recalled by",
  },
  warden: {
    id: "warden",
    name: "Server Warden",
    glyph: "W",
    color: "#66ddcc",
    hp: 30,
    armor: 3,
    ap: 2,
    xp: 25,
    boss: true,
    machine: true,
    weaponId: "warden_slam",
    sightRange: 8,
    preferredRange: 1,
    chargeTurns: 2,
    behavior: "spinup",
    // Fights like infrastructure. Armor 3 walls out spray entirely; the fight
    // is about INTERRUPTING the charge, not out-damaging it.
    spotLine: `The Server Warden powers up. "Thank you for your patience."`,
    killVerb: "Serviced by",
    // Drops nothing but the silence afterward — and the plates off its rack.
    drops: [
      { chance: 1, itemId: "medkit" },
      { chance: 1, itemId: "emp" },
    ],
  },
} satisfies Record<string, EnemyDef>;

export function enemyDef(id: string): EnemyDef {
  const def = (ENEMIES as Record<string, EnemyDef>)[id];
  if (!def) throw new Error(`Unknown enemy: ${id}`);
  return def;
}
