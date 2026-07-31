# AGENTS.md — Severance Package

Guidance for AI agents (and humans) working in this codebase. Read this before writing code. The design document `docs/tower-design-handoff.md` is the constitution — section references below (§) point into it — but the alpha design docs in `docs/` (`arsenal-design.md`, `progression-design.md`, `consumables-design.md`, `bestiary-design.md`, `ui-design.md`) supersede it where they conflict: they were argued from playtests and design merits, which outrank doc citations. When a design question is undecided, the tiebreaker is: *"what would Rogue Fable do, but with guns."*

## What this is

An 8-floor, ~30-minute, grid-based, turn-based roguelike with permadeath: TypeScript + Vite + rot.js, canvas renderer, no game framework. Currently at **Stage 2 (vertical slice)**: floors 1–2, five player weapons, six enemy types, the ammo economy, tile renderer + sidebar. Stages are defined in §7 of the handoff; each ends with a kill-question that must be answered before advancing.

## The four invariants (never break these)

These are §6 of the handoff, and they are load-bearing — saves, replays, seed-sharing, and the sequel's rewind mechanic all depend on them. Every one is enforced by tests or greppable.

1. **The sim is pure and headless.** `src/sim/**` and `src/data/**` never import from `render/`, `input/`, or touch the DOM. They may import rot.js *algorithms* (RNG, Map, FOV, Path — all headless) but never `Display`. The renderer reads `GameState`; it never writes it. Check: `grep -rn "document\.|window\." src/sim src/data` must return nothing.
2. **GameState is plain serializable data.** `JSON.parse(JSON.stringify(state))` must deep-equal `state` (there's a regression test). No classes, no functions, no `Map`/`Set` in state. Use `delete obj.field` rather than assigning `undefined` when clearing optional fields.
3. **Everything is data.** Weapons, enemies, floors, AP costs live in `src/data/` tables. Adding an enemy must be a data entry plus at most one behavior function in `sim/ai.ts`. If a content addition requires more systems code than that, stop and refactor before adding it.
4. **All randomness is seeded.** The only unseeded random call in the repo is `randomSeed()` in `src/seed.ts` (it picks the seed). Everything else flows from seeded rot.js RNG clones. Check: `grep -rn "Math.random\|Date.now" src` must hit only `seed.ts`.

## Directory map

```
src/
├── main.ts              # wiring: seed → newGame → input/render loop; UI-side state (Tab target)
├── seed.ts              # ?seed= URL param; the only unseeded random
├── sim/                 # PURE — the game
│   ├── state.ts         # GameState/Entity types, spawnEnemy, small helpers (idx, distance, entityAt, pushLog)
│   ├── actions.ts       # Action union — the sim's entire input surface
│   ├── step.ts          # applyAction: THE single entry point; player action handlers; turn loop
│   ├── ai.ts            # behavior registry keyed by EnemyDef.behavior
│   ├── combat.ts        # fireWeapon/meleeAttack/dealDamage/kill + drops — one path for both sides
│   ├── floor.ts         # newGame, buildFloor(seed, floor), applyFloor — floor generation
│   ├── mapgen.ts        # rot.js Digger wrapper
│   ├── fov.ts / los.ts  # render FOV (shadowcasting) vs shooting LOS (Bresenham) — deliberately separate
│   └── rng.ts           # SimRNG wrapper; state snapshots into GameState.rngState
├── data/                # content tables: weapons.ts, enemies.ts, floors.ts, costs.ts
├── render/              # atlas.ts (programmatic sprites), tiles.ts (canvas viewport), dom/ (sidebar, screens)
└── input/keyboard.ts    # key → Action mapping; never touches state
test/sim/                # vitest, node env, sim-only; helpers.ts builds hand-crafted states
```

## How the game advances

Everything goes through `applyAction(state, action)` in `sim/step.ts`:

1. Rebuild the sim RNG from `state.rngState`.
2. Handle the player action. **Invalid inputs cost 0 AP** and push a log message — never charge for a typo.
3. If player AP ≤ 0 (or they waited): run every enemy's full turn (`runEnemyTurns`), increment turn, refill AP (applying `pendingApDrain`, then clearing it).
4. Recompute FOV, snapshot `rng.getState()` back into `state.rngState`.

The turn loop is hand-rolled — **do not introduce `ROT.Scheduler`/`Engine`**. The AP-budget model (player spends 3 AP across multiple input events, then enemies each spend their budget) doesn't fit its one-act-per-activation design, and its async lock would drag control flow into the sim.

Enemy behaviors are `while (enemy.ap > 0)` loops where every iteration either spends AP or breaks — verify that property when writing one, it's the infinite-loop guard. Spotting the player costs the spotter its turn (the player always gets one turn of warning). Both sides fire through the same `fireWeapon` path and melee through the same `meleeAttack` path; enemy lethality is tuned by giving enemies their own weapon entries (`glock_cop`, `serbu_guard`), never by special-casing combat code.

## Recipes

**Add a weapon:** entry in `data/weapons.ts`. The shape *is* the balance spreadsheet: `apFire`, `apReload`, `damage` (per pellet), `baseAccuracy`, `bands` (ordered `{maxDist, accMult, dmgMult}` — past the last band is out of range), `magSize`, `caliber`, optional `pellets` (volley guns), `intendedBand` (index — the balance test uses it). Run `test/sim/balance.test.ts`: dmg/AP at the intended band must sit within ±20% of the tier mean, and the gun must fall off a cliff outside its band. Guns are *patterns, not numbers* (§2): differentiate by band shape and AP cost, not raw DPS.

**Add an enemy:** entry in `data/enemies.ts` (hp, ap, optional weaponId, sightRange, behavior key, melee fields, `spotLine`, `killVerb`, `drops`). If no existing behavior fits, add ONE function to the `BEHAVIORS` registry in `sim/ai.ts`. Add it to floor spawn weights in `data/floors.ts` — melee behaviors must stay 28–45% of total weight per floor (data-asserted in `floor.test.ts`; pillar 3: melee pressure is the anti-camping mechanism). Give it a sprite line in `render/atlas.ts` (auto-generated from the def's glyph/color already).

**Add a floor:** entry in `data/floors.ts`; bump `LAST_FLOOR`. Floor content derives from `hash(seed, floor)` — it must never depend on sim history, so a shared seed reproduces the whole tower.

**Add an action:** extend the union in `sim/actions.ts`, handle it in `step.ts`, map a key in `input/keyboard.ts`. AP costs go in `data/costs.ts`.

## Balance guardrails (§8 — enforced, not aspirational)

- Fights resolve in 3–6 turns; the player dies in 3–5 unanswered hits; most enemies die in 1–3 hits.
- When something feels weak, **make both sides more lethal, not tankier**.
- Ammo is the soft clock: player reserves are per-caliber; enemies have infinite reserves (their mag cycles create the punish windows — that's the point, don't "fix" it).
- Burst/volley weapons are the historical dominance risk (§10). The Uzi's guards: per-pellet accuracy collapse past its band, dmg/AP parity with the revolver, 4 rounds per pull. If it dominates anyway, cut per-pellet damage and raise pellet count — keep the spray *feel*, don't nerf accuracy.

## Testing conventions

- **Vitest, node environment, sim-only.** The renderer and input are thin by design and untested. `npm run test`, `npm run typecheck` — both must be green before any commit.
- `test/sim/helpers.ts` builds hand-crafted states (`makeState`, `makeEnemy`, `openMap`, `setWall`) — use these for combat/AI tests instead of `newGame`, so geometry is explicit.
- **The golden test** (`golden.test.ts`) is the replay canary: fixed seed + scripted actions → snapshot. It only changes when sim behavior changes. Regenerate it **deliberately, in its own reviewed commit** (`rm test/sim/__snapshots__/golden.test.ts.snap && npm test`), never reflexively because it went red.
- **Headless bot playtests** are this repo's superpower and have caught real bugs (asymmetric LOS, enemies not waking when shot). Technique: write a temporary `test/sim/_playtest.test.ts` that drives `applyAction` with a simple bot (A* to goal, fight what's visible), run it across several seeds, print the outcome, **delete the file before committing**. Do this after any milestone that changes the run loop. Sweep-style property tests (e.g. flood-fill reachability of stairs/items/enemies over hundreds of seeds) follow the same temp-file pattern.
- Determinism tests: two runs from the same seed/rngState must `toEqual`. Add one whenever you add a new consumer of RNG.

## Gotchas (learned the hard way)

- **rot.js map generators consume the *global* RNG singleton.** `generateMap` saves/sets/restores global RNG state around Digger. Any new rot.js facility that rolls dice needs the same treatment or map layouts will shift under existing seeds.
- **Bresenham LOS must stay symmetric.** `hasLos` accepts either directed ray — the naive single-ray version let the player shoot a cop that couldn't shoot back. Don't "simplify" it.
- **Being attacked alerts the target** (set in `fireWeapon`/`meleeAttack`). The Stage 3 suppressor attachment is the planned counterplay; removing this breaks camera/stealth logic.
- **`slots[activeSlot]` is stale while a gun is in hand** — `player.weaponId/ammoInMag` mirror the active slot and are written back on swap. The sidebar special-cases this. If Stage 3 attachments make this painful, refactor to slots-as-authority *first*.
- **Node can't run `src/` directly** (extensionless ESM imports) — run scratch scripts through vitest temp files instead.
- **Two build modes, don't collapse them.** `npm run build` emits hashed assets for the Pages deploy (immutable caching, so nobody plays a stale build). `npm run build:zip` inlines everything into one `index.html`, because Chrome blocks external module scripts on `file://` and a zipped multi-file build won't run by double-click.
- Non-obvious keys: `>` ascends stairs; bumping into an enemy *is* the melee attack (there is no melee action); `s` is both move-down and same-seed-restart (disambiguated by game phase).

## Workflow

- **Sim first, renderer second.** Land and test sim changes against data/tests before touching presentation. This ordering saved the Stage 2 renderer rewrite from churn.
- **Milestone commits**: each commit is one runnable, tested milestone with a message explaining *design intent*, not just mechanics. Look at `git log` for the register.
- **Scope is a contract.** §5's cut list (merchant, meta-progression, chrono anything…) is not a suggestion. Sequel ideas go in a note, not the build. Stage N+1 features do not sneak into Stage N.
- **Comments state constraints the code can't show** (why the RNG is saved/restored, why a field is stale) — never narrate what the next line does.
- Verification checklist before any commit: `npm run typecheck` && `npm run test` && (if the run loop changed) a bot playtest across ≥3 seeds && (if presentation changed) `npm run build` and a human eyeball of `npm run dev`.

## Known debts (fix opportunistically, don't build on them)

1. Duplicated BFS helpers: `freeTilesNear` (`ai.ts`) / `freeTileNear` (`floor.ts`) — merge when next touched.
2. `Entity` carries player-only and enemy-only optional fields; a third role-specific cluster is the signal to split the type.
3. No CI — tests are local-only.
4. Log lines are injected via `innerHTML` unescaped in `main.ts` (internal strings only today; escape if log text ever includes external input).
