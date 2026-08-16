# Code health report — severance-package — 2026-08-15

**Coverage:** 107 files measured · ~95 deep-read · ~92% of tracked LOC examined
**Window:** full history (72 commits, 2026-07-29 → 2026-08-15, 18 days, 1 author)
**Verdict:** Healthy architecture, leaky guardrails — 1 critical and 9 high findings, concentrated in enemy-turn AP handling, input modifiers, and doc/data drift

This repository is small enough to read rather than sample, so "entire repository" here
is close to literal: every module in `src/` was read in full, the whole test suite was
read, and all twelve design docs were cross-checked against the data tables they
describe. The 88 generated WAVs and the lockfile are excluded from LOC.

Seven of the sim findings below were **proven by executing the code**, not by reading it
— probe harnesses run out-of-tree against a scratchpad vitest config, so nothing in the
repository was written to. Those carry a `PROVEN` tag and their actual output.

---

## Vitals

| Metric | Value | Note |
|--------|-------|------|
| Tracked files (measured) | 107 | excludes 88 WAVs + `package-lock.json` |
| Total LOC | 18,318 | `src/` 8,132 · `test/` 5,038 · `docs/` 2,720 · `tools/` 1,457 |
| Median file size | 116 | |
| Files >400 LOC | 9 | 8.4% |
| Commits | 72 | 18 days; peak 16/day, current cadence ~2/day |
| Test suite | 355 tests / 34 files | green, 2.5 s |
| Typecheck | clean | no warnings |
| `TODO`/`FIXME`/`@ts-ignore`/`console.*` in `src/` | **0** | genuinely zero |
| Declared invariants passing grep | **4 / 4** | see below |
| Import cycles in `src/` | **0** | 41 modules, 148 internal edges |
| Export doc density | 51% | 104 / 205 |
| Top hotspot concentration | 24% of churn in 5 files | |

**The four invariants hold.** `grep -rn "document\.|window\." src/sim src/data` → empty.
No `render/`/`input/` import from `sim/`/`data/`. No `ROT.Display` in the sim.
`Math.random` appears exactly once, at `src/seed.ts:2`. No `Map`/`Set`/class/function
reaches `GameState`. No data-table aliasing into live entities. This is unusually
disciplined for the size and speed of the project, and it is why the findings below are
about *guardrails* rather than *architecture*.

---

## Diagnosis

Findings cite measured evidence. Confidence ≥ 80. Sorted by severity.

### 🔴 Critical

**1. Stun is inert against `spinup` and `cameraAlarm` — the EMP does nothing to the
Dozer or the Warden** · confidence 97 · **PROVEN**

`sim/ai.ts:27-34` — `runEnemyTurns` dispatches `BEHAVIORS[def.behavior]` with **no AP
gate at all**. Six of eight behaviors self-guard with `while (enemy.ap > 0)`; `spinup`
(`ai.ts:368-419`) and `cameraAlarm` (`ai.ts:164-192`) check AP nowhere. Since stun is
implemented as `pendingApDrain = maxAp` (`aoe.ts:86`), a stunned enemy refills to `ap: 0`
and then acts anyway.

Probe: a Server Warden with `pendingApDrain = maxAp` — exactly what an EMP or flashbang
sets — was run through one `applyAction(wait)`:

```
warden.ap after refill: 0 | chargeTimer: undefined
player hp: 30 -> 22
log: [ 'The Server Warden hits you for 8.' ]
```

