"""
Feedback voices (docs/sound-design.md §5): what your shot did, what theirs
did to you. These sounds front-run the log line — they must be legible in a
pile-up, so each owns a distinct register: hits are low, armor is high and
hollow, plates are ceramic, blades are sharp.
"""

from synth import (
    adec, at, clip, crush, dec, echo, fm, gain, gate, grains, hp1, lfsr, lp1,
    mix, osc, shape, svf, white,
)
from guns import clack, sub_drop


def hit_flesh():
    # Low wet thud. No pitch identity — damage is a fact, not a melody.
    return mix(
        osc(0.07, "sine", 210.0, 80.0, env=dec(1.8), vol=1.0),
        gain(lp1(white(0.04, 130, dec(3.0)), 1400.0), 0.5),
    )


def hit_hard():
    # Machines thunk. Shooting steel should feel different from shooting people.
    return mix(
        fm(0.08, 420.0, 260.0, ratio=3.17, index0=2.6, env=dec(2.8), vol=0.8),
        gain(hp1(lfsr(0.04, 7600.0, short=True, env=dec(3.5)), 800.0), 0.35),
        osc(0.05, "sine", 160.0, 75.0, env=dec(2.0), vol=0.5),
    )


def miss_ricochet():
    # Pweeong: metallic ring + falling whistle. Seeded, but reads as random.
    return mix(
        gain(hp1(lfsr(0.11, 8800.0, short=True, env=dec(2.0)), 1400.0), 0.5),
        osc(0.16, "sine", 2300.0, 480.0, vib=0.03, vib_rate=22.0, env=dec(1.6), vol=0.55),
    )


def armor_clatter():
    # Bright clank cluster, ZERO low end. Rounds landed and did nothing —
    # the hollowness IS the lesson.
    def tink(i):
        return mix(
            gain(hp1(lfsr(0.05, 9200.0 - 900.0 * i, short=True, env=dec(3.2)), 2000.0), 0.6),
            fm(0.04, 2600.0 - 300.0 * i, 2400.0, ratio=3.9, index0=2.0, env=dec(4.0), vol=0.35),
        )
    return hp1(grains(3, 0.030, tink, gain_slope=0.85, seed=131), 1200.0)


def plate_break():
    # Ceramic crack, then the pieces leave. A resource died, audibly.
    crack = mix(
        gain(hp1(white(0.05, 132, dec(3.0)), 1800.0), 1.1),
        fm(0.06, 1500.0, 900.0, ratio=2.6, index0=3.0, env=dec(3.2), vol=0.6),
    )
    def shard(i):
        return gain(hp1(lfsr(0.05, 7800.0 - 1100.0 * i, short=True, env=dec(3.0)), 1800.0), 0.3)
    shards = at(0.05, grains(4, 0.045, shard, gain_slope=0.8, spacing_jitter=0.2, seed=133))
    return mix(crack, shards)


def plate_slot():
    # The confident chunk-in. The opposite arc of plate_break: it resolves.
    return mix(
        fm(0.06, 420.0, 300.0, ratio=2.24, index0=2.0, env=dec(2.8), vol=0.7),
        at(0.07, clack(1700.0, dur=0.05, seed=134, vol=0.8)),
        at(0.075, osc(0.05, "sine", 240.0, 190.0, env=dec(2.2), vol=0.4)),
    )


def player_hurt():
    # Deep thud + a falling wince. The mix around it should duck; the sound
    # itself stays short — pain is information, not punishment.
    return mix(
        osc(0.10, "sine", 150.0, 55.0, env=dec(1.6), vol=1.1),
        gain(lp1(white(0.05, 135, dec(2.6)), 1100.0), 0.5),
        at(0.02, osc(0.14, "tri", 640.0, 310.0, vib=0.04, vib_rate=14.0, env=dec(1.8), vol=0.4)),
    )


def player_hurt_blade():
    # Schwick + thud — sharper than gunfire damage, because it just ignored
    # your plates and you need to know that class of enemy by ear.
    schwick = hp1(white(0.05, 136, adec(0.25, 3.0)), 2600.0, 5200.0)
    return mix(
        gain(schwick, 0.9),
        at(0.04, osc(0.08, "sine", 170.0, 65.0, env=dec(1.8), vol=0.9)),
        at(0.05, osc(0.10, "tri", 540.0, 260.0, env=dec(2.0), vol=0.35)),
    )


def kill_human():
    # Body-drop thud + a small descending resolve. A fact, not a fanfare.
    return mix(
        osc(0.09, "sine", 130.0, 50.0, env=dec(1.7), vol=1.0),
        gain(lp1(white(0.07, 137, dec(2.2)), 900.0), 0.45),
        at(0.09, osc(0.09, "tri", 330.0, 245.0, env=dec(2.2), vol=0.30)),
    )


def kill_machine():
    # Powering down: a falling whine and sparks. Capital expenditure, written off.
    whine = fm(0.30, 1150.0, 90.0, ratio=1.5, index0=1.2, index1=2.5, env=dec(1.1), vol=0.6)
    def spark(i):
        return gain(hp1(lfsr(0.03, 8600.0, short=True, env=dec(4.0)), 2400.0), 0.35)
    sparks = grains(3, 0.07, spark, gain_slope=0.75, spacing_jitter=0.3, seed=138)
    thud = at(0.16, osc(0.08, "sine", 120.0, 55.0, env=dec(1.8), vol=0.7))
    return mix(crush(whine, bits=9, hold=3), sparks, thud)


def knife_stab():
    # Schunk. Bump-melee — brief, close, a little too intimate.
    return mix(
        hp1(white(0.035, 139, adec(0.2, 3.5)), 2200.0, 4600.0),
        at(0.025, mix(
            osc(0.06, "sine", 190.0, 80.0, env=dec(2.2), vol=0.8),
            gain(lp1(white(0.03, 140, dec(3.0)), 1600.0), 0.4),
        )),
    )


def low_hp():
    # Heartbeat double-thump, soft, loopable. The death spiral, minus a
    # sidebar glance.
    def thump(f, v):
        return mix(
            osc(0.09, "sine", f, f * 0.55, env=dec(2.0), vol=v),
            gain(lp1(white(0.02, 141, dec(3.0)), 500.0), 0.12),
        )
    return mix(thump(95.0, 0.9), at(0.16, thump(80.0, 0.65)))


def boss_sting():
    # Two dark chords, close voicing, unresolved. Management has noticed you.
    def note(f, dur=0.5, vol=0.30):
        return fm(dur, f, f, ratio=2.0, index0=1.6, index1=0.4, env=gate(0.6, 4.0), vol=vol)
    chord1 = mix(note(146.83), note(174.61), note(220.0))          # D F A
    chord2 = mix(note(138.59, 0.8), note(174.61, 0.8), note(207.65, 0.8))  # Db F Ab
    return echo(mix(chord1, at(0.42, chord2)), delay=0.13, feedback=0.3, mix_level=0.25)


FEEDBACK = {
    "hit_flesh": hit_flesh, "hit_hard": hit_hard,
    "miss_ricochet": miss_ricochet, "armor_clatter": armor_clatter,
    "plate_break": plate_break, "plate_slot": plate_slot,
    "player_hurt": player_hurt, "player_hurt_blade": player_hurt_blade,
    "kill_human": kill_human, "kill_machine": kill_machine,
    "knife_stab": knife_stab, "low_hp": low_hp, "boss_sting": boss_sting,
}
