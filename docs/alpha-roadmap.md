# Alpha Roadmap — feat/alpha

**Status: implementation plan.** The design phase is closed (`arsenal-design.md`,
`progression-design.md`, `consumables-design.md`, `bestiary-design.md`, `ui-design.md`).
The core engine is done; this branch builds the systems those docs specify, then fills
content on top of them. Sim first, renderer second, always.

## Ground rules

- **Each milestone is one runnable, tested chunk** ending in a commit (or a small commit
  train) with typecheck + tests green. Milestones that change the run loop end with a
  bot playtest across ≥3 seeds (temp-file technique, deleted before commit).
- **Golden snapshot regenerations are scheduled, not reactive.** They happen at the
  milestones marked ⟲ below, each in its own reviewed commit immediately after the
  milestone lands. A red golden test at any other time is a bug, not a chore.
- **UI pieces ride their sim milestones** (see `ui-design.md` §Build order) — the
  sidebar reads state, so its updates belong in the commit that adds the state.
- **Content is data.** If a milestone-9+ addition needs systems code beyond its one
  budgeted behavior function, stop and refactor first (invariant 3).
- Estimates are focused days, calibrated against Stage 2's actuals (~15.5 planned).

## The cut line (pressure valve)

"Sendable to playtesters" requires all 8 floors, the bosses, and a win screen. It does
**not** require completeness elsewhere. If the schedule slips, alpha-lite ships with:
~18 of 28 guns (each class's T1–T3 spine), the 8 safest perks, wave-1 consumables +
frag only, and no claymore/smoke. Every one of those is a data entry added later while
feedback comes in. Floors and bosses are never cut; guns, perks, and items are.

---

## Phase A — combat systems (the refactor everything stands on)

### M1 — Caliber migration + armor/DR ⟲ *(~2 days)*
The load-bearing refactor. Four ammo channels (`pistol`/`shell`/`rifle`/`heavy` —
rename small/medium/large, add rifle) migrated through weapons, enemies, drops, floor
tables, and player reserves. `armor` on EnemyDef, `armorPierce` on WeaponDef,
`machine` flag; per-pellet DR subtraction in `dealDamage`; blades (knife) bypass armor.
Sidebar ammo row renames in the same commit.
**Tests:** DR-vs-pellets math, pierce, blade bypass, migration integrity, balance
test's armored column. **Exit:** current game plays identically except calibers renamed;
armor exists but no enemy has it yet.

### M2 — New weapon mechanics ⟲ *(~2 days)*
`boltAction` (chambered flag in slot state, fire-unchambered auto-cycles +1 AP, R
cycles manually), `bayonet` (bump-melee override), `reloadDiscards` (en-bloc),
`bracedBonus` (no-move-AP accuracy bonus). Mosin converts to bolt-split. Gun-card
`CYCLE`/`BRACED` flags ride.
**Tests:** bolt amortization + deferred-cycle sequencing, bayonet damage + bypass,
en-bloc waste warning, braced gating. Balance test gains pistol-contract, shotgun-heat,
and bolt-amortization assertions. **Exit:** Mosin plays the new rhythm; a hand-built
SKS/Garand/M249 state passes all mechanic tests.

### M3 — Arsenal data fill *(~2 days)*
All 28 player weapons + enemy variants (`mp5_sec`, `m4_merc`, `m249_gunner`,
`xm7_exo`, `spas_detail`, fixer pistol, `m82`, minigun, `tec9_thug`) as data entries
per `arsenal-design.md`. Loot pools get tier tags for later floor use.
**Tests:** balance test passes for every tier window + exceptions; no golden change
(new entries are unreferenced by the golden path). **Exit:** `?seed` runs can spawn
T1 loot from the widened pool; the spreadsheet argues back.

## Phase B — player systems

### M4 — Plates + carriers ⟲ *(~1.5 days)*
`shield`/`carrierId`/`spareplates` state; plate-insert action (1 AP); shield absorbs
before HP; **melee bypasses shields**; carriers as found gear. Sidebar shield bar +
carrier line ride.
**Tests:** absorption order, melee bypass, carrier caps, insert typo-rule, JSON
round-trip. **Exit:** hand-placed carrier + plates make the cop fight measurably
different and the dog fight identical.

### M5 — Consumables wave 1 + hotbar + drop ⟲ *(~2 days)*
`data/items.ts`; `GroundItem` grows `kind: "consumable"`; 6-slot typed-stack hotbar;
`useItem` action; heals/stim/schematics per `consumables-design.md`; **drop action**
(`X`-then-slot, 1 AP) with nearest-free-tile scatter — merging the duplicated BFS
helpers (debt #1) in the same commit. Hotbar UI rides.
**Tests:** stack caps, heal maths, stim refill-bonus-then-comedown, schematics reveal,
drop/scatter, one-item-per-tile law. **Exit:** a run can be played around items;
bot smoke-run confirms pickup/use/drop loops.

### M6 — AoE system + grenades *(~2 days)*
Tile-targeted radius helper; `throw` action; frag/flashbang/EMP with the stun rules
(full `pendingApDrain`, organics/machines split, one turn hard cap). **Throw-targeting
input mode** with radius preview + LOS check — the batch's biggest UI item.
**Tests:** radius application, stun-for-a-turn semantics, machine/organic targeting,
throw range + LOS gating. **Exit:** flashbang a 3-cop room and alpha-strike it; EMP
does nothing to humans.

### M7 — Promotions ⟲ *(~2 days)*
`xp`/`level`/`perks` state; XP on kills; thresholds; `promoting` phase + `choosePerk`
action; seeded 1-of-2 offers from `hash(seed, level)`; +3 HP + full heal; the 8 safest
perks wired at their one touchpoints. Promotion overlay rides.
**Tests:** threshold curve, offer determinism, each perk's touchpoint, phase gating,
guardrail-table test (HP vs tier anchors). **Exit:** a floor-1 clear promotes ~once;
replay from seed shows identical offers.

### M8 — Cash + merchant + vending *(~1.5 days)*
`cash` state; human drops + caches; stairwell shop (phase between floors, seeded
stock rules) + shop overlay; vending tiles (bump-to-buy, no UI); Expense Account perk
hookup.
**Tests:** stock seeding determinism, purchase/afford/typo rules, vending bump path,
machines-drop-nothing lint. **Exit:** a full floor-1→2 loop earns, spends, and
restocks.

## Phase C — content fill (the tower materializes)

### M9 — Bestiary wave 1 + floors 3–4 ⟲ *(~2.5 days)*
`detonate` behavior; Roomba + baton guard join T1; contractor, riot guard, K9, FPV,
supervisor (mobile alarm flag); **Janitor promotes to boss** (leaves regular pool);
K9 Handler (pack flag); camera 2-wave rework; floors 3–4 tables; `LAST_FLOOR = 4`.
Target-card UI rides (armor pips become necessary knowledge here).
**Tests:** anchor test for new entries, machine-flag lint, behavior-registry tripwire
(≤8), pack + alarm semantics, melee-weight assertion extended. **Bot playtest** —
the first 4-floor runs; camera-farm attempt included. **Exit:** floors 1–4 play with
distinct textures; Janitor boss fight lands.

### M10 — Bestiary wave 2 + floors 5–6 *(~2.5 days)*
`stealthApproach` + `overwatch` behaviors; erratic-step flag; rifleman, heavy gunner,
stealth unit, turret, prototype; Server Warden (`spinup` + alarm pulse); floor 6
zero-human data assertion; floors 5–6 tables; `LAST_FLOOR = 6`.
**Tests:** stealth reveal distance, overwatch lane semantics, spinup interruption,
zero-human assertion. **Bot playtest** across seeds. **Exit:** floor 6 feels eerie in
a manual run — the design's one aesthetic exit criterion.

### M11 — Bestiary wave 3 + floors 7–8 + the CEO ⟲ *(~3 days)*
`duelist` behavior; exo, fixer (silent shots), marksman (lane telegraph — **lane
highlight rendering** rides), protection detail, Dozer (spinup, flash-immune,
EMP-once); the CEO per `bestiary-design.md` §8; win = severance package after the
duel; floors 7–8 tables; `LAST_FLOOR = 8`.
**Tests:** duelist reads mag state, plate/stim usage, Dozer immunity rules, marksman
lane math. **Bot playtest:** full-tower runs; CEO duel length 4–8 turns; Dozer kills
open-field bots and not corner-peekers. **Exit:** the game is winnable, start to
credits, on multiple seeds.

### M12 — Balance pass + playtest build *(~2 days)*
Bot sweeps with logging: heavy-channel starvation, healing budget (≤0.8 alarm),
cash economy (60–80% affordability), guardrail table, camera waves. Tune data only.
Log font/5-line bump + scrollback/escaping land here if they haven't already (both
dependency-free). Final ⟲ if tuning touched sim behavior. `npm run build`, deploy via
main merge, external playtest with seed URLs + the §7-style kill-questions: does a
run take ~30 minutes, do builds feel different, was every death legible?

---

## Schedule reality

Sums to ~25 focused days — call it 5–7 part-time weeks. Phase A+B (~15 days) is
systems and will *feel* slow: the game looks unchanged while its skeleton doubles.
Phase C is where eight floors materialize in ten days, because by then everything is
a data entry. That asymmetry is the architecture working; don't lose faith during B.
Cut-line order if slipping: wave-3 consumables → perk pool depth → gun count →
**never floors or bosses**.

## Standing verification (every milestone)

`npm run typecheck` && `npm run test`; bot playtest if the run loop changed;
`npm run build` + eyeball if presentation changed; golden regen only at ⟲ marks, in
its own reviewed commit. The four invariants hold at every commit — greppably.