The enemy acted at zero AP. This contradicts `aoe.ts:19-22` ("its turn simply does not
happen") in the same file that implements it. The EMP is an 18-scrip purchasable whose
stated design purpose (`items.ts:127` "the anti-chassis panic button"; `enemies.ts:589-592`)
is countering exactly these machines, and against them it buys nothing. A flashbanged
Supervisor likewise still ticks its countdown and spawns the response team.

`grenades.test.ts` asserts `cop.ap === 0` after refill for a `pursueAndShoot` enemy — a
behavior that self-guards — so the suite tests the case that works and not the two that
do not.

### 🟠 High

**2. Browser modifier chords dispatch real game actions — Cmd/Ctrl+F fires your
weapon** · confidence 95

`src/input/keyboard.ts:14-30` reads only `e.key`; `src/main.ts:276-506` never inspects
`ctrlKey`/`metaKey`/`altKey`. `grep -rn "ctrlKey\|metaKey\|altKey\|shiftKey" src/` returns
**zero hits**. Every chord whose `e.key` is a bound letter is dispatched as a real Action
and then `e.preventDefault()`d at `main.ts:503`.

Cmd+F / Ctrl+F → `{type:"fire"}` at the current Tab target, spending AP and running the
enemy round. Ctrl+R → `reload` (and the page reload is suppressed). Ctrl+P → `plate`.
Cmd+A/S/W/D → four directions of movement. Cmd+1/2/3 → weapon swap. In a permadeath
roguelike, one reflexive Cmd+F to open the browser find bar can end a 30-minute run.

`test/sim/input.test.ts` and `test/render/controls.test.ts` both construct events as
`{ key } as KeyboardEvent`, so no test exercises a modifier — the "keymap cannot lie"
drift test is blind to this entire class.

**3. Enemies never set `movedThisTurn`, so the Heavy Gunner is permanently braced** ·
confidence 97 · **PROVEN**

`combat.ts:78` evaluates `braced = bracedBonus && !attacker.movedThisTurn ? bracedBonus : 0`
for **both sides**, but `movedThisTurn = true` is assigned at exactly one site —
`step.ts:197`, the player's move handler. Neither enemy movement path (`ai.ts:467-495`)
sets it. `refillAp` deletes the flag for enemies too (`step.ts:816`), which is evidence it
was meant to apply to them.

```
gunner moved from x=14 to x=12 | movedThisTurn: undefined
```

`m249_gunner` (`weapons.ts:801`, `bracedBonus: 0.15`) is the only enemy weapon carrying
the field. At band 2 the Heavy Gunner's per-pellet accuracy should be `0.72 × 0.9 = 0.648`
on a turn it closed distance; it is `0.798`. Over 4 pellets × 2 damage that is 6.38
expected damage per burst against a spec of 5.18 — **~23% over budget, permanently**, on
floors 5 and 7. This lands directly on the v0.3 balance pass's measuring stick.

**4. `overwatch` enemies never reload — the turret and marksman become permanently inert
props** · confidence 95 · **PROVEN**

`ai.ts:326-360` contains no `ammoInMag` reference and no reload branch, unlike
`pursueAndShoot` (`ai.ts:92-99`) and `duelist` (`ai.ts:264-271`). Once the magazine
empties, `combat.ts:27` computes `pellets = Math.min(pellets ?? 1, 0) = 0`, the pellet
loop runs zero times, and `fireWeapon` falls through to its `hits === 0` branch.

```
turret.ammoInMag after 40 turns: 0 | last turn it dealt damage: 23
```

The Sentry Turret (`turret_gun`, `magSize: 12`) is a **spawn weight of 44 on floor 6** —
the DATA CENTER's dominant enemy. After 12 shots it logs "fires and misses" forever,
still telegraphing, dealing zero damage, with no "click, empty" feedback to distinguish it
from bad luck. The M82 Marksman (`magSize: 10`) is the same. The `magSize: 99`/`100` on
`warden_slam`/`minigun` look like the deliberate workaround for this same gap in `spinup`.

**5. Floor and shop content depend on sim history, violating the seed contract** ·
confidence 95 · **PROVEN**

`floor.ts:131-134` and `step.ts:622-627` short-circuit on
`carriedCalibers.length > 0 && rng.next() < 0.6`. When the list is empty the `rng.next()`
is never drawn, so each iteration consumes **two** RNG draws instead of three, shifting
every subsequent draw.

```
armed: 12 items | weapon@15,3 ammo@13,3 ammo@9,13 ammo@24,8 ammo@14,4  plate@28,15
naked: 12 items | weapon@15,3 ammo@13,3 ammo@9,13 ammo@24,8 ammo@16,26 plate@10,14
enemies identical: true
```

Same seed (12345), same floor (3), same `startId` — divergent layouts from the fifth item
on. Reachable by dropping all three weapons before ascending. AGENTS.md states floor
content "must never depend on sim history, so a shared seed reproduces the whole tower";
`rollShop` diverges the same way, changing the merchant's entire shelf. This is the one
finding that touches the seed-sharing promise the README makes to playtesters.

**6. `arsenal-design.md` has drifted from `weapons.ts` on half the roster** ·
confidence 97

15 of 30 guns carry at least one stale stat, plus 15 stale dmg/AP figures. Selected —
full table in the appendix:

| Gun | field | doc | code |
|---|---|---|---|
| Micro Uzi | damage / acc / mag | 2 / .50 / 20 | **3 / .47 / 24** |
| AWP | damage | 18 | **16** |
| Remington 700 | damage | 11 | **9** |
| P90 | damage / armorPierce | 2 / 1 | **3 / 2** |
| M249 | damage | 2 | **3** |
| MP5 | damage / acc | 2 / .85 | **3 / .70** |
| AN-94 | baseAccuracy | .90 | **1.0** |

Prose has drifted with the numbers: "Eighteen damage one-shots everything" (`:409`) and
"Eleven damage deletes T2's elite humans" (`:390`) describe guns that no longer exist.
This is precisely the failure mode AGENTS.md's **drift rule** was written to prevent, and
it names the previous instance of it.

**7. `arsenal-design.md` names the one implementation site the project's own guardrail
forbids** · confidence 96

`docs/arsenal-design.md:107-108`: "flat DR per pellet… **One subtraction in `dealDamage`**".
Code: `combat.ts:72,91` applies it inside `fireWeapon`'s per-pellet `land()` closure.
AGENTS.md: "applied inside `fireWeapon`'s loop — **never** in `dealDamage`, which would
tax a four-pellet volley once instead of four times and delete the whole mechanic."

A contributor following the design doc would implement the exact bug the guardrail exists
to prevent. The doc is not merely stale here; it is actively misleading about a
load-bearing rule.

**8. Miniboss placement is hardcoded; the doc describes a seeded variance mechanism that
does not exist** · confidence 95

`bestiary-design.md:92-93` ("Bosses spawn on either floor of their pair (seeded) — small
placement variance") and `:440` ("Bosses are placed by `applyFloor` from the pair's seeded
hash") vs `floors.ts:67,99,132,148,164` — `boss: "janitor"` on depth **2** only, handler
on **4**, warden on **6**, dozer on **7**, ceo on **8**. `floor.ts:88` reads `def.boss`
directly. No hash, no pair, no variance.

**9. The bot harness has never seen floors 6–8, and no test ever wins through play** ·
confidence 95

Instrumenting `runBot` on the three seeds in `run.test.ts:10`:

```
seed 1:     dead  turns=55   deepestFloor=3  killedBy=Security Contractor — Floor 3
seed 88412: dead  turns=135  deepestFloor=4  killedBy=Security Contractor — Floor 4
seed 7:     dead  turns=206  deepestFloor=5  killedBy=Heavy Gunner — Floor 5
```

`run.test.ts:18` accepts `dead` as a pass, so the harness's reach silently shrank as the
tower's difficulty grew — it now dies ~60% of the way up. The DATA CENTER, floors 7–8, the
Dozer, the Warden and the entire CEO duel are exercised only by hand-built unit states.
The sole `phase === "won"` assertion (`floor.test.ts:118-130`) teleports the player onto
the stairs eight times and never fights, spawns, or spends anything.

Findings 1, 3 and 4 are all on floors 5–8. They are exactly what this gap is shaped to
miss.

**10. `main.ts` holds a 231-line keydown listener with 14 precedence gates and zero
tests** · confidence 93

`src/main.ts` is 506 lines; only 149 sit inside its 9 named functions. The rest is the
`window.addEventListener("keydown", …)` closure at **276–506**, with 19 early `return`s,
14 sequential top-level gates, and 11 mutable module bindings. No test imports the file —
and none can: `main.ts:39-49` runs `getElementById` at module scope.

Mode precedence, the trade-in state machine, `exploreTick`'s five halt paths and
`cycleTarget` are all *decision logic that touches no DOM*, and all unreachable from a
test. AGENTS.md's own gotchas record two shipped bugs of exactly this shape. The newest
feature is the clearest illustration: auto-explore's *decisions* have 28 tests
(`explore.test.ts`), and its *brakes* — timer teardown, post-step contact re-check —
have none.

**11. Two input modes can be live at once, and `f` then throws a grenade** ·
confidence 92

The `x` / drop-mode handler (`main.ts:429`) sits **above** the `throwAim` handler
(`main.ts:440`), so `x` never reaches throwAim's "any other key cancels" path
(`main.ts:456`). Press `5` (grenade) → cursor opens; press `x` → drop mode arms with the
blast cursor still painted; press any non-slot key → `dropMode` clears and `hint = ""`,
leaving an armed aim cursor with no mode text. Press `f` expecting to fire, and
`main.ts:451` matches inside the still-live throwAim block: `{type:"throwItem"}` at the
stale cursor tile. A grenade is spent, possibly on the player's own footprint.

**12. `hasLos` symmetry — a documented, already-shipped bug — has no regression test** ·
confidence 95

`src/sim/los.ts` (69 LOC) is imported by **zero test files**; the only test-tree reference
is `bot.ts:8`, where it is a helper, not an assertion. AGENTS.md: *"the naive single-ray
version let the player shoot a cop that couldn't shoot back. Don't 'simplify' it."*

The property currently holds — 4,834 floor-tile pairs probed across 5 seeds × 8 floors,
**0 asymmetric**. But it is unguarded, the bot uses `hasLos` symmetrically by construction
so it cannot detect a regression either, and the project has already paid for this bug
once. Cheapest missing test in the repo.

### 🟡 Medium

**13. Promotion fires mid-action, not between turns** · confidence 95 · **PROVEN**

`step.ts:110-112` — `checkPromotion` sits *outside* the `player.ap <= 0` block, so it runs
after every action. Its own adjacent comment ("so the review lands between turns rather
than interrupting a half-spent one") and AGENTS.md ("**between** turns, never mid-action")
both describe behavior the code does not implement.

```
before:          xp 34, needed 35 | ap 3 | hp 5
after bump-kill: phase = promoting | ap = 2 | hp = 13
```

The player takes a full heal and a perk with 2 AP still in hand, before the enemy round
resolves. `promotion.test.ts:41-55` intends to cover this — its
`applyAction(state, {type:"wait"}) // end the turn; review lands between turns` is a
**no-op**, swallowed by the `phase === "promoting"` gate at `step.ts:80`, because the
promotion already fired on the preceding move.

**14. Weapon pickup leaves a stale open bolt on the new gun** · confidence 95 · **PROVEN**

`step.ts:440-443` writes `weaponId`/`ammoInMag`/`slots[active]` but never
`delete player.chambered` — unlike drop (`:586`), trade-in (`:719`), reload (`:270`) and
swap (`:314-315`).

```
weaponId now: awp | chambered: false
log: [ 'You drop the Mosin-Nagant.', 'You take the AWP.' ]
```

A freshly acquired AWP with a full magazine starts with an open bolt: firing costs
`apFire + cycle` = 2 AP, and `R` hits the bolt-cycle branch at `step.ts:235` *before* the
"Magazine already full" check at `:246`, burning 1 AP to work the bolt on a rifle that has
never been fired.

**15. Hazard Pay counts enemies the player cannot see** · confidence 92

`step.ts:125` — `state.enemies.some((e) => state.visible[idx(...)])` omits the `!e.hidden`
term that `visibleEnemies` (`explore.ts:72`) and `pickTarget` (`step.ts:800`) both carry.
A Stealth Unit inside the 8-tile FOV but outside its 2-tile `revealRange` silently
withholds the +1 AP.

The perk's own blurb (`perks.ts:99`) reads "+1 AP on any turn that starts with **nothing
in sight**" — a unit the renderer refuses to draw is by definition not in sight, so the
code contradicts its player-facing spec. Stealth Units spawn on floors 5–8 at weights
10–18. **No sim test covers `hazard_pay` at all** — only a sidebar render test references
it, which is why this survived. (`ergonomic`, `asset_recovery` and `field_awareness` are
likewise uncovered; the other 10 perks have sim tests.)

**16. The golden snapshot has only ever seen the first two floors** · confidence 90

Last regenerated at `970c506` (2026-07-31) — **31 commits ago**, 5 of which touched
`sim/{step,combat,ai}.ts`. It pins `turn: 47, floor: 2` and `turn: 6, floor: 1`. Neither
run reaches floor 3, a `dead` or `won` phase, a boss, an armored enemy above T1, or a
non-null `carrierId`. The scripted half is 12 hardcoded actions that never reach a shop,
a promotion, or an item.

It is a sharp instrument for what it touches — `rngState` plus the full log — but "31
commits without the canary needing regeneration" partly reads as *the canary is looking at
the lobby*.

**17. `run.test.ts` would pass if enemies stopped taking turns entirely** ·
confidence 90

`run.test.ts:18-20` asserts `outcome !== "stalled"`, `actions > 0` (tautological), and
`killedBy` truthy only if dead. The real teeth are `assertStateInvariants`, and every
invariant it checks — serializability, `ap >= 0`, `hp <= maxHp`, non-negative ammo, array
lengths, unique ids, entities not in walls — is a **safety** property. Not one is a
liveness or progress property.

Make `runEnemyTurns` a no-op and every invariant still holds, the bot walks to the stairs
unmolested, and all four tests pass *more* comfortably than today. Same for deleting all
drops, all XP, or all promotions.

**18. `explore.test.ts:70` asserts a tautology** · confidence 97

```ts
expect(result.action.dx).toBeLessThanOrEqual(0 + 1);
```

`dx` is typed `-1 | 0 | 1` (`actions.ts:4`), so this holds for every possible value. The
test is named "routes only through explored tiles" and its comment claims it prevents
auto-explore pathing toward known-but-unreachable ground east of a wall — the assertion
meant to catch that should be `<= 0`. An implementation that walks *east* toward the
unlinked goal passes. This is the single guard on the load-bearing anti-oracle property of
`input/explore.ts`.

**19. The perk "lint" rules check identifier spelling and marketing copy, not behavior** ·
confidence 92

`promotion.test.ts:193-200` asserts perk **object key names** do not match
`/mult|factor|scale|percent/i`. `promotion.test.ts:202-206` asserts the player-facing
**blurb string** does not match `/maximum ap|\+1 max/`.

AGENTS.md calls both "hard rules, both linted." A perk `{ dmgBonus: 1.35 }` consumed
multiplicatively at the call site passes the first cleanly; a perk granting `maxAp += 1`
with the blurb "you work faster" passes the second. Neither test touches `step.ts` or
`combat.ts`, where perks are actually applied. Contrast `bestiary.test.ts:99-104` and
`floor.test.ts:63-77`, which compute the real quantity from the real data and would
genuinely fail.

**20. The chaff spawn-weight rule is violated on four of eight floors and enforced by
nothing** · confidence 92

`bestiary-design.md:431-432`: "Chaff (`XP ≤ 3`: Roomba, FPV, camera) holds **15–25%**
everywhere — the pistol contract's supply line." Computed from `floors.ts` (weights sum to
100 on every floor):

| Floor | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| chaff % | 18 | 18 | **14** | **12** | **14** | 22 | **12** | 16 |

`floor.test.ts:60-75` asserts only the melee 28–45% band. Half the tower is under the
stated floor and nothing catches it — either the range is wrong or the tables are.

**21. CI never runs on the branch the work is on** · confidence 96

`.github/workflows/ci.yml:3-7` triggers only on `push`/`pull_request` to `main`. The
current branch is `v0.3.0` with **6 commits**, none of which has been through CI. The
project's pattern is long-lived version branches (`feat/alpha`, `v0.2.0`, `v0.3.0`) merged
at release, so an entire version accumulates with only local verification, and CI's first
opinion arrives at the merge PR when the diff is largest. Adding `push: branches: ["**"]`
is the whole fix.

**22. `handlePlayerAction` is 440 of `step.ts`'s 817 lines** · confidence 93

14 top-level functions; `handlePlayerAction` spans 176–615. Ten of its eleven cases are
cohesive validate-then-charge handlers, so most of the size is dispatch-table size. The
exception is `pickup` (322–445, **124 lines**), a second hand-rolled switch over six
`GroundItem.kind` values that never got the treatment the outer switch did — and it
duplicates purchase logic already in the same file. The `SPARE_PLATE_CAP + deep_pockets`
expression is verbatim at both `step.ts:346` and `step.ts:678`; the hotbar
stack-or-create idiom appears three times (`391`, `409`, `691`).

`step.ts` carries 175 branch tokens, the highest density in `src/`. Every test enters
through it, so it is heavily exercised — but mapping a failed assertion back to a branch
inside a 440-line switch is the weakest diagnostic in the codebase.

**23. Remaining doc/data drift** · confidence 93

| Claim | doc:line | doc | code |
|---|---|---|---|
| Perk `Overtime` | progression-design.md:184 | exists, "+1 AP first turn of a fight" | **no such perk**; `hazard_pay` fires on the *opposite* condition |
| XP thresholds | progression-design.md:145 | `12 + 8·(N−1)` | `35n + 8n(n−1)` (`perks.ts:135`) — ~3× off at level 2 |
| Sound stagger | sound-design.md:207,230 | 40–60 ms / 50 ms | `spacingMs = 100` (`sfx.ts:209`) |
| Sound path | sound-design.md:47,246 | `/sounds/<name>.wav` | `sounds/…` — the leading slash is the 404 bug fixed in 211eca8 |
| Weapon count | arsenal-design.md:127 | 28 | **30** |
| Dozer XP | progression-design.md:142 | 25 | `xp: 30` (`enemies.ts:583`) |
| Shop weapon price | progression-design.md:222 | 40–60 | `{1:40, 2:55, 3:75, 4:95}` (`shop.ts:56`) |

Plus: `alpha-roadmap.md:191-194` still lists **Hotbar slot grid** as `[ ]` though `b64fa06`
shipped it (`index.html:258` is now a single `display: grid` rule and `.consumable-empty`
is gone); two sub-items of the unchecked "Balance patch set" already shipped;
`README.md:7` says "Currently **v0.2**" on a `v0.3.0` branch with three v0.3 items done;
and `src/render/camera.ts` + `test/render/camera.test.ts` appear in **no doc anywhere** —
not the AGENTS.md directory map, not `docs/`.

**24. The `index.html` ↔ `sidebar.ts` contract is 115 unverified string names** ·
confidence 85

`index.html` defines 115 CSS selectors; `render/dom/*` writes 123 class tokens as string
literals. `sidebar.ts:88` defines `q(sel)` which **throws** `sidebar missing ${sel}` on a
miss and is called ~40 times. Cross-checking both directions: 4 classes are styled and
emitted by nothing (`rs-hi`, `rs-lo`, `rs-mid`, `rs-out`); 6 are written into the DOM with
no style rule but are live query hooks. Nothing checks either direction — not typecheck,
not tests. That failure mode has shipped once already (`sidebar.ts:69-77` documents a
`RangeError` that "aborted the frame after the HP bar" while the sim kept advancing).

Note the build constraint does **not** force this shape: `vite-plugin-singlefile` inlines
imported CSS as readily as an inline `<style>`, so a `sidebar.css` would satisfy both
build targets.

**25. Auto-explore stopped by an unbound key never repaints, so the hint keeps lying** ·
confidence 90

`main.ts:285-293` calls `stopExplore("")` but only renders when the key was `e`. Any other
key falls through to `main.ts:475`, and if `actionForKey` returns null it `return`s
without `render()`. Press `E`, then `Escape`: the walk stops, but the hint row still reads
"Auto-exploring: any key stops." until the next successful action. The mode's only
feedback channel misreports its own state.

### 🟢 Low

**26. The camera's "goes dark" message can never print** · confidence 97 · **PROVEN**
`ai.ts:164-166` returns when `alarmWaves >= cap`; the log branch at `:187-192` requires
`> cap`. Since `alarmWaves` only ever increments by 1, the guard always wins.
Probe: camera reached `alarmWaves: 2`, spawned 4 enemies over 25 turns, and never logged
it. The player has no way to learn a camera is spent and keeps paying attention to a
harmless prop.

**27. A hidden Stealth Unit is a solid, invisible wall** · confidence 85
`hidden` is cleared at exactly one site (`ai.ts:306`), by the unit's own AI. `entityAt`
ignores it, so bumping an unrevealed Stealth Unit spends 1 AP on a knife attack against an
empty-looking tile — the log reads "You knife the Stealth Unit for 2" over blank floor.
Self-corrects one enemy turn later. `explore.test.ts:89` shows auto-explore deliberately
ignores hidden units, so an autopilot run walks straight into it.

**28. A failed sound fetch is cached forever** · confidence 85
`audio.ts:51-63` memoises the *promise* and `.catch(() => null)` resolves it to `null`
without evicting. Nothing ever calls `buffers.delete`. One transient fetch failure on the
first Glock shot silences the pistol for the whole 30-minute session.

**29. An exhausted perk pool soft-locks the `promoting` phase** · confidence 80
`rollPerkOffer` returns `[]` once all 14 perks are taken; `checkPromotion` still sets
`phase = "promoting"`, and `resolvePromotion` bails on `!perkOffer?.includes(perkId)`.
No action can leave the phase. Reachable today via the shipped debug op
`{kind:"xp", amount:5000}`. Fair play needs 1,946 XP, likely above the tower's total — so
debug-path-only in practice, but a genuinely unrecoverable state.

**30. Restart leaves the previous run's hint on screen** · confidence 88
`main.ts:379-397` resets `state`, the seed URL, `ui.targetId` and `heat` — but not `hint`.
Turn 1 of a fresh run can display "Floor explored: press E again to head for the stairs."
over an unexplored floor.

**31. Trade-in prompt renders "Give up the that slot"** · confidence 80
`screens.ts:202-208` — `losingId` is undefined for an empty slot and the fallback
`"that slot"` is substituted into a template that already supplies the article. Reachable
after dropping the in-hand gun and buying at the shop.

**32. Nothing asserts a sound cue resolves to a real asset** · confidence 90
`sfx.test.ts` checks cue *selection*, never that the name is a file. All 43 weapons
currently resolve (verified, 0 missing), but the three-way coupling between `sfx.ts`,
`generate.py`'s `GUN_TABS`, and `public/sounds/` is enforced by nothing — a 44th weapon
with no voice ships a silent gun with a green suite.

**33. No coverage tooling, no linter, `build:zip` never built in CI** · confidence 95
No `@vitest/coverage-*` installed and no `vitest.config.ts`, so no coverage number exists
for anyone — every coverage claim in this report and in AGENTS.md is by inspection. No
ESLint/Prettier/Biome config and no `lint` script; every "lint" in AGENTS.md means a
vitest assertion. `npm run build:zip` — a different plugin path with its own documented
failure mode — is never run in CI.

**34. `tools/soundgen/` is 1,457 untested lines, but the byte-stability claim holds** ·
confidence 94
Regenerated out-of-tree and diffed: **88 WAVs, byte-identical**, stdlib-only imports, both
RNG sites locally seeded. The generator is a build *input* with committed artifacts, so it
cannot break the game — the residual gap is that nothing verifies the reproduction, so a
non-deterministic edit would surface as 88 rewritten files in a commit meant to touch one.

**35. Export doc density is 51%** · confidence 100
104 of 205 exported declarations carry an adjacent comment. Absence concentrates in
`sim/state.ts` (6/21), `sim/events.ts` (1/7), `data/enemies.ts` (1/5). Given how heavily
this codebase comments *constraints* where it matters, this is a low-priority observation,
not a call to add boilerplate.

---

## What is genuinely healthy

Stating this precisely matters as much as the findings, and an audit that only lists
problems misrepresents the repository.

- **All four invariants hold**, verified by grep and by reading. No DOM in the sim, no
  renderer writes to state (checked across every `.push/.splice/.sort` in `src/render` +
  `main.ts` — both `.sort()` calls operate on filtered copies), no unseeded randomness, no
  `Map`/`Set`/class in `GameState`, no data-table aliasing into entities.
- **Zero import cycles** across 41 modules and 148 edges. The single cross-layer edge
  (`render/dom/screens.ts` → `input/controls.ts`) is declared and deliberate.
- **Armor arithmetic is correct** — DR computed once, subtracted per pellet inside
  `land()`, never applied in `dealDamage`, and melee's `bypassShield` skips only the plate
  pool. The mechanic AGENTS.md calls load-bearing is implemented exactly as specified.
- **`runEnemyTurns` handles mutation-during-iteration properly** (snapshot copy plus
  `state.enemies.includes`), and no enemy loop can spin on a zero-cost shot.
- **`BEAT_ROLE` and `HALT_ON` are total** over `SimEvent["kind"]`, all 27 kinds classified;
  `playback.ts` clears every timer on cancel; frame times are provably non-decreasing.
- **`controls.test.ts` genuinely walks the keymap in both directions** (modifiers aside).
- **Doc accuracy is high where it was checked and passed**: all 22 enemy stat lines, all
  ten consumable prices, the carrier table, the camera rework constants, the §10 ammo
  premium formula character-for-character, the melee 28–45% rule on all eight floors,
  floor 6's zero-human assertion, 88 WAVs matching an 88-entry manifest with no orphans in
  either direction, and 15 of 30 guns stat-for-stat exact.
- **The commit register is unusually good** — messages argue the decision, mechanical
  churn is isolated into its own commits, and `b64fa06` is a model of the form.

---

## Treatment

> **These are recommendations, not findings.** Unscored. They are judgment about what the
> diagnosis implies and should be weighed against context this audit cannot see — the
> v0.3 schedule, how much the balance pass will rewrite anyway, and how much of this is
> worth doing before a rewrite touches it.

### Gate enemy behaviors on AP in one place

**Addresses:** 1, 3, 4 · **Scope:** small — half a day · **Risk:** medium (golden regen)

Findings 1, 3 and 4 are three faces of the same structural gap: `runEnemyTurns`
(`ai.ts:27-34`) dispatches behaviors unconditionally and trusts each of the eight to
police its own AP. Six do; two do not; and the flag that would make bracing symmetric is
written on only one side of the same shared combat path.

The fix is at the dispatcher, not in the behaviors — `if (enemy.ap <= 0) continue;` before
`BEHAVIORS[...]` makes the stun contract true for all eight behaviors at once and stays
true for a ninth. Then set `movedThisTurn` inside `stepToward`/`wanderStep` so the flag is
written wherever movement actually happens rather than at one call site, and give
`overwatch` the reload branch its two siblings already have.

This is a sim behavior change and will move the golden snapshot, so it wants its own
reviewed commit per the project's own ⟲ discipline. Do it **before** the balance pass, not
after: finding 3 means the Heavy Gunner's real accuracy is 23% above spec, so tuning
numbers now would be tuning against a broken measuring stick.

**Counter-argument:** `magSize: 99`/`100` on `warden_slam`/`minigun` suggests the ammo
half was already noticed and worked around deliberately. If that was a considered choice,
the reload branch is unnecessary and only the AP gate matters — but the turret at
`magSize: 12` and weight 44 on floor 6 is not covered by that workaround.

### Filter modifier chords at the one place keys enter

**Addresses:** 2 · **Scope:** trivial — under an hour · **Risk:** low

An early `if (e.ctrlKey || e.metaKey || e.altKey) return;` at the top of the keydown
listener, before every mode gate. It cannot regress anything, because no binding in
`CONTROL_GROUPS` uses a modifier today.

Worth doing on its own and immediately: it is the cheapest fix in this report and the only
finding that can end a live run through no fault of the player. Extend
`test/sim/input.test.ts` to construct one event with `metaKey: true` and assert
`actionForKey` returns null, so the "keymap cannot lie" test stops being blind to the
class.

### Make the bot harness climb, and assert progress rather than absence-of-crash

**Addresses:** 9, 17, 12, 16 · **Scope:** medium — 1–2 days · **Risk:** low

The harness is the repo's stated superpower and it has quietly stopped reaching the half
of the tower where the balance work lives. Two changes carry most of the value:

1. **Assert depth.** `run.test.ts` should require a floor reached, not merely a
   non-stalled outcome. A bot that dies on floor 3 for all three seeds is itself a
   finding — either the seeds need replacing or the T2 difficulty step (already a flagged
   debt) is worse than believed.
2. **Add one liveness invariant.** Everything in `invariants.ts` is a safety property, so
   a sim that stopped doing anything would pass. Something as simple as "over any 20-turn
   window, either the player's HP changed or an enemy's position changed" would have
   caught findings 1 and 4 directly.

A `hasLos` symmetry test (finding 12) is a ten-line loop over map pairs and belongs in the
same commit — it guards a bug the project has already paid for once.

**Counter-argument:** deepening the golden snapshot to floors 3+ is tempting here but
probably wrong to do *now* — the v0.3 balance pass will invalidate it immediately.
Regenerate it deliberately after the balance patch set lands, not before.

### Run the drift rule as a test instead of a policy

**Addresses:** 6, 7, 8, 20, 23 · **Scope:** medium — 1–2 days · **Risk:** low

Findings 6, 7, 8, 20 and 23 are one problem with five faces, and AGENTS.md already
diagnosed it: *"a doc line that can drift silently is worse than no line."* The rule
exists, is stated well, and has been violated on half the arsenal, both boss-placement
claims, the XP curve, a perk that no longer exists, and the armor guardrail itself. A rule
this well-argued that fails this consistently is not a discipline problem — it is missing
tooling.

The highest-leverage move is not to fix the numbers by hand. It is to **stop the design
docs from restating numbers at all** where a test can print them, and to test the ones
that remain:

- The per-gun stat lines in `arsenal-design.md` are the worst offender and the least
  useful prose — they duplicate `weapons.ts`, which is already the balance spreadsheet.
  Cut the stat line from each gun entry and keep the *argument* (band shape, what the gun
  is for), which is what the doc is actually good at and what code cannot express.
- Convert the checkable prose rules into assertions next to the ones that already work:
  the chaff 15–25% band (finding 20) alongside the melee-weight test it sits beside in the
  same doc paragraph, and a boss-placement assertion that either matches `floors.ts` or
  forces the doc to be rewritten.
- Fix finding 7 by hand and immediately — a doc that names the forbidden implementation
  site is worse than no doc, and it is one line.

**Counter-argument:** cutting stat lines loses the at-a-glance comparison table that makes
`arsenal-design.md` readable. If that matters, generate it — a test that regenerates the
table and fails on mismatch keeps both properties. That is more work than it sounds and
probably not worth it before the balance pass rewrites the numbers anyway.

### Extract the mode machine from `main.ts`

**Addresses:** 10, 11, 25, 30 · **Scope:** large — 2–4 days · **Risk:** medium

Findings 11, 25 and 30 are all the same bug shape: mode state (`throwAim`, `dropMode`,
`exploring`, `hint`, `tradeIn`) lives as loose module-level `let`s with a precedence order
encoded only in the physical ordering of 14 `if` blocks, and transitions between them are
inconsistent about cleanup and repaint. Three separate bugs found in one listener is the
signal.

The project's own convention already prescribes the fix and has applied it well four times
(`weaponinfo.ts`, `enemyinfo.ts`, `log.ts`, `anim.ts`): the *pure* half goes in a tested
module, only the DOM write stays. A `render/uimode.ts` exporting
`nextMode(mode, key, state) -> {mode, action?, hint, repaint}` would be a pure function of
plain data, directly testable, and would make "which mode wins" a table rather than a
source-ordering accident.

**Counter-argument:** this is the largest item here and it competes directly with the
balance pass for v0.3's time. The three concrete bugs can each be fixed in place in
minutes (clear `throwAim` in the `x` branch; call `render()` on the null-action path;
reset `hint` on restart). If v0.3 is schedule-pressed, take the three point fixes now and
schedule the extraction for v0.4 — but take them *knowing* that the listener will keep
producing this bug class until the state machine is explicit.

### Point CI at every branch

**Addresses:** 21 · **Scope:** trivial · **Risk:** none

`push: branches: ["**"]`. The project develops on long-lived version branches and merges
at release, so today CI's first opinion arrives when the diff is largest. Six commits on
`v0.3.0` are currently unverified by anything but local runs. Add `npm run build:zip` to
the same job while it is open (finding 33) — it is a distinct plugin path with a
documented failure mode and nothing else exercises it.

### Split `Entity` before the next role-specific field

**Addresses:** 22, plus AGENTS.md debt #4 · **Scope:** large · **Risk:** medium

Recorded rather than recommended for now. The declared debt understates itself: `Entity`
carries 29 fields across **five** role clusters, and six fields serve 1–4 of 26 enemy
defs. The rule "split before adding **any** new role-specific field" has already been
routed around once — `GameState.god` (`state.ts:148-153`) carries a comment explaining it
was pushed off `Entity` *because* of this debt, so the workaround shipped before the fix.
The 69.6% `state.ts` ↔ `step.ts` co-change is this debt visible in the churn data.

This is the right call to defer during a balance pass, which touches data tables rather
than state shape. But it should be the first structural work after v0.3, and the `pickup`
sub-switch (finding 22) is the natural companion cleanup — 124 lines duplicating purchase
and hotbar logic that already exists twice elsewhere in the same file.

---

## Appendix

<details>
<summary>Full hotspot table (churn × size, normalized)</summary>

| Score | Commits | LOC | File |
|---|---|---|---|
| 0.798 | 20 | 819 | `index.html` |
| 0.756 | 19 | 817 | `src/sim/step.ts` |
| 0.517 | 21 | 506 | `src/main.ts` |
| 0.381 | 8 | 978 | `src/data/weapons.ts` |
| 0.336 | 11 | 628 | `src/data/enemies.ts` |
| 0.292 | 20 | 300 | `src/sim/state.ts` |
| 0.239 | 14 | 351 | `src/sim/combat.ts` |
| 0.217 | 9 | 496 | `src/sim/ai.ts` |
| 0.127 | 12 | 218 | `src/render/dom/sidebar.ts` |
| 0.122 | 9 | 278 | `docs/alpha-roadmap.md` |
| 0.120 | 10 | 246 | `golden.test.ts.snap` |
| 0.117 | 8 | 300 | `src/sim/floor.ts` |
| 0.092 | 8 | 237 | `test/sim/bot.ts` |
| 0.089 | 8 | 228 | `src/render/dom/screens.ts` |
| 0.088 | 9 | 201 | `src/render/tiles.ts` |

**`index.html`'s #1 rank is an artifact.** `git show 39255c3^:index.html` → **236 lines**;
`git show 39255c3:index.html` → **818**. A single prettier commit tripled the file, and a
second mechanical commit (`a657f5c`, +81/−80) accounts for another. Both the size and
churn terms are inflated by formatting work the project's own rules already isolate. The
real content is a 236-line-equivalent stylesheet touched 18 times in 18 days.
**`src/sim/step.ts` is the actual #1 hotspot** and should drive prioritization.

</details>

<details>
<summary>Co-change coupling (co-commits / commits touching either)</summary>

| % | Ratio | Pair |
|---|---|---|
| 69.6 | 16/23 | `sim/state.ts` ↔ `sim/step.ts` |
| 66.7 | 8/12 | `data/enemies.ts` ↔ `sim/ai.ts` |
| 65.0 | 13/20 | `sim/combat.ts` ↔ `sim/step.ts` |
| 63.6 | 7/11 | `sim/floor.ts` ↔ golden snapshot |
| 61.9 | 13/21 | `sim/combat.ts` ↔ `sim/state.ts` |
| 60.0 | 12/20 | `sim/state.ts` ↔ `test/sim/helpers.ts` |
| 57.9 | 11/19 | `sim/actions.ts` ↔ `sim/step.ts` |
| 56.2 | 9/16 | `data/enemies.ts` ↔ `sim/combat.ts` |
| 55.0 | 11/20 | `data/enemies.ts` ↔ `sim/state.ts` |
| 45.5 | 10/22 | `index.html` ↔ `render/dom/sidebar.ts` |
| 43.8 | 7/16 | `sim/ai.ts` ↔ `sim/combat.ts` |

</details>

<details>
<summary>Import graph: fan-in / fan-out</summary>

| Module | Fan-in | Fan-out |
|---|---|---|
| `sim/state.ts` | **20** | 3 |
| `data/weapons.ts` | 14 | 1 |
| `sim/events.ts` | 10 | 0 |
| `data/enemies.ts` | 10 | 1 |
| `data/floors.ts` | 7 | 1 |
| `sim/rng.ts` | 6 | 0 |
| `main.ts` | 0 | **21** |
| `sim/step.ts` | 3 | **18** |
| `render/dom/sidebar.ts` | 1 | 9 |
| `sim/ai.ts` | 1 | 8 |

**Cycles: none.** DFS over 41 modules / 148 edges produced zero back-edges. The nearest
thing is `sim/actions.ts` → `sim/debug.ts`, which is `import type` and erased at compile.

</details>

<details>
<summary>Full arsenal drift table (doc → code)</summary>

| Gun | doc:line | field | doc | code | code:line |
|---|---|---|---|---|---|
| Micro Uzi | 205 | damage | 2 | 3 | weapons.ts:115 |
| | 205 | baseAccuracy | .50 | .47 | :116 |
| | 205 | magSize | 20 | 24 | :124 |
| | 205 | dmg/AP | ~3.4 | 4.79 | — |
| | 209 | "five pulls" | 5 | 6 | :122 |
| Tec-9 | 167 | baseAccuracy | .60 | .68 | :246 |
| | 167 | dmg/AP | ~3.1 | 3.47 | — |
| Desert Eagle | 176 | baseAccuracy | .72 | .65 | :290 |
| | 176 | dmg/AP | ~4.5 | 4.10 | — |
| Beretta 93R | 194 | baseAccuracy | .68 | .82 | :332 |
| | 194 | dmg/AP | ~3.5 | 4.18 | — |
| MP5 | 214 | damage | 2 | 3 | :352 |
| | 214 | baseAccuracy | .85 | .70 | :354 |
| | 214 | dmg/AP | ~4.6 | 5.67 | — |
| UMP-45 | 223 | damage | 4 | 5 | :374 |
| | 223 | baseAccuracy | .85 | .82 | :375 |
| | 223 | dmg/AP | ~6.1 | 7.38 | — |
| P90 | 232 | damage | 2 | 3 | :396 |
| | 232 | armorPierce | 1 | 2 | :410 |
| | 232 | dmg/AP | ~7.9 | 11.88 | — |
| M4 | 310 | damage | 3 | 4 | :499 |
| | 310 | baseAccuracy | .78 | .76 | :500 |
| | 310 | dmg/AP | ~6.3 | 8.21 | — |
| AN-94 | 328 | baseAccuracy | .90 | 1.0 | :540 |
| | 328 | dmg/AP | ~8.6 | 9.50 | — |
| Mosin-Nagant | 380 | damage | 8 | 7 | :158 |
| | 380 | dmg/AP | ~3.6 | 3.15 | — |
| Remington 700 | 389 | damage | 11 | 9 | :625 |
| | 389 | dmg/AP | ~5.1 | 4.14 | — |
| VSS Vintorez | 398 | band-0 accMult | 0.7 | 0.55 | :648 |
| AWP | 408 | damage | 18 | 16 | :666 |
| | 408 | dmg/AP | ~8.6 | 7.60 | — |
| M249 | 419 | damage | 2 | 3 | :222 |
| | 419 | dmg/AP | ~6.1 | 9.18 | — |
| XM250 | 428 | damage | 3 | 4 | :687 |
| | 428 | baseAccuracy | .62 | .66 | :688 |
| | 428 | dmg/AP | ~8.4 | 11.88 | — |

Stat-for-stat **correct**: Glock, Revolver, Five-seveN, Serbu, M870, SPAS-12, AA-12,
Mini-14, SKS, AR-15, AKM, Garand, FAL, XM7, SR-25.

</details>

<details>
<summary>Test coverage by module</summary>

`src/render/dom/*`, `render/audio.ts` and `render/playback.ts` are untested by stated
convention and are not counted as gaps.

| Module | LOC | Test | Assessment |
|---|---|---|---|
| `main.ts` | 506 | — | **none** — not exempt; 21 commits, `exploreTick`/`cycleTarget` untested |
| `sim/los.ts` | 69 | — | **none** — symmetry invariant unguarded |
| `render/tiles.ts` | 201 | — | none — canvas, but has real branching and no pure extraction |
| `render/atlas.ts` | 59 | — | none — canvas |
| `sim/aoe.ts` | 101 | via `grenades.test.ts` | indirect only |
| `sim/fov.ts` | 19 | indirect | thin |
| `sim/mapgen.ts` | 42 | `mapgen.test.ts` (3) | thin |
| `sim/step.ts` | 817 | 20 files via `applyAction` | well-covered |
| `sim/ai.ts` | 496 | `ai`, `bestiary`, `melee`, `camera` | well-covered |
| `sim/combat.ts` | 351 | `combat`, `armor`, `plates`, `melee` | well-covered |
| `sim/floor.ts` | 300 | `floor` (11), `economy`, `debug` | well-covered |
| `sim/state.ts` | 300 | via helpers + invariants, 14 files | well-covered |
| `sim/debug.ts` | 143 | `debug.test.ts` (21) | well-covered |
| `sim/events.ts` | 89 | `events.test.ts` (7) | well-covered |
| `data/weapons.ts` | 978 | `balance.test.ts` (21) | well-covered |
| `data/enemies.ts` | 628 | `bestiary.test.ts` (25) | well-covered |
| `data/perks.ts` | 137 | `promotion.test.ts` (18) | covered — 4 perks untested; "lints" are string matches |
| `input/explore.ts` | 341 | `explore.test.ts` (28) | well-covered — one vacuous assertion |
| `input/controls.ts` | 91 | `controls.test.ts` (6) | well-covered |
| `render/anim.ts` | 272 | `anim.test.ts` (12) | well-covered |
| `render/sfx.ts` | 217 | `sfx.test.ts` (11) | well-covered — no asset-existence check |
| `render/camera.ts` | 53 | `camera.test.ts` (10) | well-covered |
| `tools/soundgen/*.py` | 1,457 | — | none; not in CI. Byte-stability verified this session |

Perks with **no** sim test: `ergonomic`, `asset_recovery`, `field_awareness`,
`hazard_pay`. The last of these is finding 15.

</details>

<details>
<summary>Exclusions applied</summary>

- `public/sounds/*.wav` — 88 generated build inputs (byte-stability verified separately)
- `package-lock.json` — lockfile
- `node_modules/`, `dist/`, `.vite/`, `__pycache__/` — per `.gitignore`

No vendored directories, minified files, or `linguist-generated` paths exist in this
repository.

</details>

<details>
<summary>Method and read-only guarantee</summary>

**Tier 1 (100% of 107 tracked files):** churn, size, authorship, co-change coupling,
hotspot score, doc density, orphan references — all computed by script from local git
history and the working tree.

**Tier 2 (deep read):** all 41 `src/` modules in full, all 38 test files, all 12 doc
files, `index.html`, `vite.config.ts`, `.github/workflows/ci.yml`, `package.json`. Five
agents ran in parallel over disjoint file sets — two bug hunters (sim core; presentation
and wiring), a structure analyst, a documentation auditor, and a debt analyst — and every
finding above was independently re-verified against source before being scored.

**Tier 3 (execution):** seven findings were proven by running the code. Probe harnesses
and their vitest config live entirely in a scratchpad directory outside the repository and
were run via `--config`; the repository working tree was never written to.

**Verification of the read-only guarantee:** `git status --porcelain` returns empty, and
`npm test` reports 355/355 passing, before and after this audit. No git state was changed,
no packages installed, no formatter run, no file created except this report.

**What this audit could not see:** runtime behavior in a real browser, anything requiring
a human to play, whether the balance numbers are *fun*, and whether the v0.3 schedule
makes any of the Treatment section worth doing.

</details>
