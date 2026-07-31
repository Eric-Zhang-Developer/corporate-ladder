# UX Design — Post-Alpha Backlog

**Status: backlog, not alpha scope.** These are UX layers for after the alpha playtest
build ships (`alpha-roadmap.md` M12). Recorded now so they're decisions-in-waiting, not
scope creep. Two items are flagged as pull-forward candidates because they cheaply
serve the alpha itself.

## 1. Controls menu ⭐ *pull-forward candidate*

An overlay (`?` or `F1`) listing every binding, readable mid-run, closed by any key.
Nearly free: the keyboard map already exists in `input/keyboard.ts`; render it as a DOM
overlay like the death screen. **Why it may deserve M12 anyway:** external playtesters
currently learn controls from the README, which they will not read. A controls overlay
is the single cheapest fix to the worst first-five-minutes problem an alpha playtest
can have.

## 2. Debug / admin panel ⭐ *pull-forward candidate (dev-only)*

An overlay gated behind `?dev=1`: spawn enemy/item by id, grant cash/XP/plates, jump
to floor, reveal map, god mode, re-seed. Implementation stays inside the architecture:
debug commands are *actions* through `applyAction` (a `{type: "debug", ...}` family) —
the sim stays pure and a replay containing debug actions still replays. **Why it may
deserve to land during Phase C rather than after:** tuning floors 5–8 without "jump to
floor 7 with a T3 loadout" means replaying 20 minutes per iteration. This is a tool
that pays for itself in the first tuning session. Player-facing never; dev-facing
early.

## 3. Start screen / landing page

Currently the game boots straight into a run. A title screen: logo/wordmark, START
(random seed), seed entry field (replacing raw `?seed=` URL editing as the shared-run
entry point), controls link, version/build stamp. Post-alpha is right — the alpha
audience arrives via a sent link and should land *in the game* — but this becomes
important the moment the game has a public URL audience, and it's where a future
daily-seed mode would live.

## 4. Mouse support

Click-to-move (A* to clicked tile, emitting one move action per turn with
interrupt-on-spot), click-to-target/fire, hover tooltips on enemies (the target card
on demand). Architecturally clean — the input layer is just another producer of
actions, and the sim never knows — but it's real work: path preview rendering,
multi-turn queue interruption rules, and a second full input surface to keep in parity
with the keyboard. Post-alpha, and only if playtest feedback asks for it; a pure
keyboard roguelike is a legitimate identity.

## 5. Tutorial

Recommendation: never build a scripted tutorial floor. The cheap, genre-proven
version is **contextual first-time hints** in the log: first bolt gun ("R cycles the
bolt"), first plate pickup, first camera countdown, first promotion. One
`seenHints: string[]` on UI-side state (not the sim), a data table of hint lines,
fired once each. Floor 1 already *is* the tutorial by design — the LOBBY teaches
spot/close/trade/punish at 2-damage prices. Hints just narrate what the floor is
already teaching.

## Priority order

Controls overlay (→ M12 if accepted) · debug panel (→ during Phase C, dev-only) ·
start screen · contextual hints · mouse support. Each lands independently; none blocks
another.
