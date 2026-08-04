import { describe, expect, it } from "vitest";
import { alertChip, statRow, targetCardHtml, threatLine } from "../../src/render/enemyinfo";
import { makeEnemy } from "../sim/helpers";

/**
 * The target card formatter. The card's founding job is showing plate and
 * MACHINE before the player wastes a magazine; these pin the extension of
 * that promise — AP budget, live mag, distance-aware threat — across every
 * shape of enemy the roster has.
 */

describe("statRow", () => {
  it("holds every column with a dash when the stat is absent", () => {
    const bare = statRow(makeEnemy({ armor: 0, maxAp: 0 }));
    expect(bare).toBe("6/6 HP · — · —");
  });

  it("draws armor as blue squares and AP as the player's own diamonds", () => {
    const row = statRow(makeEnemy({ armor: 2, maxAp: 3 }));
    expect(row).toContain(`<span class="tgt-armor">▣▣</span>`);
    expect(row).toContain(`<span class="tgt-ap">◆◆◆</span>`);
  });
});

describe("alertChip", () => {
  it("reads ALERT when they know and UNAWARE when they do not", () => {
    expect(alertChip(makeEnemy({ alerted: true }))).toContain("ALERT");
    expect(alertChip(makeEnemy({ alerted: false }))).toContain("UNAWARE");
    expect(alertChip(makeEnemy({ alerted: false }))).toContain("tgt-unaware");
  });
});

describe("threatLine", () => {
  it("shooters: gun, live mag, and threat through their own band table", () => {
    const cop = makeEnemy({ defId: "rentacop", weaponId: "glock_cop", ammoInMag: 4 });
    const line = threatLine(cop, 2);
    expect(line).toContain("Glock");
    expect(line).toContain("mag 4/5");
    expect(line).toMatch(/hits ~\d\.\d\/AP/);
  });

  it("threat decays with distance and becomes an explicit out-of-range", () => {
    const guard = makeEnemy({ defId: "shotgun", weaponId: "serbu_guard", ammoInMag: 3 });
    expect(threatLine(guard, 1)).toContain("hits ~");
    // The Serbu dies past 4 tiles — absence of threat is information too.
    expect(threatLine(guard, 5)).toContain("out of range (4)");
    expect(threatLine(guard, 5)).not.toContain("hits");
  });

  it("an empty mag is the punish window, and it turns green", () => {
    const dry = makeEnemy({ defId: "rentacop", weaponId: "glock_cop", ammoInMag: 0 });
    expect(threatLine(dry, 3)).toContain(`<span class="tgt-open">mag 0/5</span>`);
  });

  it("melee enemies show the hit, and the taser leads with its real threat", () => {
    expect(threatLine(makeEnemy({ defId: "dog", weaponId: null }), 5)).toContain("melee");
    const taser = threatLine(makeEnemy({ defId: "taser", weaponId: null }), 2);
    expect(taser).toContain("drains 2 AP");
  });

  it("detonators, alarms, and overwatch each speak their own line", () => {
    expect(threatLine(makeEnemy({ defId: "fpv", weaponId: null }), 6)).toContain("detonates for");
    expect(threatLine(makeEnemy({ defId: "camera", weaponId: null }), 6)).toBe(
      "raises the alarm · no attack",
    );
    const turret = makeEnemy({ defId: "turret", weaponId: "turret_gun", ammoInMag: 6 });
    expect(threatLine(turret, 6)).toContain("on sight");
  });
});

describe("targetCardHtml", () => {
  it("stacks the three rows: identity, stats, threat", () => {
    const k9 = makeEnemy({
      defId: "k9",
      name: "K9 Unit",
      weaponId: null,
      armor: 1,
      maxAp: 3,
      alerted: false,
    });
    const html = targetCardHtml(k9, 6.3);
    expect(html).toContain("K9 Unit");
    expect(html).toContain("MACHINE"); // armored AND wrong-caliber, both visible
    expect(html).toContain("UNAWARE");
    expect(html).toContain("▣");
    expect(html).toContain("6.3 tiles");
    expect(html).toContain("melee");
  });
});
