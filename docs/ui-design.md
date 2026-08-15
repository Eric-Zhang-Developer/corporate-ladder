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

- 14px, **5 visible lines** (7.5em), scrollback over the last 100 entries.
- **Sticky autoscroll**: pinned to the bottom only when already at the bottom, so
  reading history mid-fight is never interrupted by the next turn.
- The mode **hint** is its own ruled row below the scroll region, not a log line. It
  always reserves its height — a collapsing row would resize and rescale the canvas
  the instant you press `x`.
- Log text is written with `textContent`, so spot lines, telegraphs and CEO dialogue
  can make this a narrative channel without an escaping discipline to remember.

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

## Follow camera

The world renders through a fixed **34×21-tile logical viewport**. That span is part of
combat readability, not a monitor bonus: CSS scales the same view into the available
map column, so a larger display makes the tiles larger rather than revealing more of the
floor. Thirty-four by twenty-one stays close to the existing canvas/UI aspect while
leaving ten rows above and below a centered player.

The camera center-locks to the player and clamps at floor edges; it never shows void or
enters `GameState`. Twenty-one rows contain the complete maximum player FOV (base radius
8 plus Field Awareness), so every ordinarily visible target stays on-screen. Overwatch
is the deliberate exception: its range reaches beyond the camera, paid for by drawing
the clipped charge lane into the viewport even when the shooter itself is beyond FOV.
Other off-screen charge styles remain hidden.

## Viewport telegraphs

The bestiary runs on visible warnings; the renderer owes it:

- Camera countdown digits *(exists)* — reused by the supervisor.
- **Marksman lane highlight** — the covered tiles drawn as a red line during his
  telegraph turn. The lane renders above the shroud and may enter from off-screen; the
  player is warned without being handed the shooter's position.
- Dozer / Server Warden spin-up state (glyph or color change during charge turns).
- Stealth-unit shimmer is a log line, not a render effect — the *absence* on screen is
  the design.

## Build order

Cheap pieces ride their sim milestones (ammo row with the caliber migration, shield bar
with plates, footer with cash/XP) — the sidebar reads state, so its updates belong in
those commits. Overlays land with their systems (promotion, shop). Throw targeting and
lane telegraphs land with the AoE system and the marksman respectively. The log
font/line bump has no dependencies and can land any time; scrollback follows separately.
