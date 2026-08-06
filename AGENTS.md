# AGENTS.md — Severance Package

Guidance for AI agents (and humans) working in this codebase. Read this before writing code. The design document `docs/tower-design-handoff.md` is the constitution — section references below (§) point into it — but the alpha design docs in `docs/` (`arsenal-design.md`, `progression-design.md`, `consumables-design.md`, `bestiary-design.md`, `ui-design.md`, `ux-design.md`, `sound-design.md`) supersede it where they conflict: they were argued from playtests and design merits, which outrank doc citations. Playtest reports (`docs/play-test-*.md`) are the raw evidence those arguments run on. When a design question is undecided, the tiebreaker is: *"what would Rogue Fable do, but with guns."*

## What this is

An 8-floor, ~30-minute, grid-based, turn-based roguelike with permadeath: TypeScript + Vite + rot.js, canvas renderer, no game framework. The **alpha** shipped: all 8 floors, 30 player weapons across 4 tiers, ~21 enemies, four minibosses and the CEO, plus armor, plates, consumables, grenades, promotions and the economy. Shipped since: the **event stream** (`applyAction` returns `SimEvent[]`), the generated **sound layer** (88 WAVs + WebAudio player), and the **information layer** (gun-card band strip, ARSENAL overlay, full enemy target card). Current work is **v0.2** (UI close-out + debug panel) then **v0.3** (follow camera, balance pass) — see `docs/alpha-roadmap.md`; the balance pass's work order is `docs/play-test-08-04-26.md`.

## The four invariants (never break these)

These are §6 of the handoff, and they are load-bearing — saves, replays, seed-sharing, and the sequel's rewind mechanic all depend on them. Every one is enforced by tests or greppable.

