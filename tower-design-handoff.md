# SEVERANCE PACKAGE — Design Handoff v1.0

*Working title. A classic turn-based roguelike about shooting your way up an evil corporation's tower. Scope target: game one of two — ships small, proves the engine and the AP economy, and feeds directly into the time-travel sequel.*

---

## 1. Vision Statement

An 8-floor, ~30-minute, grid-based, turn-based roguelike with permadeath. You are one intruder with a pistol inside the headquarters of a private military corporation. Enemies escalate from rent-a-cops to drones to things R&D should not have built. Guns are differentiated by firing pattern and action-point cost, not stat inflation. The tone is grounded corporate satire that quietly gets stranger the higher you climb.

**Elevator pitch:** *Nuclear Throne's pacing, DCSS's turn structure, Gungeon's gun-love, in one corporate tower that is lying to you.*

### 1.1 Reference Model: Rogue Fable

The structural template is **Rogue Fable III/IV**, deliberately. What we copy: the short complete run (~30 min) as the entire product; small readable floors with a handful of set-piece encounters rather than sprawling mazes; the single-sidebar UI (§9 is directly modeled on it); simple discrete resource pools shown as pips; a tight, curated item list over procedural affixes; talents/abilities kept to a small hotbar; seeded runs and a visible turn counter; instant restart. What we swap: its fantasy melee/mana kit becomes the AP economy plus the three-caliber ammo clock, its class system becomes build-by-attachments, and its zoo of monsters becomes the 13-enemy corporate roster. When any design question is undecided, "what would Rogue Fable do, but with guns" is the tiebreaker.

## 2. Design Pillars

Every feature decision is tested against these four. If it doesn't serve one, cut it.

1. **The turn is the game.** Every turn is a spend-3-AP puzzle: shoot, move, reload, use. Fights are short (3–6 turns per encounter) and lethal both ways. Positioning AP should matter as much as shooting AP.
2. **Guns are patterns, not numbers.** A shotgun, a burst rifle, and a bolt-action are different *decisions*, not different DPS bars. Damage-per-AP at each range band is the only balance currency.
3. **Melee pressure is the anti-camping mechanism.** Roughly a third of spawn weight has melee/charge behavior so stationary turtling is never free. No pure-ranged rooms after floor 2.
4. **Grounded floor, weird ceiling.** Floors 1–5 play it straight. Floors 6–8 leak the unsettling stuff (test subjects, prototypes). The finale earns spectacle because the baseline was sane.

## 3. Core Loop

Enter floor → explore rooms (FOV-limited) → resolve 4–7 encounters as turn puzzles → loot weapons/ammo/attachments → find stairs → repeat ×8 → CEO fight → win or die → new seed. No meta-progression in v1; the run is the whole game.

Run length target: 25–35 minutes. Floor length target: 3–4 minutes.

## 4. Systems Specification

### 4.1 Turns and Action Points

Player has **3 AP per turn**. Standard costs: move 1 tile = 1 AP; fire = weapon-defined (1–3 AP); reload = weapon-defined (1 AP light, 2 AP heavy, bolt/pump weapons pay a cycling cost baked into fire); use item = 1 AP; melee = 1 AP. Enemies run the same system with 2–3 AP so the player can read them. **Decision locked for v1: reload costs AP, not a full turn** — preserves the shoot-shoot-reposition rhythm; revisit only if playtests show reloads feel free.

Stuns (tasers, flashbangs) drain AP next turn rather than dealing damage. AP denial is the scariest effect in the game; use sparingly.

### 4.2 Weapons

Four tiers keyed to floor depth. Tiers are generational leaps; within a tier, everything is a sidegrade defined by its pattern. All numbers are placeholders for the balance sheet (§8).

**Tier 0 (start):** Glock — 1 AP, medium damage, medium range, small ammo. The baseline.

