# UI Design — Alpha (connective tissue)

**Status: design draft.** Deliberately small — the UI's job is to read `GameState` and
stay out of the way. The sim never knows any of this exists; every interaction below
resolves to an `Action` through `applyAction`, and UI-side state (target id, input modes)
lives in `main.ts`, never in the sim.

## Philosophy: slots and counters, no inventory

Everything the player owns is a **slot** or a **counter**: 3 weapon slots, 6 consumable
hotbar slots (typed stacks with count badges), ammo as four counters, plates as a
counter, cash as a counter. There is no bag, no inventory screen, no item-management UI,
and no pile-on-tile pickup menus (one item per tile is law; drops scatter). This is a
30-minute roguelike; DCSS's least-loved subsystem is the one we refuse to build.

Weapon slots stay at **3** — that's a design decision, not a UI limit. Three slots is
what makes loadout a bet (sniper + sidearm + flex); a fourth dissolves the
caliber-tension the ammo economy runs on.

## Sidebar (top to bottom)

1. **Vitals** — shield bar (blue, segmented per plate, 0/0 until a carrier is found;
   carrier name + spare-plate count beside it) above the HP bar; AP diamonds; floor.
2. **Ammo** — four channels: PISTOL · SHELL · RIFLE · HEAVY.
3. **Minimap** — unchanged.
4. **Gun cards** — equipped weapon + knife with live dmg/AP at target distance, plus
   state flags the arsenal doc created: `CYCLE` (bolt gun unchambered), `BRACED` (LMG,
   no move-AP spent), en-bloc remaining (Garand). Bayonet replaces the knife card while
   an SKS is equipped.
5. **Weapon slots** — 3 cells, keys 1–3, mag counts.
6. **Hotbar** — 6 cells, keys 4–9, item glyph + stack count.
7. **Perk line** — chosen certification names, compact (≤ ~9 by run's end).
8. **Footer** — cash · level + XP ("L3 · 42/60") · seed · turn.

## Target card

Appears for the Tab-selected target: name, HP, **armor pips**, `MACHINE` tag,
distance. This is the readability half of the armor system — the riot guard's armor 2
and the K9's machine-ness must be visible before the player wastes a mag learning them.
Bosses use the same card (no special boss bars in v1).

## Log

- Bumped to ~14px, **5 visible lines** (from 2).
- Scrollback is its own commit; that work also pays known debt #4 — escape log text
  before spot lines, telegraphs, and CEO dialogue make the log a real narrative channel.

## Overlays (same pattern as the death screen)

- **Promotion** — `phase: "promoting"`: +HP note and the 1-of-2 perk choice, styled as
  a performance review. Blocks input until chosen (the choice is a sim action).
- **Shop** — stairwell landing merchant: 4–6 items, prices, cash readout. Vending
  machine tiles need *no* UI: bump → paid → log line.
- Death / win — existing; win screen gains the severance-package beat.

## Input modes (UI-side state, like Tab-targeting)

- **Throw targeting** — grenade key → tile cursor with radius preview + LOS check →
  `{type: "throw", ...}`. The single biggest UI cost in alpha; input half of the AoE
  system.
- **Drop mode** — `X`, then a slot key (1–3 weapons, 4–9 items) → `{type: "drop", slot}`.

## Viewport telegraphs

The bestiary runs on visible warnings; the renderer owes it:

- Camera countdown digits *(exists)* — reused by the supervisor.
- **Marksman lane highlight** — the covered tiles drawn as a red line during his
  telegraph turn. The novel renderer feature of the batch.
- Dozer / Server Warden spin-up state (glyph or color change during charge turns).
- Stealth-unit shimmer is a log line, not a render effect — the *absence* on screen is
  the design.

## Build order

Cheap pieces ride their sim milestones (ammo row with the caliber migration, shield bar
with plates, footer with cash/XP) — the sidebar reads state, so its updates belong in
those commits. Overlays land with their systems (promotion, shop). Throw targeting and
lane telegraphs land with the AoE system and the marksman respectively. The log
font/line bump has no dependencies and can land any time; scrollback follows separately.
