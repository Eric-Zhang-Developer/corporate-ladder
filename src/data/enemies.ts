import type { Caliber } from "./weapons";

/**
 * Enemies are data entries (handoff §6 rule 2): adding one later must be a
 * new entry here plus, at most, one behavior function in sim/ai.ts.
 */
export type BehaviorId = "pursueAndShoot" | "meleeRush" | "cameraAlarm";

export interface EnemyDrop {
  /** 0..1 — rolled independently per entry. */
  chance: number;
  weaponId?: string;
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
  /** Melee only: damage per hit. */
  meleeDamage?: number;
  /** Melee hits per turn regardless of AP left (default 1). */
  attacksPerTurn?: number;
  /** Taser rule (§4.1): victim loses this much AP at its next refill. */
  apDrainOnHit?: number;
  behavior: BehaviorId;
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
    behavior: "pursueAndShoot",
    spotLine: `The Rent-a-Cop shouts, "Hey! You can't be up here!"`,
    killVerb: "Shot to death by",
    drops: [{ chance: 1, ammo: { caliber: "small", min: 4, max: 8 } }],
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
    behavior: "meleeRush",
    spotLine: `The Taser Guard yells, "Compliance is mandatory!"`,
    killVerb: "Tased into retirement by",
    drops: [{ chance: 1, ammo: { caliber: "small", min: 2, max: 4 } }],
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
    behavior: "pursueAndShoot",
    spotLine: `The Shotgun Guard racks a shell. "Wrong floor, buddy."`,
    killVerb: "Turned into a memo by",
    drops: [
      { chance: 1, ammo: { caliber: "medium", min: 3, max: 5 } },
      { chance: 0.3, weaponId: "serbu" },
    ],
  },
  camera: {
    id: "camera",
    name: "Security Camera",
    glyph: "^",
    color: "#ff5555",
    hp: 1,
    ap: 0,
    sightRange: 8,
    behavior: "cameraAlarm",
    killVerb: "Watched to death by",
  },
  janitor: {
    id: "janitor",
    name: "Janitor",
    glyph: "j",
    color: "#88bb88",
    hp: 14,
    ap: 2,
    sightRange: 6,
    meleeDamage: 4,
    attacksPerTurn: 1,
    behavior: "meleeRush",
    spotLine: "The Janitor sighs and hefts his wrench. Thirty years of this.",
    killVerb: "Mopped up by",
  },
} satisfies Record<string, EnemyDef>;

export function enemyDef(id: string): EnemyDef {
  const def = (ENEMIES as Record<string, EnemyDef>)[id];
  if (!def) throw new Error(`Unknown enemy: ${id}`);
  return def;
}