**Tier 1 (floors 1–3):** Revolver (hard hit, 6 shots, 2 AP reload). Micro Uzi (1 AP fires 4 weak shots with spread to adjacent tiles; devours small ammo). Serbu shorty (devastating ≤2 tiles, useless beyond). Five-seveN (pierces light armor). Mosin-Nagant (2 AP fire including bolt cycle, huge damage, longest tier-1 range; large ammo).

**Tier 2 (floors 3–6):** AR-15 (1 AP, accurate, the "correct" gun). Burst rifle (1 AP = 3-round burst, mid-range sweet spot, sprays at distance). MP5 (accurate 3-shot volley). Pump shotgun (cone spread; pump baked into 2 AP fire). AK (harder hit, worse long-range accuracy than AR). FN FAL (1 AP = 2 heavy hits, high recoil penalty on second shot, chews medium ammo).

**Tier 3 (floors 6–8):** P90 (elite-guard drop, 5-shot volley, 50-round mag). M249/PKM (2 AP deploy, then monstrous 1 AP sustained fire while stationary; large ammo). AWP-class rifle (2 AP, deletes anything, cannot fire at adjacent targets). SPAS-12 (semi-auto shotgun). XM7 (rifle apex).

**Uniques** are named tier-2/3 variants with a baked-in attachment plus one rule-break (e.g., "HR Violation": a FAL that fires 3; "The Intern": micro Uzi that refunds ammo on kills). Cheap content, big flavor. v1 target: 4 uniques.

### 4.3 Ammo

Three calibers only: **small** (pistols/SMGs, plentiful), **medium** (rifles, contested), **large** (snipers/MGs, scarce). Drop tables bias ~60% toward calibers the player currently carries. Ammo scarcity is the soft clock that keeps god-guns from being permanent wins.

### 4.4 Attachments

The build system. Attachments slot onto weapon families and follow the player between guns of that family. v1 set of eight: ACOG (+1 range tile), extended mag, suppressor (kills don't alert the room), laser (removes burst spread penalty), foregrip (tightens shotgun/SMG spread), bipod (removes MG deploy cost), AP rounds kit (ignores light armor/shields' frontal reduction), drum mag (shotgun capacity). Attachments are the routing incentive: finding a drum mag early makes the player hunt shotguns.

### 4.5 Enemies

Thirteen types for v1, in three escalation bands. Ranged, melee, and support roles in every band; melee ≈ one-third of spawn weight.

**Floors 1–3 (security):** Rent-a-cop (pistol). Shotgun guard. Guard dog (2 moves/turn, lunge). Taser guard (melee AP-drain). Janitor (joke tank, wrench, 30 years of tenure). Camera (support "summoner": alerts a response team after 2 turns unless destroyed; suppressor counterplay).

**Floors 4–6 (tactical/robotics):** Riot shield + baton (frontal immunity, herds the player). Tactical rifleman (AR, uses cover). Kamikaze drone (flying charger, explodes, friendly-fires enemies if baited). Swarm bots (packs of 4–6 chaff; makes AoE builds sing). Drone operator (support: streams quadcopters, hides behind them).

**Floors 6–8 (R&D leak):** Maintenance bot (slow, armored, unstoppable corridor horror). Test subject (erratic 1–3 tile movement toward player, melee, unsettling). Stim medic (support: overclocks allies — +AP, damage-per-turn). Juggernaut (elite: minigun, visible armor chipping) doubles as floor-7 miniboss.

**Minibosses:** Breacher team (floor 3 — flashbang + room storm, flips the ambush script). Juggernaut (floor 5 or 7). **Final boss (floor 8, helipad):** phase 1, attack helicopter (strafing telegraphs, vulnerable while troops deploy); phase 2, the CEO in a prototype exosuit, remixing prior enemies as summons, corporate barks throughout ("This is coming out of your severance").

### 4.6 Floors

Procedural rooms-and-corridors, 8 floors, one tileset with per-band palette/prop swaps (lobby → offices → labs → helipad). 4–7 encounters, 1 loot room, occasional locked armory (keycard drops) per floor. Encounter generator rules: mixed roles mandatory after floor 2; support enemies placed in the open early, behind tanks late.

