# SEVERANCE PACKAGE (working title)

A turn-based roguelike about shooting your way up an evil corporation's tower.
The **alpha** shipped: all eight floors, 30 weapons across four tiers, ~21
enemies, four minibosses and the CEO, plus armor and plates, consumables and
grenades, promotions, and the credit economy — and since then, generated 16-bit
sound and a full weapon/enemy information layer. Currently **v0.2** (UI
close-out); the balance pass lands in v0.3. Design docs: [docs/](docs/) — the
original handoff, the alpha design set, `sound-design.md`, and playtest reports.

## Run

```
npm install
npm run dev     # then open the printed localhost URL
```

Runs are seeded: the URL always carries `?seed=N`, so copying the URL shares the exact run.
Death screens name the killer, floor, and seed — share them.

## Controls

Movement is arrows/WASD (walking into an enemy knifes it), `F` fires, `R`
reloads, `Tab` targets — and **press `?` in game for the full keymap**. The
in-game panel is generated from the same data table the bindings are tested
against, so it never drifts; this README deliberately doesn't duplicate it.

## Development

```
npm run test        # vitest — sim suites plus the pure render/input helpers
npm run typecheck
npm run build       # hashed assets — what CI deploys to GitHub Pages
npm run build:zip   # single-file index.html for emailing testers — NOTE: sound
                    # is runtime-fetched and file:// blocks fetch, so the zip
                    # plays silent; serve it over http to hear it
```

Pushes to `main` deploy automatically once the checks pass. The sound palette
is generated, not recorded: `python3 tools/soundgen/generate.py [name-filter]`
regenerates `public/sounds/` (see `docs/sound-design.md`).

Architecture rules (see handoff §6): the sim never touches the DOM or renderer;
all content (weapons, enemies, floors, AP costs) lives in `src/data/` tables;
every run is seeded — floor content derives from hash(seed, floor) — and
`GameState` survives a JSON round-trip. `test/sim/balance.test.ts` enforces the
damage-per-AP tier windows from §8 in CI.
