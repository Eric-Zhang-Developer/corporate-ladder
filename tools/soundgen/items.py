"""
Thrown & consumable voices (docs/sound-design.md §5). The three blasts must
be tellable apart with eyes closed: frag is LOW, flashbang is WHITE, EMP is
SYNTHETIC. Heals resolve upward; the stim bites.
"""

from synth import (
    adec, at, clip, crush, dec, echo, fm, gain, gate, grains, hp1, lfsr, lp1,
    mix, osc, shape, svf, white,
)
from guns import clack


def grenade_throw():
    # Pin tink + whoosh of the arc. The quiet before.
    tink = fm(0.06, 2900.0, 2850.0, ratio=3.52, index0=1.5, env=dec(3.0), vol=0.4)
    woosh = at(0.05, svf(white(0.28, 170, adec(0.4, 1.6)), "bp", 500.0, 1300.0, 0.6))
    return mix(tink, gain(woosh, 0.55))


def frag_blast():
    # The set's biggest sound. Deep boom, debris, a room that keeps talking.
    core = clip(mix(
        gain(lp1(white(0.4, 171, dec(1.5)), 5200.0, 240.0), 2.2),
        osc(0.3, "tri", 85.0, 30.0, env=dec(1.5), vol=1.2),
        osc(0.12, "sine", 55.0, 28.0, env=dec(1.3), vol=1.0),
    ), 1.7)
    def debris(i):
        return gain(hp1(lfsr(0.05, 7400.0 - 900.0 * i, short=True, env=dec(3.0)), 1500.0), 0.3)
    rubble = at(0.16, grains(5, 0.06, debris, gain_slope=0.8, spacing_jitter=0.3, seed=172))
    return echo(mix(core, rubble), delay=0.12, feedback=0.4, mix_level=0.3, damp=2200.0)


def flashbang_blast():
    # Sharp crack into a long high whiteout ring. You hear your own ears.
    crack = gain(hp1(white(0.05, 173, dec(2.0)), 1400.0), 1.4)
    ring = at(0.04, osc(0.9, "sine", 3150.0, 3050.0, env=dec(0.9), vol=0.55))
    wash = at(0.04, gain(hp1(white(0.5, 174, dec(1.2)), 4200.0), 0.25))
    return mix(clip(crack, 1.5), ring, wash)


def emp_blast():
    # FM zap sweep + digital sputter. Machines only; sounds like software dying.
    zapp = fm(0.30, 1600.0, 140.0, ratio=1.99, index0=4.0, index1=1.0, env=dec(1.2), vol=0.8)
    def glitch(i):
        return crush(osc(0.03, "pulse", 700.0 + 331.0 * (i % 3), 500.0, duty=0.3,
                         env=gate(0.9, 3.0), vol=0.35), bits=6, hold=4)
    sputter = at(0.12, grains(5, 0.05, glitch, gain_slope=0.85, spacing_jitter=0.4, seed=175))
    thud = osc(0.10, "sine", 120.0, 50.0, env=dec(1.8), vol=0.8)
    return mix(crush(zapp, bits=9, hold=2), sputter, thud)


def heal_small():
    # Snack/bandage: a warm two-note blip that settles. Minor task, done.
    def note(f, d=0.09):
        return lp1(osc(d, "tri", f, f, env=gate(0.7, 4.0), vol=0.5), 4200.0)
    return mix(note(523.25), at(0.10, note(659.26, 0.16)))


def heal_big():
    # Medshot/medkit: a rising arp resolving to a held relief tone.
    notes = [(392.0, 0.0), (523.25, 0.09), (659.26, 0.18), (783.99, 0.27)]
    layers = [at(t, lp1(osc(0.09 if f < 700 else 0.4, "tri", f, f,
                            env=gate(0.7, 4.0) if f < 700 else dec(1.2), vol=0.45), 4600.0))
              for f, t in notes]
    pad = at(0.27, fm(0.45, 392.0, 392.0, ratio=2.0, index0=0.8, index1=0.2, env=dec(1.3), vol=0.25))
    return mix(*layers, pad)


def stim_use():
    # Sharp rising sweep + a heart kick. Borrowed time, starting now.
    sweep = svf(white(0.16, 176, adec(0.5, 1.5)), "bp", 700.0, 3200.0, 0.5)
    kick = at(0.15, osc(0.07, "sine", 160.0, 65.0, env=dec(2.0), vol=1.0))
    ping = at(0.16, osc(0.12, "tri", 1046.5, 1046.5, env=dec(2.5), vol=0.3))
    return mix(gain(sweep, 0.8), kick, ping)


def schematics():
    # Data chirps resolving to a tone — the floor plan downloading.
    def chirp(i):
        f = 1200.0 + 260.0 * (i * 2 % 5)
        return osc(0.03, "pulse", f, f * 1.1, duty=0.35, env=gate(0.8, 4.0), vol=0.3)
    burst = grains(7, 0.035, chirp, seed=177)
    resolve = at(0.28, lp1(osc(0.30, "tri", 880.0, 880.0, env=dec(1.6), vol=0.45), 5000.0))
    return mix(lp1(burst, 6400.0), resolve)


ITEMS = {
    "grenade_throw": grenade_throw, "frag_blast": frag_blast,
    "flashbang_blast": flashbang_blast, "emp_blast": emp_blast,
    "heal_small": heal_small, "heal_big": heal_big,
    "stim_use": stim_use, "schematics": schematics,
}