## 5. Content Budget (v1 ship list)

20 weapons + 4 uniques, 8 attachments, 3 calibers, 13 enemies, 2 minibosses, 1 two-phase boss, 8 floors, 1 tileset ×3 variants, ~15 SFX, 4 music tracks (bands + boss), title/death/win screens, seed input. **Explicitly cut from v1:** merchant, skill trainer, grit meter, chrono anything, meta-progression, melee weapon builds beyond a knife slot, secret floors. All of it is game two or v1.1.

## 6. Technical Architecture

**Stack: TypeScript + Vite + rot.js, Canvas renderer, itch.io distribution.** rot.js supplies FOV, A* pathfinding, map generation, scheduling, seeded RNG. No game framework; sliver of DOM for menus/inventory.

Non-negotiable architecture rules:

1. **Sim/render separation.** Game state is a plain serializable object, printable as ASCII. Renderer reads state; never the reverse. This buys saves, replays, seed-sharing, and the sequel's rewind mechanic.
2. **Everything is data.** Weapons, enemies, attachments, spawn tables, AP costs live in JSON/TS tables. Adding an enemy in month four must be a data entry plus one behavior reference, not new systems code.
3. **Seeded runs from commit one.** Fixed-seed mode for balance testing, bug reports, and daily-run potential.
4. **Damage-per-AP spreadsheet before content.** Every weapon entered as damage-per-AP at ranges 1 / 2–4 / 5–8 before it exists in code.

## 7. MVP Stages

Each stage ends in a playable build with an explicit kill-question. Do not advance while a kill-question is unanswered.

**Stage 0 — Scaffold (weekend).** Vite + TS + rot.js project; grid renders as ASCII; @ walks around a generated map with FOV. *Exit: it runs in a browser tab.*

**Stage 1 — The Turn (1–2 weeks).** AP system, turn scheduler, Glock, one rent-a-cop with A* pursuit and shooting, HP, death, restart-on-death with new seed. Everything still ASCII. *Kill-question: is the 3-AP shoot/move/reload decision interesting against even one enemy? If moving never feels as valuable as shooting, fix costs now.*

**Stage 2 — The Vertical Slice (2–3 weeks).** Floors 1–2 complete: Mosin, Uzi, revolver, Serbu; dog, taser guard, shotgun guard, janitor, camera; ammo calibers and drops; stairs; the loop closes. **Basic tile renderer and sidebar skeleton land here** — placeholder tileset (Kenney/Oryx-style free assets), FOV shroud, AP pips, ammo counters, equipped-weapon cards with the damage-per-AP label. No juice, just the §9 layout, because readability decisions (telegraphs, damage labels) must be tuned in their real home, not tuned twice. First external playtest — send the link to five people. *Kill-question: does one floor take 3–4 minutes, and do mixed melee/ranged rooms produce different optimal play orders? This is the go/no-go gate for the whole game.*

**Stage 3 — Breadth (3–4 weeks).** Floors 3–6, tiers 2 weapons, attachments system with all eight, tactical band enemies, breacher miniboss, drop-table biasing, locked armories. Balance pass against the spreadsheet — hunt the dominant burst weapon; there will be one. *Kill-question: do two playtesters describe meaningfully different builds?*

**Stage 4 — The Top of the Tower (2–3 weeks).** Floors 7–8, tier 3 weapons, R&D enemies, juggernaut, helicopter + CEO fight, uniques, win screen. *Kill-question: does the CEO fight reuse the player's learned vocabulary rather than introducing new rules?*

**Stage 5 — Ship (2 weeks).** Final art pass replacing placeholder tiles (sim state untouched — the payoff of rule 1), minimap polish, SFX, four music tracks, screenshake/hit-flash juice budget of one week maximum, tutorialization via floor-1 sign posts, seed input UI, itch.io page, 10-person playtest, ship v1.0.

Total: roughly 3–4 months of part-time work. If Stage 2's kill-question fails, the correct move is to fix the AP economy for as long as it takes — every later stage is content poured into that mold.

