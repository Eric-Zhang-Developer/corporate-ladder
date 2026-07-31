# SEVERANCE PACKAGE (working title)

A turn-based roguelike about shooting your way up an evil corporation's tower.
Currently at **Stage 2 — The Vertical Slice**: floors 1–2, the tier-1 arsenal,
six enemy types, the ammo economy, and the first tile renderer + sidebar.
Design docs: [docs/](docs/) — the original handoff plus the alpha design set.

## Run

```
npm install
npm run dev     # then open the printed localhost URL
```

Runs are seeded: the URL always carries `?seed=N`, so copying the URL shares the exact run.
Death screens name the killer, floor, and seed — share them.

## Controls

| Key | Action (3 AP per turn) |
| --- | --- |
| Arrows / WASD | Move (1 AP) — moving into an enemy knifes it |
| F | Fire at target, or nearest visible enemy (weapon AP) |
| Tab | Cycle target |
| R | Reload from your caliber reserve (weapon AP) |
| G | Pick up what you're standing on (1 AP) |
| 1 / 2 / 3 | Swap weapon slot (1 AP) |
| > | Take the stairs up |
| Space / `.` | End turn |
| Enter / S (when dead or won) | New run / retry same seed |

## Development

```
npm run test        # vitest, sim-only (the sim is headless and pure)
npm run typecheck
npm run build       # hashed assets — what CI deploys to GitHub Pages
npm run build:zip   # one self-contained index.html — zip dist/ to email testers
```

Pushes to `main` deploy automatically once the checks pass.

Architecture rules (see handoff §6): the sim never touches the DOM or renderer;
all content (weapons, enemies, floors, AP costs) lives in `src/data/` tables;
every run is seeded — floor content derives from hash(seed, floor) — and
`GameState` survives a JSON round-trip. `test/sim/balance.test.ts` enforces the
±20% damage-per-AP tier window from §8 in CI.
