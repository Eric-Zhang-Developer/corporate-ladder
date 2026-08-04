"""
Enemy signature voices (docs/sound-design.md §5). The telegraph sounds
(drone_arm, turret_lock, warden_spinup, minigun_spinup) are gameplay: they
are audible countdowns for enemies whose whole design is "you get a warning,
use it." Rising pitch = time running out, everywhere in this file.
"""

from synth import (
    SR, adec, at, crush, dec, echo, fm, gain, gate, grains, hp1, lfsr, lp1,
    mix, osc, shape, svf, white,
)
from guns import clack


def spot_human():
    # Walkie-talkie: squelch click, a chirp of compressed voice, click off.
    # The one-turn warning — audible even when the spotter is off-screen.
    click = gain(hp1(white(0.015, 150, dec(1.0)), 2000.0), 0.7)
    voice = crush(svf(white(0.16, 151, adec(0.2, 1.2)),
                      "bp", 1400.0, 900.0, 0.4), bits=8, hold=3)
    burst = fm(0.10, 820.0, 760.0, ratio=1.02, index0=1.8, env=adec(0.3, 1.5), vol=0.4)
    off = at(0.20, gain(hp1(white(0.012, 152, dec(1.0)), 2400.0), 0.5))
    return mix(click, at(0.02, gain(voice, 1.4)), at(0.04, burst), off)


def spot_machine():
    # Sensor pair: two rising beeps, clean and bloodless.
    def beep(f):
        return osc(0.07, "pulse", f, f, duty=0.3, env=gate(0.7, 6.0), vol=0.5)
    return mix(lp1(beep(1180.0), 6000.0), at(0.11, lp1(beep(1570.0), 6000.0)))


def camera_alert():
    # Servo swivel, then klaxon beep-beep. Red light in audio form.
    servo = fm(0.14, 300.0, 520.0, ratio=1.98, index0=1.5, env=adec(0.4, 1.5), vol=0.30)
    def kbeep(i):
        return osc(0.11, "pulse", 960.0, 940.0, duty=0.45, env=gate(0.75, 5.0), vol=0.5)
    beeps = at(0.16, grains(2, 0.16, kbeep, seed=153))
    return mix(servo, lp1(beeps, 5200.0))


def alarm_klaxon():
    # Two-tone alarm bar, loopable. The floor knows.
    hi = osc(0.24, "pulse", 830.0, 830.0, duty=0.5, env=gate(0.9, 6.0), vol=0.45)
    lo = osc(0.24, "pulse", 622.0, 622.0, duty=0.5, env=gate(0.9, 6.0), vol=0.45)
    bar = mix(lp1(hi, 4200.0), at(0.26, lp1(lo, 4200.0)))
    return echo(bar, delay=0.09, feedback=0.25, mix_level=0.18)


def elevator_arrival():
    # Ding. Doors. Boots. Funny and threatening at once — the response team.
    ding = fm(0.5, 1568.0, 1560.0, ratio=2.76, index0=1.6, index1=0.2, env=dec(1.8), vol=0.7)
    doors = at(0.34, lp1(white(0.28, 154, adec(0.3, 1.6)), 1500.0, 700.0))
    def boot(i):
        return mix(
            osc(0.05, "sine", 150.0, 70.0, env=dec(2.4), vol=0.55),
            gain(lp1(white(0.02, 155 + i, dec(3.0)), 1200.0), 0.25),
        )
    boots = at(0.62, grains(4, 0.13, boot, gain_slope=0.9, spacing_jitter=0.1, seed=156))
    return mix(ding, gain(doors, 0.5), boots)


def dog_bark():
    # Classic 16-bit FM bark, twice. Ratio just off integer = animal throat.
    def bark(seed_off):
        body = fm(0.11, 340.0, 190.0, ratio=1.43, index0=3.5, index1=1.0, env=adec(0.12, 1.6), vol=0.9)
        rasp = gain(svf(white(0.09, 157 + seed_off, adec(0.15, 2.0)), "bp", 900.0, 500.0, 0.5), 0.7)
        return mix(body, rasp)
    return mix(bark(0), at(0.22, gain(bark(1), 0.85)))


