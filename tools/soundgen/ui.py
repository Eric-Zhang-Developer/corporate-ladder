"""
UI & economy voices (docs/sound-design.md §5). The corporate register lives
here: badge scanners, registers, voicemail. Melodic content is FM "brass"
and tri "woodwind" — 16-bit instruments, quantized to real notes so the set
feels composed rather than generated.
"""

from synth import (
    adec, at, crush, dec, echo, fm, gain, gate, grains, hp1, lfsr, lp1, mix,
    osc, white,
)
from guns import clack


def _brass(f, dur=0.14, vol=0.4, sustain=False):
    """FM brass — the promotion/death/win instrument."""
    env = gate(0.75, 5.0) if not sustain else dec(1.1)
    return fm(dur, f, f, ratio=1.0, index0=2.2, index1=0.6, env=env, vol=vol)


def pickup_ammo():
    # Two brass ticks — casings knocking together in a pocket.
    def tick(i):
        return mix(
            gain(hp1(lfsr(0.03, 8200.0 - 700.0 * i, short=True, env=dec(3.5)), 2200.0), 0.5),
            fm(0.035, 2200.0 - 250.0 * i, 2100.0, ratio=3.1, index0=1.4, env=dec(4.0), vol=0.3),
        )
    return grains(2, 0.06, tick, seed=180)


def pickup_weapon():
    # Heavy clack + strap thump. You are now holding an argument.
    return mix(
        clack(1400.0, dur=0.06, seed=181, vol=1.0),
        at(0.07, osc(0.07, "sine", 170.0, 85.0, env=dec(2.0), vol=0.7)),
        at(0.07, gain(lp1(white(0.04, 182, dec(2.6)), 1300.0), 0.3)),
    )


def pickup_cash():
    # Double coin ding — the one genre cliché kept on purpose.
    def coin(f):
        return fm(0.14, f, f, ratio=2.52, index0=1.8, index1=0.3, env=dec(2.4), vol=0.5)
    return mix(coin(1975.5), at(0.07, coin(2637.0)))


def pickup_item():
    # Soft blip. Inventory noise, not an event.
    return lp1(osc(0.07, "tri", 740.0, 880.0, env=gate(0.6, 5.0), vol=0.45), 4600.0)


def buy_ok():
    # Ka-ching: register bell + cash drawer. Commerce, celebrated briefly.
    bell = fm(0.30, 2093.0, 2080.0, ratio=3.51, index0=2.0, index1=0.3, env=dec(2.2), vol=0.55)
    drawer = at(0.10, mix(
        gain(lp1(white(0.08, 183, dec(2.0)), 2000.0, 800.0), 0.4),
        osc(0.07, "sine", 150.0, 90.0, env=dec(2.2), vol=0.5),
    ))
    return mix(bell, drawer)


def buy_denied():
    # Dull double buzz. Your card, declined, in front of everyone.
    def buzz(i):
        return lp1(osc(0.11, "pulse", 220.0, 215.0, duty=0.5, env=gate(0.8, 4.0), vol=0.5), 1800.0)
    return grains(2, 0.15, buzz, seed=184)


def promote():
    # Three clean brass notes, then the fourth lands FLAT (B3 where B-nat
    # belongs) over a dark pad. Triumph with a problem — the game's thesis
    # in four notes.
    notes = [(523.25, 0.00, 0.13), (659.26, 0.12, 0.13), (783.99, 0.24, 0.13),
             (987.77 * 0.9439, 0.38, 0.55)]  # ~B4 flattened a semitone
    layers = [at(t, _brass(f, d, vol=0.42, sustain=(d > 0.3))) for f, t, d in notes]
    pad = at(0.38, fm(0.6, 261.63, 261.63, ratio=0.5, index0=1.0, index1=0.3, env=dec(1.2), vol=0.30))
    return echo(mix(*layers, pad), delay=0.11, feedback=0.25, mix_level=0.2)