1. **The sim is pure and headless.** `src/sim/**` and `src/data/**` never import from `render/`, `input/`, or touch the DOM. They may import rot.js *algorithms* (RNG, Map, FOV, Path — all headless) but never `Display`. The renderer reads `GameState`; it never writes it. Check: `grep -rn "document\.|window\." src/sim src/data` must return nothing.
2. **GameState is plain serializable data.** `JSON.parse(JSON.stringify(state))` must deep-equal `state` (there's a regression test). No classes, no functions, no `Map`/`Set` in state. Use `delete obj.field` rather than assigning `undefined` when clearing optional fields.
3. **Everything is data.** Weapons, enemies, floors, AP costs live in `src/data/` tables. Adding an enemy must be a data entry plus at most one behavior function in `sim/ai.ts`. If a content addition requires more systems code than that, stop and refactor before adding it.
4. **All randomness is seeded.** The only unseeded random call in the repo is `randomSeed()` in `src/seed.ts` (it picks the seed). Everything else flows from seeded rot.js RNG clones. Check: `grep -rn "Math.random\|Date.now" src` must hit only `seed.ts`.

## Directory map

```
src/
├── main.ts              # wiring: seed → newGame → dispatch/render loop; UI-side state
│                        # (Tab target, drop/throw/trade-in modes, overlays, mute, DEV corner)
├── seed.ts              # ?seed= URL param; the only unseeded random
├── sim/                 # PURE — the game
│   ├── state.ts         # GameState/Entity types, spawnEnemy, small helpers (idx, distance, entityAt, pushLog)
│   ├── actions.ts       # Action union — the sim's entire input surface
│   ├── step.ts          # applyAction: THE single entry point; player action handlers; turn loop
│   ├── events.ts        # SimEvent union + collector — the action's diary (see event stream below)
│   ├── debug.ts         # DEV-only cheat ops, as sim actions — keyless, never environment-aware
│   ├── ai.ts            # behavior registry keyed by EnemyDef.behavior
│   ├── combat.ts        # fireWeapon/meleeAttack/dealDamage/kill + drops — one path for both sides
│   ├── floor.ts         # newGame, buildFloor(seed, floor), applyFloor — floor generation
│   ├── mapgen.ts        # rot.js Digger wrapper
│   ├── aoe.ts           # blast radius — grenades AND the drone's detonation
│   ├── fov.ts / los.ts  # render FOV (shadowcasting) vs shooting LOS (Bresenham) — deliberately separate
│   └── rng.ts           # SimRNG wrapper; state snapshots into GameState.rngState
├── data/                # content tables: weapons, enemies, floors, items,
│                        # perks, carriers, shop, costs
├── render/
│   ├── atlas.ts         # programmatic sprites; tiles.ts — canvas viewport
│   ├── sfx.ts           # PURE event→sound-cue mapper + §6 mix plan (tested)
│   ├── audio.ts         # WebAudio player: lazy decode, stagger scheduler, M-mute (untested by convention)
│   ├── weaponinfo.ts    # PURE gun formatters: band strip, AP line, band rows, formula (tested)
│   ├── enemyinfo.ts     # PURE target card: stat row, alert chips, threat line (tested)
│   ├── log.ts           # PURE log panel: delta-since-last-frame, stick-to-bottom, eviction (tested)
│   └── dom/             # sidebar.ts, screens.ts (overlays incl. ARSENAL), log.ts
│                        # (appends, holds the seq cursor in a closure); DEV-only:
│                        # soundboard.ts (modal), debugpanel.ts (docked, click-driven)
├── input/
│   ├── keyboard.ts      # key → Action mapping; never touches state
│   └── controls.ts      # CONTROL_GROUPS — the printed keymap the controls panel renders from;
│                        # controls.test.ts walks it against actionForKey in BOTH directions
tools/soundgen/          # Python sound generator (synth.py + per-category voices + generate.py)
public/sounds/           # 88 generated WAVs + manifest.json — build inputs, regenerated deliberately
test/sim/                # vitest, node env; helpers.ts builds hand-crafted states;
│                        # bot.ts + invariants.ts + run.test.ts — the permanent bot harness
test/render/             # pure presentation helpers only — never the DOM
```

## How the game advances

Everything goes through `applyAction(state, action): SimEvent[]` in `sim/step.ts`:

1. Rebuild the sim RNG from `state.rngState`.
2. Handle the player action. **Invalid inputs cost 0 AP** and push a log message — never charge for a typo.
3. If player AP ≤ 0 (or they waited): run every enemy's full turn (`runEnemyTurns`), increment turn, refill AP (applying `pendingApDrain`, then clearing it).
4. Check for a promotion — **between** turns, never mid-action.
5. Recompute FOV, snapshot `rng.getState()` back into `state.rngState`.

**The event stream.** `applyAction` returns the action's ordered `SimEvent[]` — the sim's diary of what just happened (shots, hurt, kills, spots, steps, telegraphs, …), consumed by renderers: sound today (`render/sfx.ts` → `render/audio.ts`), staggered turn animation / death recap later. Its contract, enforced by `test/sim/events.test.ts` and tripwired by the golden test:

- **Emission is additive-only.** `emit()` calls never consume RNG and never alter log text — the golden snapshot pins `rngState` + `log`, so a violation goes red immediately.
- **Events are returned, never stored on `GameState`** — serialization and determinism tests are structurally unaffected.
- One `beginEvents`/`drainEvents` pair per `applyAction`; `emit()` outside a collection window is a no-op, so direct test calls to `fireWeapon` etc. stay inert.
- Events carry ids/positions/weaponIds even where sound doesn't need them — the animation consumer is the second reader, and retrofitting union fields is churn.

Three phases pause the loop and accept only their own action: `promoting`
(`choosePerk`), `shopping` (`buy` / `leaveShop`), and the terminal `dead`/`won`.
Ascending stops at the stairwell landing; the next floor is not generated until
the player leaves the shop.

The turn loop is hand-rolled — **do not introduce `ROT.Scheduler`/`Engine`**. The AP-budget model (player spends 3 AP across multiple input events, then enemies each spend their budget) doesn't fit its one-act-per-activation design, and its async lock would drag control flow into the sim.

Enemy behaviors are `while (enemy.ap > 0)` loops where every iteration either spends AP or breaks — verify that property when writing one, it's the infinite-loop guard. Spotting the player costs the spotter its turn (the player always gets one turn of warning). Both sides fire through the same `fireWeapon` path and melee through the same `meleeAttack` path; enemy lethality is tuned by giving enemies their own weapon entries (`glock_cop`, `serbu_guard`), never by special-casing combat code.

## Recipes

**Add a weapon:** entry in `data/weapons.ts`. The shape *is* the balance spreadsheet: `apFire`, `apReload`, `damage` (per pellet), `baseAccuracy`, `bands` (ordered `{maxDist, accMult, dmgMult}` — past the last band is out of range), `magSize`, `caliber`, optional `pellets` (volley guns), `intendedBand` (index — the balance test uses it). Run `test/sim/balance.test.ts`: dmg/AP at the intended band must sit inside the tier window (a sloped per-gun target — ammo-hungry guns earn a premium, bolt guns pay a discount; see `targetFor`), and the gun must fall off a cliff outside its band. Guns are *patterns, not numbers* (§2): differentiate by band shape and AP cost, not raw DPS.

**Add an enemy:** entry in `data/enemies.ts` (hp, ap, `xp`, optional weaponId, sightRange, behavior key, melee fields, `spotLine`, `killVerb`, `drops`). **The behavior registry is full at 8 keys** and `bestiary.test.ts` fails at 9 — a ninth means content demanded systems code, so consolidate or replace one on merit. Add it to floor spawn weights in `data/floors.ts` — melee behaviors (`meleeRush`, `detonate`, `stealthApproach`) must stay 28–45% of total weight per floor (pillar 3: melee pressure is the anti-camping mechanism, and it does **not** lapse on the top floors). Per-hit damage must sit within ±40% of its tier anchor (3 / 4.5 / 6.5 / 8.5); chaff, effect-enemies, detonators and telegraphed shooters are exempt by name in the test. Machines carry `machine: true` and must never drop cash.

**Add a consumable:** entry in `data/items.ts`. An effect is **one plain-data field checked at one site** — the closed list of effect kinds in `items.test.ts` fails on a new one, deliberately, so that adding a mechanic is a decision rather than a drift toward a status-effect framework.

**Add a perk:** entry in `data/perks.ts` plus one conditional at one existing site. Two hard rules, both linted: no multipliers (dmg/AP-at-band is the balance currency and a stacking percentage debases every tier window), and never max AP.

**Add a floor:** entry in `data/floors.ts`; bump `LAST_FLOOR`. Floor content derives from `hash(seed, floor)` — it must never depend on sim history, so a shared seed reproduces the whole tower.

**Add an action:** extend the union in `sim/actions.ts`, handle it in `step.ts` (emit its events next to the `pushLog` calls), map a key in `input/keyboard.ts` **and** add a row to `CONTROL_GROUPS` in `input/controls.ts` — `controls.test.ts` walks the printed keymap against the real bindings in both directions, so an undocumented key (or an advertised dead one) fails tests. AP costs go in `data/costs.ts`. The one exception is `{type: "debug"}` (`sim/debug.ts`), which is deliberately **keyless**: it has no binding and no `CONTROL_GROUPS` row because only the DEV panel dispatches it. Debug ops are actions rather than direct mutation on purpose — the renderer must never write state, `applyAction` owns the RNG round-trip, and cheats you can test are cheats that still work after a refactor.

**Add an event:** extend the `SimEvent` union in `sim/events.ts` (no `undefined`-valued fields — use the `...(cond ? { flag: true as const } : {})` spread), `emit()` at the site adjacent to its `pushLog`, map it in `render/sfx.ts` (or deliberately ignore it there, like `step`), cover it in `test/sim/events.test.ts`. Never let emission touch RNG or log text.

**Add a sound:** a voice function in the matching `tools/soundgen/*.py` module, register it in that module's dict, run `python3 tools/soundgen/generate.py <name-filter>` (byte-stable output; peak levels live in `PEAK_OVERRIDES` in `generate.py`), then map it in `render/sfx.ts` and assert it in `test/render/sfx.test.ts`. WAV regeneration is golden-snapshot discipline: deliberate, in its own commit, never reflexively. Audition via the ♪ SFX soundboard (`npm run dev`).

**Add a pure formatter:** presentation logic that turns state into strings/cells (a gun card row, a target card line) goes in a pure `render/*.ts` module tested from `test/render/` — `weaponinfo.ts` and `enemyinfo.ts` are the pattern. Only the final DOM write stays in `render/dom/`.

## Balance guardrails (§8 — enforced, not aspirational)

- Fights resolve in 3–6 turns; the player dies in 3–5 unanswered hits; most enemies die in 1–3 hits.
- When something feels weak, **make both sides more lethal, not tankier**.
- Ammo is the soft clock: player reserves are per-caliber across four channels (pistol/shell/rifle/heavy); enemies have infinite reserves (their mag cycles create the punish windows — that's the point, don't "fix" it).
- **Armor is the second axis.** Flat DR per *pellet*, applied inside `fireWeapon`'s loop — never in `dealDamage`, which would tax a four-pellet volley once instead of four times and delete the whole mechanic. Blades bypass armor; melee also bypasses the player's plates. That symmetry is load-bearing: it keeps a fully-plated player afraid of exactly the enemies designed to punish camping. If plates feel too safe, cut plate values, never the bypass.
- Burst/volley weapons are the historical dominance risk (§10). The Uzi's guards: per-pellet accuracy collapse past its band, dmg/AP parity with the revolver, 4 rounds per pull. If it dominates anyway, cut per-pellet damage and raise pellet count — keep the spray *feel*, don't nerf accuracy.

## Testing conventions

- **Vitest, node environment.** `npm run test`, `npm run typecheck` — both must be green before any commit. The renderer and input are thin by design, but thin is not "cannot be wrong": both have now shipped a bug the sim tests structurally could not see (unbound keys, an AP pip row that threw). Presentation logic that is *pure* — a key to an action, numbers to a string — gets extracted and covered in `test/render/` or `test/sim/input.test.ts`. Anything that touches the DOM stays untested.
- `test/sim/helpers.ts` builds hand-crafted states (`makeState`, `makeEnemy`, `openMap`, `setWall`) — use these for combat/AI tests instead of `newGame`, so geometry is explicit.
- **The golden test** (`golden.test.ts`) is the replay canary: fixed seed + scripted actions → snapshot. It only changes when sim behavior changes. Regenerate it **deliberately, in its own reviewed commit** (`rm test/sim/__snapshots__/golden.test.ts.snap && npm test`), never reflexively because it went red.
- **Headless bot playtests** are this repo's superpower and have caught real bugs (asymmetric LOS, enemies not waking when shot). The harness is **permanent** now: `test/sim/bot.ts` (`runBot` — A* to goal, fight what's visible), `test/sim/invariants.ts` (`assertStateInvariants`, `assertSerializable`), driven across fixed seeds by `test/sim/run.test.ts`. Extend those for anything reusable; the old temp-file pattern (`test/sim/_playtest.test.ts`, deleted before committing) remains right for one-off sweeps like flood-fill reachability over hundreds of seeds.
- Determinism tests: two runs from the same seed/rngState must `toEqual`. Add one whenever you add a new consumer of RNG.

