# UX Design — Post-Alpha Backlog

**Status: scheduled as Phase D (M13+) in `alpha-roadmap.md`** — the polish pass after
the alpha playtest build ships. Recorded here so these are decisions-in-waiting, not
scope creep. The dev panel is the one item allowed to land early if Phase C tuning
wants it.

## 1. Controls menu

An overlay (`?` or `F1`) listing every binding, readable mid-run, closed by any key.
Nearly free: the keyboard map already exists in `input/keyboard.ts`; render it as a DOM
overlay like the death screen. **Why it may deserve M12 anyway:** external playtesters
currently learn controls from the README, which they will not read. A controls overlay
is the single cheapest fix to the worst first-five-minutes problem an alpha playtest
can have.

## 2. Debug / admin panel (dev-only)

An overlay gated by **`import.meta.env.DEV`** — a build-time constant, so it exists
only under `npm run dev` and is dead-code-eliminated from every build output: Pages
and the zip never contain the panel at all (strictly better than hostname sniffing,
which ships the code everywhere and would show the panel to anyone serving a build on
their own localhost). Features: spawn enemy/item by id, grant cash/XP/plates, jump to
floor, reveal map, god mode, re-seed. Implementation stays inside the architecture:
debug commands are *actions* through `applyAction` (a `{type: "debug", ...}` family)
handled unconditionally by the sim — the sim never checks environment (invariant 1
adjacent: it stays environment-agnostic), only the dev-only panel ever dispatches
them, and a replay containing debug actions still replays. Accepted tradeoff: the
panel can never be opened on the deployed site, even by us; if a real need appears, a
URL-param fallback is a one-line change later. **Why it may deserve to land during
Phase C rather than M14:** tuning floors 5–8 without "jump to floor 7 with a T3
loadout" means replaying 20 minutes per iteration. Player-facing never; dev-facing
early if needed.

## 3. Start screen / landing page

Currently the game boots straight into a run. Scheduled for v0.3: a title screen inside
the game rather than a separate page, with a wordmark over a dimmed live floor, NEW RUN
(random seed), ORIENTATION (the tutorial), a seed entry field (replacing raw `?seed=` URL
editing as the shared-run entry point), controls, sound, and a version/build stamp. A sent
`?seed=` link still skips it and lands *in the game*, which keeps shared runs one click.
It's also where a future daily-seed mode would live.

## 4. Mouse support

Click-to-move (A* to clicked tile, emitting one move action per turn with
interrupt-on-spot), click-to-target/fire, hover tooltips on enemies (the target card
on demand). Architecturally clean — the input layer is just another producer of
actions, and the sim never knows — but it's real work: path preview rendering,
multi-turn queue interruption rules, and a second full input surface to keep in parity
with the keyboard. Post-alpha, and only if playtest feedback asks for it; a pure
keyboard roguelike is a legitimate identity.

## 5. Tutorial

Decided for v0.3, reversing this section's old "never build a scripted tutorial floor":
**New Hire Orientation**, a hand-built floor 0 of eight rooms, with a skip option. The
goal is that a stranger can learn the game without its author beside them, and the
playtest's proof that the old approach falls short is that the game's own designer forgot
the drop key (`play-test-08-04-26.md:42`).

It **teaches verbs, never numbers** — AP as a budget, bands as positioning, `i` for the
spreadsheet — so a balance patch can never invalidate it. Lessons live outside the sim, in
a data table of prompts driven by the event stream and input, the way auto-explore works.
Dying restarts the current room from a copy of `GameState`. The room list is in
`alpha-roadmap.md`.

**Contextual first-time hints** in the log remain a good later addition for what
orientation can't reach: first bolt gun ("R cycles the bolt"), first promotion. One
`seenHints: string[]` on UI-side state (not the sim), a data table of hint lines, fired
once each.

## Priority order

Controls overlay and debug panel shipped. Next: orientation and the title screen (both
v0.3), then contextual hints, then mouse support. Each lands independently; none blocks
another.
