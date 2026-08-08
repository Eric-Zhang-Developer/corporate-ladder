"""
Mechanism voices (docs/sound-design.md §5): reloads, bolts, the dry click.
These carry more information per decibel than any gunshot — they are the
punish-window telegraphs, for both sides.
"""

from synth import adec, at, dec, fm, gain, grains, hp1, lfsr, lp1, mix, osc, white
from guns import clack, pump_rack


def bolt_cycle():
    # Two-stage: bolt up-and-back, then forward-and-down. Deliberate.
    return mix(
        clack(2100.0, dur=0.045, seed=110, vol=0.9),
        at(0.02, gain(hp1(lfsr(0.05, 4800.0, short=True, env=dec(1.8)), 1200.0), 0.2)),
        at(0.14, clack(1600.0, dur=0.055, seed=111, vol=1.0)),
        at(0.15, gain(lp1(white(0.03, 112, dec(3.0)), 2400.0), 0.3)),
    )


def reload_mag():
    # Mag out (click), mag in (clunk), slide release (snap). Three beats.
    out_click = clack(2500.0, dur=0.03, seed=113, vol=0.55)
    mag_in = at(0.16, mix(
        fm(0.06, 480.0, 300.0, ratio=2.2, index0=2.0, env=dec(3.0), vol=0.7),
        gain(lp1(white(0.04, 114, dec(3.0)), 3000.0), 0.4),
    ))
    slide = at(0.34, clack(1900.0, dur=0.05, seed=115, vol=0.95))
    return mix(out_click, mag_in, slide)


def reload_shells():
    # Three shell pushes, each a touch higher — the tube filling up.
    def push(i):
        f = 900.0 * (1.0 + 0.12 * i)
        return mix(
            fm(0.05, f, f * 0.75, ratio=2.7, index0=1.8, env=dec(3.2), vol=0.6),
            gain(lp1(white(0.03, 116 + i, dec(3.5)), 2600.0), 0.3),
        )
    return grains(3, 0.15, push, seed=116)


def reload_belt():
    # Cover clank, the belt laid in (rattle), cover slammed. Heavy furniture.
    cover_open = mix(
        clack(1300.0, dur=0.06, seed=120, vol=1.0),
        fm(0.08, 340.0, 260.0, ratio=3.1, index0=2.4, env=dec(2.4), vol=0.5),
    )
    belt = at(0.20, gain(hp1(lfsr(0.16, 5200.0, short=True, env=adec(0.3, 1.5)), 1600.0), 0.28))
    slam = at(0.44, mix(
        clack(1100.0, dur=0.07, seed=121, vol=1.1),
        osc(0.07, "sine", 130.0, 60.0, env=dec(2.0), vol=0.6),
    ))
    return mix(cover_open, belt, slam)


def reload_enbloc():
    # The Garand PING — a genuine bell, then the new clip thunked home.
    ping = fm(0.28, 2350.0, 2320.0, ratio=3.48, index0=2.2, index1=0.3, env=dec(2.2), vol=0.85)
    ring = fm(0.22, 3520.0, 3500.0, ratio=2.01, index0=1.0, env=dec(3.0), vol=0.25)
    clip_in = at(0.30, mix(
        fm(0.06, 520.0, 330.0, ratio=2.3, index0=2.0, env=dec(3.0), vol=0.7),
        clack(1800.0, dur=0.04, seed=122, vol=0.6),
    ))
    return mix(ping, ring, clip_in)


def dry_click():
    # Costs 0 AP; should cost ~0 attention.
    return clack(2800.0, dur=0.025, seed=123, vol=0.6)


MECHANISMS = {
    "bolt_cycle": bolt_cycle,
    "pump_rack": lambda: pump_rack(vol=1.0),
    "reload_mag": reload_mag,
    "reload_shells": reload_shells,
    "reload_belt": reload_belt,
    "reload_enbloc": reload_enbloc,
    "dry_click": dry_click,
}