## Gotchas (learned the hard way)

- **rot.js map generators consume the *global* RNG singleton.** `generateMap` saves/sets/restores global RNG state around Digger. Any new rot.js facility that rolls dice needs the same treatment or map layouts will shift under existing seeds.
- **Bresenham LOS must stay symmetric.** `hasLos` accepts either directed ray — the naive single-ray version let the player shoot a cop that couldn't shoot back. Don't "simplify" it.
- **Being attacked alerts the target** (set in `fireWeapon`/`meleeAttack`). The Stage 3 suppressor attachment is the planned counterplay; removing this breaks camera/stealth logic.
- **`slots[activeSlot]` is stale while a gun is in hand** — `player.weaponId/ammoInMag` mirror the active slot and are written back on swap. The sidebar special-cases this. If Stage 3 attachments make this painful, refactor to slots-as-authority *first*.
- **`pushLog` is the only legal writer of `state.log`** — it also bumps `logSeq`, the
  cursor the log panel appends from. Writing `state.log` directly desyncs the counter
  and the panel silently stops showing new lines (or replays old ones).
- **Node can't run `src/` directly** (extensionless ESM imports) — run scratch scripts through vitest temp files instead.
- **Two build modes, don't collapse them.** `npm run build` emits hashed assets for the Pages deploy (immutable caching, so nobody plays a stale build). `npm run build:zip` inlines the JS/CSS into one `index.html` because Chrome blocks external module scripts on `file://` — but the 88 WAVs are runtime-fetched and can't be inlined, so **the zip build plays silent under `file://`** (`playSound` degrades gracefully; serve over http to hear it). Sound paths are document-relative (`sounds/…`, never `/sounds/…`) because the Pages deploy lives under a project subpath.
- Non-obvious keys: `>` ascends stairs; bumping into an enemy *is* the melee attack (there is no melee action); `s` is both move-down and same-seed-restart (disambiguated by game phase). UI-mode keys that never reach the sim: `?`/`F1` controls panel, `i` ARSENAL overlay, `m` mute, `x`-then-slot drop, Tab targeting. The first keydown of a session also unlocks WebAudio (browser gesture gate).