def perk_pick():
    # A stamp coming down on paper, then a short affirmative chord.
    stamp = mix(
        osc(0.06, "sine", 190.0, 80.0, env=dec(2.2), vol=0.9),
        gain(lp1(white(0.03, 185, dec(3.0)), 2400.0), 0.5),
    )
    chord = at(0.09, mix(_brass(523.25, 0.22, 0.3), _brass(659.26, 0.22, 0.3)))
    return mix(stamp, chord)


def ascend_elevator():
    # Doors close, motor hum rises a floor, ding. Going up.
    doors = gain(lp1(white(0.22, 186, adec(0.3, 1.8)), 1400.0, 600.0), 0.45)
    hum = at(0.20, lp1(osc(0.7, "saw", 65.0, 105.0, vib=0.01, vib_rate=8.0,
                           env=adec(0.2, 1.2), vol=0.5), 700.0))
    ding = at(0.85, fm(0.4, 1568.0, 1560.0, ratio=2.76, index0=1.5, index1=0.2, env=dec(2.0), vol=0.55))
    return mix(doors, hum, ding)


def ui_blip():
    # Cursor tick. Near-silent furniture.
    return lp1(osc(0.03, "pulse", 1100.0, 1100.0, duty=0.3, env=gate(0.7, 5.0), vol=0.3), 5200.0)


def death():
    # The voicemail motif: two dial-tone beats, then a four-note falling
    # minor line over a low pad. Your call is important to us.
    def dialtone(t):
        return at(t, lp1(mix(
            osc(0.22, "sine", 350.0, 350.0, env=gate(0.85, 6.0), vol=0.30),
            osc(0.22, "sine", 440.0, 440.0, env=gate(0.85, 6.0), vol=0.30),
        ), 3000.0))
    line_notes = [(659.26, 0.00), (587.33, 0.22), (523.25, 0.44), (493.88, 0.66)]
    line = [at(0.55 + t, _brass(f, 0.20 if t < 0.6 else 0.7, vol=0.4,
                                sustain=(t >= 0.6))) for f, t in line_notes]
    pad = at(0.55, fm(1.4, 130.81, 130.81, ratio=0.5, index0=1.2, index1=0.3, env=dec(1.1), vol=0.35))
    return echo(mix(dialtone(0.0), dialtone(0.3), *line, pad),
                delay=0.14, feedback=0.3, mix_level=0.22)


def win():
    # Rooftop: a rising major arp into a held chord, with air underneath.
    # The only unambiguous sound in the game.
    arp_notes = [(523.25, 0.00), (659.26, 0.12), (783.99, 0.24), (1046.5, 0.36)]
    arp = [at(t, _brass(f, 0.14, vol=0.38)) for f, t in arp_notes]
    chord = [at(0.52, _brass(f, 1.1, vol=0.30, sustain=True))
             for f in (523.25, 659.26, 783.99, 1046.5)]
    air = at(0.4, gain(hp1(white(1.2, 187, adec(0.3, 1.0)), 3800.0), 0.10))
    return echo(mix(*arp, *chord, air), delay=0.13, feedback=0.3, mix_level=0.25)


def game_start():
    # Badge scan + door unlock. Clocking in; the tower accepts you.
    beep = osc(0.09, "pulse", 1480.0, 1480.0, duty=0.4, env=gate(0.8, 5.0), vol=0.4)
    unlock = at(0.14, mix(
        clack(1600.0, dur=0.05, seed=188, vol=0.8),
        fm(0.08, 420.0, 300.0, ratio=2.3, index0=2.0, env=dec(2.6), vol=0.5),
    ))
    return mix(lp1(beep, 5600.0), unlock)


UI = {
    "pickup_ammo": pickup_ammo, "pickup_weapon": pickup_weapon,
    "pickup_cash": pickup_cash, "pickup_item": pickup_item,
    "buy_ok": buy_ok, "buy_denied": buy_denied,
    "promote": promote, "perk_pick": perk_pick,
    "ascend_elevator": ascend_elevator, "ui_blip": ui_blip,
    "death": death, "win": win, "game_start": game_start,
}
