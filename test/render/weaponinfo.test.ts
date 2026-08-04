import { describe, expect, it } from "vitest";
import { maxRange, WEAPONS, type WeaponDef } from "../../src/data/weapons";
import { arsenalBox } from "../../src/render/dom/screens";
import { apLine, bandRows, STRIP_AXIS, stripCells, traitLine } from "../../src/render/weaponinfo";
import { makeState } from "../sim/helpers";

/**
 * The information layer for guns: the sidebar band strip and the ARSENAL
 * overlay. Pure formatters — "guns are patterns, not numbers" only works if
 * the pattern the player is shown is the pattern the sim actually rolls, so
 * these walk the whole roster, not hand-picked examples.
 */

describe("stripCells", () => {
  it("covers the axis and goes dark exactly where the gun runs out", () => {
    for (const def of Object.values(WEAPONS) as WeaponDef[]) {
      const cells = stripCells(def, null);
      expect(cells).toHaveLength(STRIP_AXIS);
      cells.forEach((cell, i) => {
        const dist = i + 1;
        if (dist > maxRange(def)) {
          expect(cell.level, `${def.id} @ ${dist} is past its last band`).toBe("out");
        } else {
          expect(cell.level, `${def.id} @ ${dist} is inside its bands`).not.toBe("out");
        }
      });
    }
  });

  it("draws the band shape: the Serbu is hot at arm's length, gone past 3", () => {
    const cells = stripCells(WEAPONS.serbu, null);
    expect(cells[0]!.level).toBe("hi");
    expect(cells[3]!.level).toBe("out");
  });

  it("shows the Mosin hating adjacency without a single number", () => {
    const cells = stripCells(WEAPONS.mosin, null);
    // 0.55 accuracy up close vs 1.0 in its band: mid next to hi.
    expect(cells[0]!.level).toBe("mid");
    expect(cells[4]!.level).toBe("hi");
  });

  it("puts the caret on the target's cell, clamped to the axis", () => {
    const at = (dist: number) => stripCells(WEAPONS.glock, dist).findIndex((c) => c.target);
    expect(at(4.4)).toBe(3); // round(4.4) = 4 → cell index 3
    expect(at(0.5)).toBe(0);
    expect(at(30)).toBe(STRIP_AXIS - 1);
    expect(stripCells(WEAPONS.glock, null).some((c) => c.target)).toBe(false);
  });
});

describe("apLine", () => {
  it("prints the costs, and only the modifiers a gun actually has", () => {
    expect(apLine(WEAPONS.glock)).toBe("fire 1 AP · reload 1 AP");
    expect(apLine(WEAPONS.uzi)).toBe("fire 1 AP · reload 1 AP · 4 rds/pull");
    // A bolt gun's fire cost is honest only as fire+cycle.
    expect(apLine(WEAPONS.mosin)).toBe("fire 1+1 AP · reload 2 AP");
  });
});

describe("bandRows", () => {
  it("tiles the distance axis contiguously and ends on the cliff", () => {
    for (const def of Object.values(WEAPONS) as WeaponDef[]) {
      const rows = bandRows(def);
      expect(rows).toHaveLength(def.bands.length + 1);
      let prev = 0;
      rows.slice(0, -1).forEach((row, i) => {
        expect(row.span).toBe(`${prev}–${def.bands[i]!.maxDist}`);
        expect(row.dpa).toBeGreaterThan(0);
        prev = def.bands[i]!.maxDist;
      });
      expect(rows.at(-1)).toEqual({ span: `${maxRange(def)}+`, dpa: null });
    }
  });
});

describe("traitLine", () => {
  it("stays empty for a plain gun and names what the rare ones do", () => {
    expect(traitLine(WEAPONS.glock)).toBe("");
    expect(traitLine(WEAPONS.mosin)).toBe("BOLT");
    expect(traitLine(WEAPONS.sks)).toBe("BAYONET 4");
    expect(traitLine(WEAPONS.garand)).toContain("DUMPS CLIP");
  });
});

describe("arsenalBox", () => {
  it("prints every slot: the held gun, and empties as empties", () => {
    const html = arsenalBox(makeState());
    expect(html).toContain("Glock");
    expect(html.match(/ars-col empty/g)).toHaveLength(2);
    expect(html).toContain("[ESC]");
  });

  it("mirrors the live gun, not the stale slot copy", () => {
    // slots[activeSlot] is stale while a gun is in hand (AGENTS.md gotcha):
    // the player drew the Glock from slot 0, then the sim swapped their hand
    // to an Uzi without writing back. The overlay must show what is in hand.
    const state = makeState({ player: { weaponId: WEAPONS.uzi.id, ammoInMag: 24 } });
    const html = arsenalBox(state);
    expect(html).toContain("Micro Uzi");
    expect(html).not.toContain("Glock");
  });
});
