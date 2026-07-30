# SEVERANCE PACKAGE (working title)

A turn-based roguelike about shooting your way up an evil corporation's tower.
Currently at **Stage 1 — The Turn**: one floor, one Glock, one rent-a-cop, all ASCII.
Design doc: [tower-design-handoff.md](tower-design-handoff.md).

## Run

```
npm install
npm run dev     # then open the printed localhost URL
```

Runs are seeded: the URL always carries `?seed=N`, so copying the URL shares the exact run.

## Controls

| Key | Action (3 AP per turn) |
| --- | --- |
| Arrows / WASD | Move (1 AP) |
| F | Fire at nearest visible enemy (1 AP) |
| R | Reload (1 AP) |
| Space / `.` | End turn |
| Enter (when dead) | New run, new seed |
| S (when dead) | Retry the same seed |

## Development

```
npm run test        # vitest, sim-only (the sim is headless and pure)
npm run typecheck
npm run build
```

Architecture rules (see handoff §6): the sim never touches the DOM or renderer;
all content (weapons, enemies, AP costs) lives in `src/data/` tables; every run
is seeded and `GameState` survives a JSON round-trip.