## 8. Balance Guardrails

Fights resolve in 3–6 turns. Player dies in 3–5 unanswered hits; most enemies die in 1–3 hits. Melee enemies reach a stationary player in 2–3 turns. Damage-per-AP within a tier stays within ±20% at each weapon's intended range band and falls off a cliff outside it. Ammo income supports roughly 70% of shots fired being "on-tier"; the deficit is the pressure. When in doubt, make both sides more lethal, not tankier — lethality preserves pillar 1.

## 9. UI Specification and Readability

Layout follows the classic single-sidebar roguelike model (reference: Rogue Fable-style HUD): tile viewport with FOV shroud on the left ~72% of the screen, one dense sidebar on the right, no overlapping windows, no pause-menu inventory for common actions.

**Viewport.** Pixel-art tiles, hard FOV shroud (unseen = black, explored-but-unseen = dimmed). Floor header top-center: "OFFICES: 3/8" plus run timer. Telegraphs render in-viewport as grid markers one full turn ahead (camera alert countdown, kamikaze lock-on, helicopter strafe lines). Damage numbers and enemy HP appear over tiles on hit and on inspect.

**Sidebar, top to bottom:**
1. *Vitals block* — HP bar; **3 AP pips** (discrete diamonds, drain per action — AP is spent in whole units, so pips not bars); floor number cell.
2. *Ammo block* — persistent counters for small / medium / large calibers. Ammo is our food clock; it is always on screen.
3. *Minimap* — explored-tile map with stairs, loot rooms, and player marker; "UNEXPLORED" placeholder text before first reveal.
4. *Equipped display* — primary gun card + knife card side by side, each with a live **damage-per-AP-at-target-range** label that updates while aiming (this is how pattern differences stay legible without a wiki). Attachment icons render as pips on the gun card.
5. *Weapon slots row* — three carried-gun slots on number keys 1–3; swapping costs 1 AP.
6. *Consumable hotbar* — grenades, stims, medkits, keycards with stack counts.
7. *Seed / coordinates / turn counter* — bottom corner, always visible; the seeded-runs rule made public.

Three left-edge shortcut buttons only: inventory, character/attachments, help.

Support enemies get loud silhouettes — antenna backpacks, tablet glow, shield glare — because target identification *is* the gameplay. Death screens name the killer, floor, and seed ("Bitten to death by K9 Unit — Floor 2 — Seed 88412"); shareable deaths are the marketing plan.

Controls: keyboard-first (arrows/WASD to move, 1–3 weapon slots, R reload, F fire at nearest, Tab cycle targets, G pickup), full mouse support for aiming and inspection. Every action executable with either input alone.

## 10. Risks and Mitigations

**Risk: the AP economy is flat** — shooting always beats moving, and the game degenerates into a static exchange of fire. This is the existential risk, which is why Stage 2 is the go/no-go gate. Mitigation levers, in order: raise melee spawn weight, add cover value (attacks through cover tiles lose accuracy, making repositioning profitable), and sharpen range-band falloff so standing still means fighting at the wrong band.

**Risk: burst weapons dominate** (most damage per AP is historically where these systems break). Mitigation: spread penalties that scale with range, ammo consumption per burst, and the spreadsheet discipline in §8 enforced before any weapon ships.

**Risk: content pipeline stalls in month three.** Mitigation is architectural rule 2 — if adding an enemy ever requires more than a data entry and a behavior reference, stop and refactor before adding more content.

**Risk: scope regrowth.** The sequel's ideas (merchant, grit, chrono charges) will constantly ask to come in early. The cut list in §5 is a contract; anything crossing it goes to a v1.1 file, not the build.

## 11. Handoff Notes

The sequel (era-hopping, branching factions, chrono mechanics, merchant caravan) inherits this codebase wholesale: the AP economy, data-driven content pipeline, serializable state, and support-enemy grammar are all sequel systems being test-fired here. Build v1 as if game two is watching — because it is.
