import { describe, expect, it } from "vitest";
import { ENEMIES, enemyDef, type EnemyDef } from "../../src/data/enemies";
import { FLOORS } from "../../src/data/floors";
import { bandFor, weaponDef } from "../../src/data/weapons";
import { CAMERA_WAVE_CAP } from "../../src/sim/ai";
import { buildFloor } from "../../src/sim/floor";
import { applyAction } from "../../src/sim/step";
import { fireWeapon } from "../../src/sim/combat";
import { spawnEnemy } from "../../src/sim/state";
import { makeEnemy, makeState, openMap, setWall } from "./helpers";

/**
 * The bestiary's half of the §8 contract. Enemy lethality is tuned by data —
 * their own weapon entries and melee numbers — never by special-casing combat,
 * so it can be checked here rather than played for.
 */
const ANCHORS: Record<number, number> = { 1: 3, 2: 4.5, 3: 6.5, 4: 8.5 };

/**
 * Damage from ONE connecting attack — the anchor is about how hard a hit lands,
 * not how often, so accuracy is deliberately left out.
 */
function damagePerHit(def: EnemyDef): number {
  if (def.weaponId) {
    const w = weaponDef(def.weaponId);
    const band = bandFor(w, def.preferredRange ?? 3) ?? w.bands[w.bands.length - 1]!;
    return (w.pellets ?? 1) * w.damage * band.dmgMult;
  }
  return def.meleeDamage ?? def.detonateDamage ?? 0;
}

/**
 * The anchor governs enemies whose threat IS their damage. Four roles are
 * exempt by design, not by convenience: chaff stays soft on every floor so the
 * pistol contract holds; the taser's threat is a stolen turn attached to
 * deliberately trivial damage; a detonator spends its life on one hit; and a
 * telegraphed shooter trades a whole turn of warning for a hit that lands like
 * a truck, which is the trade that makes lanes frightening.
 */
function anchorApplies(def: EnemyDef): boolean {
  if (def.boss) return false;
  if (def.xp <= 3) return false;
  if (def.apDrainOnHit) return false;
  if (def.behavior === "detonate") return false;
  if (def.behavior === "overwatch") return false;
  return damagePerHit(def) > 0;
}

/** Which tier an enemy belongs to, from the floors that spawn it. */
function tierOf(id: string): number | null {
  const depths = FLOORS.filter((f) => id in f.weights || f.boss === id).map((f) => f.depth);
  if (depths.length === 0) return null;
  return Math.ceil(Math.min(...depths) / 2);
}

describe("damage anchors", () => {
  it("every enemy hits within ±40% of its tier's anchor", () => {
    for (const id of Object.keys(ENEMIES)) {
      const def = enemyDef(id);
      const tier = tierOf(id);
      if (tier === null || !anchorApplies(def)) continue;
      const anchor = ANCHORS[tier];
      if (!anchor) continue;
      const hit = damagePerHit(def);
      expect(hit, `${id} hits for ${hit.toFixed(1)} vs T${tier} anchor ${anchor}`)
        .toBeGreaterThan(anchor * 0.6);
      expect(hit, `${id} hits for ${hit.toFixed(1)} vs T${tier} anchor ${anchor}`)
        .toBeLessThan(anchor * 1.4);
    }
  });

  it("the Exo trades the Fixer's third action for armor, not hidden XM7 rules", () => {
    const exo = enemyDef("exo");
    const fixer = enemyDef("fixer");
    const exoXm7 = weaponDef(exo.weaponId!);
    const playerXm7 = weaponDef("xm7");

    expect(exo.ap).toBe(2);
    expect(fixer.ap).toBe(3);
    expect(exo.armor).toBeGreaterThan(0);
    expect(exoXm7).toMatchObject({
      apFire: playerXm7.apFire,
      apReload: playerXm7.apReload,
      damage: playerXm7.damage,
      baseAccuracy: playerXm7.baseAccuracy,
      bands: playerXm7.bands,
      magSize: playerXm7.magSize,
      caliber: playerXm7.caliber,
      armorPierce: playerXm7.armorPierce,
    });
  });

  it("gives the player a decision before the Exo's third XM7 hit", () => {
    const exo = makeEnemy({
      defId: "exo",
      name: "Exo Trooper",
      x: 7,
      y: 2,
      hp: 20,
      maxHp: 20,
      ap: 2,
      maxAp: 2,
      weaponId: "xm7_exo",
    });
    const state = makeState({
      map: openMap(16, 10),
      enemies: [exo],
      player: { hp: 100, maxHp: 100 },
    });

    const events = applyAction(state, { type: "wait" });

    expect(events.filter((event) => event.kind === "shot" && event.by === exo.id)).toHaveLength(2);
    expect(exo.ammoInMag).toBe(18);
  });

  it("every enemy is worth XP, and bosses are worth much more", () => {
    for (const id of Object.keys(ENEMIES)) expect(enemyDef(id).xp, id).toBeGreaterThan(0);
    expect(enemyDef("janitor").xp).toBeGreaterThanOrEqual(25);
    expect(enemyDef("handler").xp).toBeGreaterThanOrEqual(25);
  });
});

