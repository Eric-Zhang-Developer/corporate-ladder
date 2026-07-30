/**
 * Enemies are data entries (handoff §6 rule 2): adding one later must be a
 * new entry here plus, at most, one behavior function in sim/ai.ts.
 */
export type BehaviorId = "pursueAndShoot";

export interface EnemyDef {
  id: string;
  name: string;
  glyph: string;
  color: string;
  hp: number;
  ap: number;
  weaponId: string;
  /** Spots the player at this distance (with LOS); spotting spends the turn. */
  sightRange: number;
  /** Advances until this close before it starts shooting. */
  preferredRange: number;
  behavior: BehaviorId;
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
  },
} satisfies Record<string, EnemyDef>;

export function enemyDef(id: string): EnemyDef {
  const def = (ENEMIES as Record<string, EnemyDef>)[id];
  if (!def) throw new Error(`Unknown enemy: ${id}`);
  return def;
}