## Workflow

- **Sim first, renderer second.** Land and test sim changes against data/tests before touching presentation. This ordering saved the Stage 2 renderer rewrite from churn.
- **Milestone commits**: each commit is one runnable, tested milestone with a message explaining *design intent*, not just mechanics. Look at `git log` for the register.
- **Scope is a contract.** §5's cut list (merchant, meta-progression, chrono anything…) is not a suggestion. Sequel ideas go in a note, not the build. Stage N+1 features do not sneak into Stage N.
- **Comments state constraints the code can't show** (why the RNG is saved/restored, why a field is stale) — never narrate what the next line does.
- **The drift rule.** A commit that changes a data table updates or deletes the matching stat line in the design docs — a doc line that can drift silently is worse than no line. (The §10 ammo repricing left `arsenal-design.md` citing pre-repricing Uzi/Mosin/AWP numbers for weeks; that class of rot is the target.)
- Verification checklist before any commit: `npm run typecheck` && `npm run test` && (if the run loop changed) a bot playtest across ≥3 seeds && (if presentation changed) `npm run build` and a human eyeball of `npm run dev`.

## Known debts (fix opportunistically, don't build on them)

1. ~~Duplicated BFS helpers~~ — merged into `freeTilesNear` in `state.ts`; `spawnItemNear` is the one place items reach the ground.
2. ~~Log lines injected unescaped~~ — escaped in `main.ts`.
3. ~~CI~~ — runs typecheck + build + tests on push and PR, and deploys to Pages from `main` (`.github/workflows/ci.yml`).
4. **`Entity` split is now overdue.** It carries player-only fields (`slots`, `activeSlot`), enemy-only ones (`alarmTimer`, `alarmWaves`, `chargeTimer`, `hidden`), duel-only ones (`spares`, `stimUsed`, `empUsed`) — and a fourth cluster started (`spawnedBy`). The old threshold ("a third role-specific cluster is the signal") is well past. Split before adding **any** new role-specific Entity field.
5. The balance pass has not run — it is v0.3's core task and its work order is `docs/play-test-08-04-26.md` (headline: the Exo Trooper's 3×11 consolidated turn breaks the §8 unanswered-hits guardrail). Standing flagged numbers still apply: the gunshot `NOISE_RADIUS`, the T2 difficulty step (deaths cluster on floor 3), and promotion pacing. A human has now reached floor 8; the tower remains unbeaten fairly.