describe("the machine contract", () => {
  it("machines never pay cash — capital expenditure is not salaried", () => {
    for (const id of Object.keys(ENEMIES)) {
      const def = enemyDef(id);
      if (!def.machine) continue;
      expect((def.drops ?? []).some((d) => d.cash), `${id} pays a wage`).toBe(false);
    }
  });

  it("the new machines are flagged and the new humans are not", () => {
    for (const id of ["roomba", "k9", "fpv", "camera"]) {
      expect(enemyDef(id).machine, id).toBe(true);
    }
    for (const id of ["baton", "contractor", "riot", "supervisor", "handler", "janitor"]) {
      expect(enemyDef(id).machine, id).toBeUndefined();
    }
  });
});

describe("the behavior budget (invariant 3's tripwire)", () => {
  it("stays at eight behaviors or fewer", () => {
    const behaviors = new Set(Object.keys(ENEMIES).map((id) => enemyDef(id).behavior));
    // A ninth means a content addition demanded systems code. Consolidate
    // before adding, or replace one on merit.
    expect(behaviors.size).toBeLessThanOrEqual(8);
  });

  it("~15 enemies ride on those few behaviors", () => {
    const count = Object.keys(ENEMIES).length;
    const behaviors = new Set(Object.keys(ENEMIES).map((id) => enemyDef(id).behavior));
    expect(count / behaviors.size).toBeGreaterThan(2.5); // data-to-systems ratio
  });
});

describe("alarms are finite", () => {
  it("a camera goes dark after its waves are spent", () => {
    const camera = makeEnemy({ defId: "camera", x: 5, y: 2, hp: 1, weaponId: null as never, ap: 0 });
    const state = makeState({ map: openMap(20, 12), enemies: [camera] });
    let waves = 0;
    let lastCount = state.enemies.length;
    for (let i = 0; i < 40; i++) {
      applyAction(state, { type: "wait" });
      if (state.enemies.length > lastCount) waves += 1;
      lastCount = state.enemies.length;
    }
    expect(waves).toBeLessThanOrEqual(CAMERA_WAVE_CAP);
    expect(camera.alarmWaves).toBeLessThanOrEqual(CAMERA_WAVE_CAP);
  });

  it("the supervisor calls exactly one", () => {
    expect(enemyDef("supervisor").alarmWaves).toBe(1);
  });
});

describe("the DATA CENTER is empty of people", () => {
  it("floor 6 spawns machines only — the one aesthetic exit criterion", () => {
    const floor6 = FLOORS.find((f) => f.depth === 6)!;
    for (const id of Object.keys(floor6.weights)) {
      expect(enemyDef(id).machine, `${id} is a person on the zero-human floor`).toBe(true);
    }
    expect(enemyDef(floor6.boss!).machine).toBe(true);
  });
});

