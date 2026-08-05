import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../src/data/enemies";
import { ITEMS } from "../../src/data/items";
import { WEAPONS } from "../../src/data/weapons";
import {
  enemyOptions,
  itemOptions,
  weaponOptions,
  type OptionGroup,
} from "../../src/render/dom/debugpanel";

// The DOM half of the panel stays untested by convention. These are the drift
// guards: the option lists are derived from the data tables, so a new enemy or
// gun must appear in the panel without anyone remembering to add it. A missing
// id here means the balance pass silently cannot spawn the thing it is tuning.

const flat = (groups: OptionGroup[]): string[] => groups.flatMap((g) => g.ids);

function expectsExactCoverage(groups: OptionGroup[], table: object): void {
  const ids = flat(groups);
  expect(new Set(ids).size).toBe(ids.length); // no id offered twice
  expect([...ids].sort()).toEqual(Object.keys(table).sort());
}

describe("debug panel options", () => {
  it("offers every enemy exactly once", () => {
    expectsExactCoverage(enemyOptions(), ENEMIES);
  });

  it("offers every weapon exactly once", () => {
    expectsExactCoverage(weaponOptions(), WEAPONS);
  });

  it("offers every consumable exactly once", () => {
    expectsExactCoverage(itemOptions(), ITEMS);
  });

  it("buckets enemies under the first floor that can spawn them", () => {
    const groups = enemyOptions();
    expect(groups[0]!.label).toBe("1 LOBBY");
    expect(groups[0]!.ids).toContain("rentacop");
    // The janitor is floor 2's boss, so it lands there rather than in "other".
    expect(groups.find((g) => g.ids.includes("janitor"))!.label).toBe("2 OFFICES");
    // Today every enemy is reachable from some floor's table, so the catch-all
    // group is empty. It exists for the entry that one day isn't — the coverage
    // test above is what would fail without it.
    expect(groups.map((g) => g.label)).not.toContain("other");
  });

  it("groups guns by loot tier and keeps enemy-only variants apart", () => {
    const groups = weaponOptions();
    expect(groups.map((g) => g.label)).toEqual(["T0", "T1", "T2", "T3", "T4", "enemy-only"]);
    expect(groups[0]!.ids).toEqual(["glock"]);
    expect(groups.at(-1)!.ids).toContain("glock_cop");
  });
});
