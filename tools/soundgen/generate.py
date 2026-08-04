"""
Generate the full SFX set into public/sounds/ (docs/sound-design.md §5).

Usage: python3 tools/soundgen/generate.py [name-filter ...]
With args, only sounds whose name contains a filter regenerate — the
retune loop is `python3 generate.py akm` and a reload of the soundboard.

Writes one WAV per sound plus manifest.json (the soundboard's data source).
Peak targets per category (§6): loudness is hierarchy.
"""

import json
import os
import sys
import time

from synth import master, write_wav
from guns import GUNS
from mechanisms import MECHANISMS
from feedback import FEEDBACK
from enemies import ENEMIES
from items import ITEMS
from ui import UI

# (category label, recipes, default peak) — order = soundboard tab order.
GUN_TABS = [
    ("Pistols & SMGs", ["glock", "revolver", "tec9", "fiveseven", "b93r", "deagle",
                        "uzi", "mp5", "ump45", "p90"]),
    ("Shotguns", ["serbu", "m870", "spas12", "aa12"]),
    ("Rifles", ["mini14", "sks", "ar15", "m4", "akm", "an94", "m249", "xm250"]),
    ("Heavy", ["mosin", "garand", "fal", "rem700", "sr25", "xm7", "awp", "vss"]),
    ("Enemy guns", ["fixer_pistol", "m82", "turret_gun", "warden_slam", "minigun"]),
]

# The quiet ones defy their category's peak.
PEAK_OVERRIDES = {
    "vss": 0.55, "fixer_pistol": 0.6, "m82": 0.85,
    "frag_blast": 0.85, "flashbang_blast": 0.85, "emp_blast": 0.8,
    "promote": 0.65, "death": 0.65, "win": 0.65,
    "ui_blip": 0.4, "low_hp": 0.5, "dry_click": 0.5,
}


def categories():
    cats = []
    for label, names in GUN_TABS:
        cats.append((label, {n: GUNS[n] for n in names}, 0.80))
    cats.append(("Mechanisms", MECHANISMS, 0.65))
    cats.append(("Feedback", FEEDBACK, 0.70))
    cats.append(("Enemies", ENEMIES, 0.65))
    cats.append(("Items & blasts", ITEMS, 0.75))
    cats.append(("UI & economy", UI, 0.55))
    return cats


def main():
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    outdir = os.path.join(root, "public", "sounds")
    os.makedirs(outdir, exist_ok=True)
    filters = [a.lower() for a in sys.argv[1:]]

    manifest = []
    total = 0
    t0 = time.time()
    for label, recipes, peak in categories():
        entry = {"category": label, "sounds": []}
        for name, fn in recipes.items():
            entry["sounds"].append(name)
            if filters and not any(f in name for f in filters):
                continue
            buf = master(fn(), peak=PEAK_OVERRIDES.get(name, peak))
            write_wav(os.path.join(outdir, name + ".wav"), buf)
            total += 1
            print(f"  {name:18s} {len(buf) / 32000:5.2f}s  [{label}]")
        manifest.append(entry)

    with open(os.path.join(outdir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    n_all = sum(len(e["sounds"]) for e in manifest)
    print(f"\n{total} generated ({n_all} in manifest) -> {outdir}  [{time.time() - t0:.1f}s]")


if __name__ == "__main__":
    main()