describe("bosses", () => {
  it("the Janitor left the regular pool and became an event", () => {
    for (const floor of FLOORS) expect(floor.weights).not.toHaveProperty("janitor");
    expect(FLOORS.find((f) => f.depth === 2)?.boss).toBe("janitor");
    expect(enemyDef("janitor").boss).toBe(true);
  });

  it("spawn exactly once on their floor, with their escorts", () => {
    for (const seed of [1, 7, 42]) {
      const build = buildFloor(seed, 4, 100, ["pistol"]);
      const handlers = build.enemies.filter((e) => e.defId === "handler");
      expect(handlers, `seed ${seed}`).toHaveLength(1);
      const dogs = build.enemies.filter((e) => e.defId === "k9");
      expect(dogs.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("never appear on a floor that does not name them", () => {
    const build = buildFloor(1, 1, 100, ["pistol"]);
    expect(build.enemies.some((e) => enemyDef(e.defId).boss)).toBe(false);
  });
});

describe("the FPV drone", () => {
  it("trades itself for a blast when it reaches you", () => {
    const drone = makeEnemy({ defId: "fpv", x: 3, y: 2, hp: 1, weaponId: null as never, ap: 4 });
    const state = makeState({ map: openMap(16, 12), enemies: [drone], player: { hp: 40, maxHp: 40 } });
    applyAction(state, { type: "wait" }); // it spots (spending the turn)
    applyAction(state, { type: "wait" }); // it closes and detonates
    expect(state.enemies).toHaveLength(0); // it is the cost
    expect(state.player.hp).toBeLessThan(40);
  });
});

describe("wave-2 behaviors", () => {
  it("a stealth unit is neither visible nor targetable until it is close", () => {
    const unit = spawnEnemy(99, "stealth", 9, 2);
    const state = makeState({ map: openMap(20, 10), enemies: [unit] });
    applyAction(state, { type: "wait" }); // it notices you first
    expect(unit.hidden).toBe(true);
    // Firing cannot pick it: it is not on the board yet.
    applyAction(state, { type: "fire" });
    expect(state.log.at(-1)).toContain("No target in sight");

    for (let i = 0; i < 6 && unit.hidden; i++) applyAction(state, { type: "wait" });
    expect(unit.hidden).toBeUndefined();
    expect(state.log.join(" ")).toContain("shimmers");
  });

  it("a turret holds its lane and telegraphs before it fires", () => {
    const turret = makeEnemy({
      defId: "turret",
      x: 8,
      y: 2,
      hp: 12,
      weaponId: "turret_gun",
      ap: 2,
      alerted: false,
    });
    const state = makeState({ map: openMap(20, 10), enemies: [turret], player: { hp: 60, maxHp: 60 } });
    const spot = { x: turret.x, y: turret.y };
    applyAction(state, { type: "wait" }); // acquires
    applyAction(state, { type: "wait" }); // sights down the lane
    expect(state.log.join(" ")).toContain("sights down the lane");
    expect(turret).toMatchObject(spot); // emplacements never move
    applyAction(state, { type: "wait" }); // fires
    expect(state.player.hp).toBeLessThan(60);
  });

  it("stepping out of the lane during the telegraph wastes the shot", () => {
    // Unalerted, so the acquire turn happens and the duck lands inside the
    // telegraph rather than after a shot has already been taken.
    const turret = makeEnemy({
      defId: "turret",
      x: 8,
      y: 2,
      hp: 12,
      weaponId: "turret_gun",
      ap: 2,
      alerted: false,
    });
    const map = openMap(20, 10);
    for (let y = 1; y < 9; y++) if (y !== 2) setWall(map, 5, y);
    const state = makeState({ map, enemies: [turret], player: { x: 2, y: 2, hp: 60, maxHp: 60 } });
    applyAction(state, { type: "wait" });
    applyAction(state, { type: "wait" }); // telegraph starts
    applyAction(state, { type: "move", dx: 0, dy: 1 });
    applyAction(state, { type: "move", dx: 0, dy: 1 }); // fully behind the wall
    applyAction(state, { type: "wait" });
    applyAction(state, { type: "wait" });
    expect(state.player.hp).toBe(60);
    expect(state.log.join(" ")).toContain("loses its firing solution");
  });

  it("the Warden's pulse wakes the machines and leaves the people asleep", () => {
    const warden = makeEnemy({ defId: "warden", x: 4, y: 2, hp: 30, weaponId: "warden_slam", ap: 2 });
    const drone = makeEnemy({ defId: "fpv", x: 14, y: 8, hp: 1, weaponId: null as never, alerted: false });
    const cop = makeEnemy({ defId: "rentacop", x: 15, y: 8, alerted: false });
    const state = makeState({
      map: openMap(20, 12),
      enemies: [warden, drone, cop],
      player: { hp: 90, maxHp: 90 },
    });
    for (let i = 0; i < 6; i++) applyAction(state, { type: "wait" });
    expect(drone.alerted).toBe(true);
    expect(cop.alerted).toBe(false); // the pulse speaks only to machines
  });
});

describe("suppressed fire", () => {
  it("a clean kill with the VSS wakes nobody; a wound still shouts", () => {
    const run = (targetHp: number) => {
      const target = makeEnemy({ x: 4, y: 2, hp: targetHp });
      const bystander = makeEnemy({ x: 5, y: 3, hp: 30, alerted: false });
      const state = makeState({
        map: openMap(20, 10),
        player: { weaponId: "vss", ammoInMag: 10 },
        enemies: [target, bystander],
      });
      fireWeapon(state, { next: () => 0, getState: () => [0, 0, 0, 1] }, state.player, target);
      return bystander.alerted;
    };
    expect(run(1)).toBe(false); // died quietly
    expect(run(80)).toBe(true); // survived and shouted
  });
});

describe("the CEO", () => {
  function duel(playerOverrides: Record<string, unknown> = {}) {
    const ceo = makeEnemy({
      defId: "ceo",
      x: 8,
      y: 4,
      hp: 35,
      maxHp: 35,
      ap: 3,
      maxAp: 3,
      weaponId: "fixer_pistol",
    });
    const state = makeState({
      map: openMap(20, 12),
      enemies: [ceo],
      player: { x: 3, y: 4, hp: 40, maxHp: 40, weaponId: "revolver", ammoInMag: 6, ...playerOverrides },
    });
    return { state, ceo };
  }

  it("takes full damage from everything — armor 0 is the statement", () => {
    expect(enemyDef("ceo").armor).toBeUndefined();
  });

  it("slots a plate mid-fight, which the player then has to strip again", () => {
    const { state, ceo } = duel();
    for (let i = 0; i < 4 && (ceo.spares ?? 3) === (enemyDef("ceo").plates ?? 3); i++) {
      applyAction(state, { type: "wait" });
    }
    expect(state.log.join(" ")).toContain("slots a fresh plate");
    expect(ceo.shield).toBeGreaterThan(0);
    expect(ceo.spares).toBeLessThan(enemyDef("ceo").plates!);
  });

  it("jabs a stim once when he drops below half, and pays for it after", () => {
    const { state, ceo } = duel();
    ceo.hp = Math.floor(ceo.maxHp / 2) - 1;
    applyAction(state, { type: "wait" });
    expect(ceo.stimUsed).toBe(true);
    expect(state.log.join(" ")).toContain("jabs something");

    const before = state.log.length;
    ceo.hp = 1;
    applyAction(state, { type: "wait" });
    expect(state.log.slice(before).join(" ")).not.toContain("jabs something"); // once only
  });

  it("closes on an empty magazine — he has read your file", () => {
    const dry = duel({ ammoInMag: 0 });
    const loaded = duel({ ammoInMag: 6 });
    const startDist = 5;
    for (let i = 0; i < 3; i++) {
      applyAction(dry.state, { type: "wait" });
      applyAction(loaded.state, { type: "wait" });
    }
    const dryDist = Math.hypot(dry.ceo.x - dry.state.player.x, dry.ceo.y - dry.state.player.y);
    expect(dryDist).toBeLessThan(startDist);
  });

  it("is the last floor's boss and worth more than any miniboss", () => {
    const floor8 = FLOORS.find((f) => f.depth === 8)!;
    expect(floor8.boss).toBe("ceo");
    expect(enemyDef("ceo").xp).toBeGreaterThan(enemyDef("dozer").xp);
  });
});

describe("the Dozer's immunities", () => {
  it("ignores flashbangs for free (it is a machine) and eats the first EMP", () => {
    const dozer = makeEnemy({ defId: "dozer", x: 3, y: 2, hp: 40, weaponId: "minigun", ap: 2 });
    const hotbar = new Array(6).fill(null);
    hotbar[0] = { itemId: "flashbang", count: 1 };
    hotbar[1] = { itemId: "emp", count: 2 };
    const state = makeState({ map: openMap(16, 10), enemies: [dozer], hotbar });

    applyAction(state, { type: "throwItem", slot: 0, x: 3, y: 2 });
    // No special-casing needed: flashbangs are organics-only and it is a
    // machine, so sealed sensors fall out of the targeting rule for free.
    expect(dozer.pendingApDrain).toBeUndefined();

    applyAction(state, { type: "throwItem", slot: 1, x: 3, y: 2 });
    expect(dozer.pendingApDrain).toBe(dozer.maxAp); // one panic button works
    expect(dozer.empUsed).toBe(true);
  });

  it("adapts to the second EMP — one panic button per customer", () => {
    const dozer = makeEnemy({ defId: "dozer", x: 3, y: 2, hp: 40, weaponId: "minigun", ap: 2 });
    dozer.empUsed = true;
    const hotbar = new Array(6).fill(null);
    hotbar[0] = { itemId: "emp", count: 1 };
    const state = makeState({ map: openMap(16, 10), enemies: [dozer], hotbar });
    applyAction(state, { type: "throwItem", slot: 0, x: 3, y: 2 });
    expect(state.log.join(" ")).toContain("has adapted");
    expect(dozer.hp).toBeLessThan(40); // still takes the damage
  });
});