def taser_zap():
    # Crackle burst + buzz. Electricity is texture, not tone.
    def tick(i):
        return gain(hp1(lfsr(0.014, 9800.0, short=True, env=dec(1.0)), 2600.0), 0.8)
    crackle = grains(9, 0.017, tick, spacing_jitter=0.45, seed=158)
    buzz = osc(0.16, "pulse", 118.0, 122.0, duty=0.2, pwm=0.15, pwm_rate=40.0,
               env=adec(0.1, 1.5), vol=0.35)
    return mix(crackle, lp1(buzz, 2400.0))


def drone_arm():
    # Rising whine + beep accelerando. This sound means RUN.
    whine = fm(0.7, 620.0, 1750.0, ratio=1.01, index0=0.6, index1=1.4, env=adec(0.15, 0.8), vol=0.45)
    beeps = mix(*[
        at(0.7 * (1.0 - 0.82 ** (i + 1)) / 0.18 * 0.18,  # accelerating positions
           osc(0.035, "pulse", 1900.0, 1900.0, duty=0.4, env=gate(0.8, 5.0), vol=0.35))
        for i in range(6)
    ])
    return mix(lp1(whine, 5200.0), lp1(beeps, 6000.0))


def turret_lock():
    # Targeting: beep… beep… beeep. The third one is the last warning.
    def beep(dur, f):
        return lp1(osc(dur, "pulse", f, f, duty=0.35, env=gate(0.8, 6.0), vol=0.5), 5600.0)
    return mix(
        beep(0.06, 1240.0),
        at(0.22, beep(0.06, 1240.0)),
        at(0.44, beep(0.16, 1650.0)),
    )


def warden_spinup():
    # Heavy servo rumble rising — mass getting ready to move.
    rumble = fm(0.8, 55.0, 150.0, ratio=1.5, index0=2.0, index1=3.5, env=adec(0.25, 1.0), vol=0.8)
    grind = svf(white(0.8, 159, adec(0.3, 1.2)), "bp", 240.0, 700.0, 0.5)
    return mix(lp1(rumble, 900.0), gain(grind, 0.5))


def stealth_reveal():
    # Cloak-drop: a shimmer sweeping down into a hiss. Something was HERE.
    shimmer = fm(0.4, 3400.0, 700.0, ratio=1.41, index0=2.5, index1=0.5, env=adec(0.05, 1.4), vol=0.5)
    hiss = at(0.18, gain(hp1(white(0.22, 160, dec(1.6)), 3200.0), 0.35))
    under = osc(0.3, "sine", 220.0, 90.0, env=adec(0.2, 1.5), vol=0.4)
    return mix(shimmer, hiss, under)


def minigun_spinup():
    # Motor climbing for ~0.8s — the Dozer's telegraph. It only gets worse.
    motor = osc(0.85, "saw", 90.0, 340.0, vib=0.02, vib_rate=28.0, env=adec(0.1, 0.7), vol=0.6)
    whir = svf(white(0.85, 161, adec(0.2, 0.9)), "bp", 400.0, 1500.0, 0.6)
    return mix(lp1(motor, 2000.0), gain(whir, 0.4))


ENEMIES = {
    "spot_human": spot_human, "spot_machine": spot_machine,
    "camera_alert": camera_alert, "alarm_klaxon": alarm_klaxon,
    "elevator_arrival": elevator_arrival, "dog_bark": dog_bark,
    "taser_zap": taser_zap, "drone_arm": drone_arm,
    "turret_lock": turret_lock, "warden_spinup": warden_spinup,
    "stealth_reveal": stealth_reveal, "minigun_spinup": minigun_spinup,
}
