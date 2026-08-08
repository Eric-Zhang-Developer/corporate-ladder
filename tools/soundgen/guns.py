"""
Gun voices (docs/sound-design.md §4): 30 player weapons + 5 enemy-only.

Grammar: caliber picks the family helper, stats pick grain count/spacing/sub
depth, and every id then gets hand-tuned numbers. Enemy variants of player
guns (glock_cop, m4_merc, ...) are aliases resolved in generate.py — same
gun, same sound.

Every recipe: transient + body + sub (+ tail/mechanism). Volleys are built
from grains() — n small shots in rhythm, never one long burst.
"""

from synth import (
    SR, adec, at, clip, crush, dec, echo, fm, gain, gate, grains, hp1, lfsr,
    lp1, mix, osc, shape, svf, white,
)


# ---------------------------------------------------------------- family kit


def snap(center, dur=0.07, res=0.8, seed=1, vol=1.0, punch=2.5):
    """Pistol-family body: bandpassed noise burst falling through `center`."""
    body = svf(white(dur, seed, dec(punch)), "bp", center, center * 0.5, res)
    return gain(body, vol * 2.2)


def transient(dur=0.007, fc=3800.0, seed=2, vol=1.0):
    """The first half-millisecond of a gunshot: bright, tiny, essential."""
    return gain(hp1(white(dur, seed, dec(1.2)), fc), vol)


def sub_drop(f0, f1, dur=0.06, vol=1.0, wave="sine"):
    """The chest-thump layer. Depth = caliber authority."""
    return osc(dur, wave, f0, f1, env=dec(1.8), vol=vol)


def boom(dur=0.30, top=5200.0, floor=380.0, seed=3, vol=1.0, punch=1.7):
    """Shell-family body: wide noise blast whose brightness collapses."""
    return gain(lp1(white(dur, seed, dec(punch)), top, floor), vol * 1.6)


def growl(dur=0.09, f0=210.0, f1=90.0, vol=0.5):
    """Rifle-family mid layer: a dark saw under the crack = powder burn."""
    return lp1(osc(dur, "saw", f0, f1, env=dec(2.0), vol=vol), 1400.0)


def whip(dur=0.16, seed=4, vol=0.35):
    """Sniper tail: thin high noise arriving just after the crack."""
    return at(0.012, gain(hp1(white(dur, seed, dec(1.3)), 2200.0), vol))


def clack(fc=2400.0, dur=0.035, seed=5, vol=0.5):
    """One metallic mechanism tick (short-tap LFSR + FM ping)."""
    return mix(
        gain(hp1(lfsr(dur, 9500.0, short=True, env=dec(3.5)), 900.0), vol),
        fm(dur * 0.8, fc, fc * 0.8, ratio=3.7, index0=2.0, env=dec(4.0), vol=vol * 0.5),
    )


def room(buf, size=0.5):
    """The tower answers. size 0..1 scales delay/mix together."""
    return echo(buf, delay=0.08 + 0.05 * size, feedback=0.28 + 0.12 * size,
                mix_level=0.12 + 0.18 * size, damp=2800.0 - 900.0 * size)


# ------------------------------------------------------------ pistol channel


def gun_glock():
    # The office stapler: polite, tight, no ceremony.
    return mix(
        transient(vol=0.9),
        snap(1700.0, dur=0.06, seed=11),
        sub_drop(190.0, 85.0, dur=0.035, vol=0.5),
    )


def gun_revolver():
    # One fat iron crack with a cylinder ring — the wheelgun has a bell in it.
    return room(mix(
        transient(vol=1.0),
        snap(950.0, dur=0.09, res=0.6, seed=12, vol=1.2),
        sub_drop(150.0, 60.0, dur=0.06, vol=0.9),
        fm(0.10, 1450.0, 1400.0, ratio=3.01, index0=1.4, env=dec(3.2), vol=0.16),
    ), size=0.25)


def gun_tec9():
    # Two cheap grains + stamped-metal rattle. Sounds like its price.
    def g(i):
        return mix(
            transient(vol=0.7, seed=13 + i),
            snap(2100.0, dur=0.05, seed=23 + i, vol=0.9),
            sub_drop(170.0, 90.0, dur=0.025, vol=0.35),
        )
    burst = grains(2, 0.055, g, gain_slope=0.9, seed=13)
    rattle = at(0.01, gain(hp1(lfsr(0.07, 6800.0, short=True, env=dec(2.5)), 1500.0), 0.14))
    return mix(burst, rattle)


def gun_fiveseven():
    # High, fast, almost toy-like but precise — the smallest real crack.
    return mix(
        transient(fc=4600.0, vol=1.0),
        snap(2500.0, dur=0.045, res=0.9, seed=14),
        sub_drop(220.0, 110.0, dur=0.025, vol=0.35),
    )


def gun_b93r():
    # Three small grains at 35 ms — a burst you count.
    def g(i):
        return mix(
            transient(vol=0.65, seed=15 + i),
            snap(1900.0, dur=0.05, seed=25 + i, vol=0.85),
            sub_drop(180.0, 95.0, dur=0.025, vol=0.35),
        )
    return grains(3, 0.035, g, gain_slope=0.93, seed=15)


def gun_deagle():
    # Pistol envelope, heavy-channel body. The showoff.
    return room(mix(
        transient(vol=1.1),
        snap(750.0, dur=0.10, res=0.55, seed=16, vol=1.3),
        sub_drop(120.0, 45.0, dur=0.08, vol=1.1),
        whip(dur=0.10, seed=26, vol=0.22),
    ), size=0.35)


def gun_uzi():
    # Four tight grains drifting slightly upward — muzzle climb, audible.
    def g(i):
        c = 1800.0 * (1.0 + 0.04 * i)
        return mix(
            transient(vol=0.7, seed=17 + i),
            snap(c, dur=0.05, seed=27 + i, vol=0.9),
            sub_drop(180.0, 90.0, dur=0.025, vol=0.4),
        )
    return grains(4, 0.045, g, gain_slope=0.94, spacing_jitter=0.06, seed=17)


def gun_mp5():
    # The movie SMG: three round, warm grains — lowpassed so they purr.
    def g(i):
        return lp1(mix(
            transient(vol=0.7, seed=18 + i),
            snap(1400.0, dur=0.055, res=0.65, seed=28 + i, vol=1.0),
            sub_drop(160.0, 80.0, dur=0.03, vol=0.5),
        ), 5200.0)
    return grains(3, 0.040, g, gain_slope=0.93, seed=18)


def gun_ump45():
    # Two fat slow .45 thumps — half the rate, twice the meal.
    def g(i):
        return mix(
            transient(vol=0.8, seed=19 + i),
            snap(1000.0, dur=0.07, res=0.6, seed=29 + i, vol=1.2),
            sub_drop(130.0, 60.0, dur=0.05, vol=0.8),
        )
    return grains(2, 0.055, g, gain_slope=0.95, seed=19)


def gun_p90():
    # Five zippy grains at 28 ms. The sewing machine.
    def g(i):
        return mix(
            transient(fc=4400.0, vol=0.6, seed=20 + i),
            snap(2300.0, dur=0.04, res=0.85, seed=30 + i, vol=0.8),
            sub_drop(200.0, 105.0, dur=0.02, vol=0.3),
        )
    return grains(5, 0.028, g, gain_slope=0.95, spacing_jitter=0.04, seed=20)


# ------------------------------------------------------------- shell channel


def pump_rack(vol=1.0):
    # Shuck-shuck. Exported alone AND appended to the M870's fire.
    return gain(mix(
        clack(1900.0, dur=0.04, seed=31, vol=0.9),
        at(0.005, gain(lfsr(0.05, 5200.0, short=True, env=dec(2.0)), 0.2)),
        at(0.11, clack(1500.0, dur=0.05, seed=32, vol=1.0)),
        at(0.115, gain(lfsr(0.06, 4200.0, short=True, env=dec(2.0)), 0.2)),
    ), vol)


def gun_serbu():
    # Short barrel: all blast, no follow-through. Clipped tail, big sub.
    return room(mix(
        transient(vol=1.2),
        clip(boom(dur=0.16, top=6000.0, floor=500.0, seed=33, punch=2.6), 1.6),
        sub_drop(105.0, 42.0, dur=0.09, vol=1.2, wave="tri"),
    ), size=0.3)


def gun_m870():
    # The full boom, then the pump 180 ms later. The pump IS the identity.
    shot = room(mix(
        transient(vol=1.1),
        boom(dur=0.30, top=5200.0, floor=360.0, seed=34, punch=1.7),
        sub_drop(95.0, 38.0, dur=0.13, vol=1.1, wave="tri"),
    ), size=0.5)
    return mix(shot, at(0.18, pump_rack(vol=0.65)))


def gun_spas12():
    # Harder and tighter than the 870, with a steel receiver clang.
    return room(mix(
        transient(vol=1.2),
        clip(boom(dur=0.26, top=5800.0, floor=420.0, seed=35, punch=2.0), 1.4),
        sub_drop(100.0, 40.0, dur=0.11, vol=1.1, wave="tri"),
        fm(0.07, 1150.0, 1100.0, ratio=2.41, index0=2.2, env=dec(3.5), vol=0.22),
    ), size=0.45)


def gun_aa12():
    # Auto shotgun: thud-thud, softer pitch drop — it absorbs its own recoil.
    def g(i):
        return mix(
            transient(vol=0.9, seed=36 + i),
            boom(dur=0.20, top=4600.0, floor=420.0, seed=46 + i, punch=1.9, vol=0.9),
            sub_drop(90.0, 48.0, dur=0.10, vol=0.9, wave="tri"),
        )
    return room(grains(2, 0.080, g, gain_slope=0.92, seed=36), size=0.4)


# ------------------------------------------------------------- rifle channel


def rifle_crack(center=1500.0, dur=0.08, seed=50, vol=1.0, growl_vol=0.5):
    return mix(
        transient(fc=4200.0, vol=1.0, seed=seed),
        gain(svf(white(dur, seed + 100, dec(2.2)), "bp", center, center * 0.45, 0.7), vol * 2.4),
        growl(vol=growl_vol),
        sub_drop(160.0, 70.0, dur=0.05, vol=0.7),
    )


def gun_mini14():
    # Ranch-rifle politeness: clean, flat, minimal tail.
    return room(rifle_crack(1750.0, dur=0.07, seed=51, growl_vol=0.35), size=0.2)


def gun_sks():
    # Mid crack + the SKS's tinny post-shot action clatter.
    return room(mix(
        rifle_crack(1450.0, dur=0.08, seed=52),
        at(0.055, gain(hp1(lfsr(0.05, 7200.0, short=True, env=dec(3.0)), 1800.0), 0.16)),
    ), size=0.3)


def gun_ar15():
    # The classic bright 5.56 pop.
    return room(rifle_crack(1850.0, dur=0.075, seed=53, growl_vol=0.4), size=0.3)


def gun_m4():
    # Three ar15 grains, slightly lower — the burst sibling.
    def g(i):
        return rifle_crack(1650.0, dur=0.065, seed=54 + i, vol=0.9, growl_vol=0.35)
    return room(grains(3, 0.040, g, gain_slope=0.93, seed=54), size=0.3)


def gun_akm():
    # Wood and steel: low-mid 7.62 thunk, dusty tail.
    return room(mix(
        rifle_crack(1050.0, dur=0.10, seed=55, vol=1.15, growl_vol=0.7),
        sub_drop(130.0, 55.0, dur=0.07, vol=0.5),
        at(0.03, gain(lp1(white(0.16, 65, dec(1.4)), 1900.0, 500.0), 0.3)),
    ), size=0.45)


def gun_an94():
    # The hyperburst: two grains 18 ms apart — a flam, not a burst.
    def g(i):
        return rifle_crack(1600.0, dur=0.07, seed=56 + i, vol=0.95, growl_vol=0.4)
    return room(grains(2, 0.018, g, gain_slope=0.97, seed=56), size=0.3)


def gun_m249():
    # Five rattly grains with a chain-jingle under them. The belt is audible.
    def g(i):
        return rifle_crack(1350.0, dur=0.06, seed=57 + i, vol=0.85, growl_vol=0.5)
    burst = grains(5, 0.045, g, gain_slope=0.95, spacing_jitter=0.07, seed=57)
    jingle = shape(gain(hp1(lfsr(0.24, 5800.0, short=True), 2400.0), 0.12), dec(1.2))
    return room(mix(burst, jingle), size=0.4)


def gun_xm250():
    # The M249's replacement: deeper, smoother, the rattle engineered out.
    def g(i):
        return rifle_crack(1150.0, dur=0.065, seed=58 + i, vol=0.95, growl_vol=0.6)
    return room(grains(5, 0.040, g, gain_slope=0.95, spacing_jitter=0.03, seed=58), size=0.4)


# ------------------------------------------------------------- heavy channel


def heavy_crack(center=800.0, dur=0.14, seed=70, vol=1.0, sub_f=95.0, sub_dur=0.10):
    return mix(
        transient(fc=3600.0, vol=1.2, seed=seed),
        gain(svf(white(dur, seed + 100, dec(1.8)), "bp", center, center * 0.35, 0.6), vol * 2.6),
        sub_drop(sub_f, sub_f * 0.4, dur=sub_dur, vol=1.0),
        whip(seed=seed + 200),
    )


def gun_mosin():
    # The heaviest T1 sound in the game — a hundred-year-old thunderclap.
    return room(heavy_crack(720.0, dur=0.16, seed=71, sub_f=90.0, sub_dur=0.12), size=0.7)


def gun_garand():
    # Big flat crack; its real glory is reload_enbloc's ping.
    return room(heavy_crack(880.0, dur=0.13, seed=72, sub_f=100.0), size=0.5)


def gun_fal():
    # The right arm of the free world: broad boom, long tail.
    return room(mix(
        heavy_crack(780.0, dur=0.15, seed=73, sub_f=95.0, sub_dur=0.11),
        growl(dur=0.11, f0=180.0, f1=70.0, vol=0.5),
    ), size=0.6)


def gun_rem700():
    # Hunting bolt gun: clean deep crack, then a lonely echo.
    return room(heavy_crack(830.0, dur=0.14, seed=74, sub_f=92.0), size=0.75)


def gun_sr25():
    # Precision semi-auto: tighter crack, more whip, less boom.
    return room(mix(
        heavy_crack(950.0, dur=0.11, seed=75, sub_f=98.0, sub_dur=0.08),
        whip(dur=0.20, seed=76, vol=0.45),
    ), size=0.55)


def gun_xm7():
    # Modern, dark, controlled — a crack with a suit on.
    return room(mix(
        heavy_crack(900.0, dur=0.12, seed=77, sub_f=105.0),
        at(0.05, clack(2100.0, dur=0.03, seed=78, vol=0.25)),
    ), size=0.45)


def gun_awp():
    # The biggest player sound: crack, whip, and a faint bell. The flex.
    return room(mix(
        heavy_crack(650.0, dur=0.18, seed=79, sub_f=80.0, sub_dur=0.14),
        whip(dur=0.26, seed=80, vol=0.5),
        fm(0.20, 1900.0, 1850.0, ratio=3.53, index0=1.2, env=dec(2.8), vol=0.10),
    ), size=0.85)


def suppressed(body_vol=1.0, clack_vol=0.45, seed=90):
    """Thup + action clack — the suppressed grammar (VSS, Fixer)."""
    thup = lp1(white(0.08, seed, dec(3.0)), 900.0, 300.0)
    puff = sub_drop(140.0, 70.0, dur=0.05, vol=0.6)
    action = at(0.045, clack(2000.0, dur=0.035, seed=seed + 1, vol=clack_vol))
    return mix(gain(thup, 2.2 * body_vol), puff, action)


def gun_vss():
    return suppressed(body_vol=0.9, seed=91)


# ---------------------------------------------------------------- enemy-only


def gun_fixer_pistol():
    # Suppressed but potent: more body than the VSS. A door closing firmly.
    return mix(suppressed(body_vol=1.25, clack_vol=0.5, seed=92),
               sub_drop(110.0, 55.0, dur=0.06, vol=0.5))


def gun_m82():
    # Near-explosion. You hear this across the floor and feel small.
    return room(mix(
        transient(fc=3000.0, vol=1.4, seed=95),
        gain(svf(white(0.24, 96, dec(1.5)), "bp", 520.0, 160.0, 0.55), 3.0),
        sub_drop(70.0, 30.0, dur=0.18, vol=1.3, wave="tri"),
        whip(dur=0.30, seed=97, vol=0.5),
    ), size=1.0)


def gun_turret_gun():
    # Servo pre-blip, then one robotic snap. Precision without malice.
    return mix(
        fm(0.03, 2600.0, 2900.0, ratio=1.5, index0=1.0, env=dec(2.0), vol=0.25),
        at(0.035, mix(
            transient(vol=1.0, seed=98),
            snap(1600.0, dur=0.06, res=0.9, seed=99, vol=1.1),
            sub_drop(170.0, 85.0, dur=0.04, vol=0.6),
        )),
    )


def gun_warden_slam():
    # Not a gun: hydraulic servo winds up, then metal meets metal.
    servo = fm(0.12, 120.0, 320.0, ratio=1.98, index0=2.5, index1=1.0, env=adec(0.4, 1.0), vol=0.5)
    impact = at(0.11, mix(
        clip(gain(lp1(white(0.10, 101, dec(2.6)), 2600.0, 500.0), 2.0), 1.8),
        fm(0.12, 380.0, 210.0, ratio=2.83, index0=3.0, env=dec(2.4), vol=0.7),
        sub_drop(90.0, 40.0, dur=0.09, vol=1.0),
    ))
    return room(mix(servo, impact), size=0.5)


def gun_minigun():
    # Six grains at 25 ms over a motor whine. The Dozer's sentence.
    def g(i):
        return rifle_crack(1250.0, dur=0.05, seed=103 + i, vol=0.8, growl_vol=0.4)
    burst = grains(6, 0.025, g, gain_slope=0.97, seed=103)
    motor = osc(0.22, "saw", 240.0, 260.0, vib=0.02, vib_rate=30.0, env=gate(0.8), vol=0.12)
    return room(mix(burst, lp1(motor, 1600.0)), size=0.4)


GUNS = {
    "glock": gun_glock, "revolver": gun_revolver, "tec9": gun_tec9,
    "fiveseven": gun_fiveseven, "b93r": gun_b93r, "deagle": gun_deagle,
    "uzi": gun_uzi, "mp5": gun_mp5, "ump45": gun_ump45, "p90": gun_p90,
    "serbu": gun_serbu, "m870": gun_m870, "spas12": gun_spas12, "aa12": gun_aa12,
    "mini14": gun_mini14, "sks": gun_sks, "ar15": gun_ar15, "m4": gun_m4,
    "akm": gun_akm, "an94": gun_an94, "m249": gun_m249, "xm250": gun_xm250,
    "mosin": gun_mosin, "garand": gun_garand, "fal": gun_fal,
    "rem700": gun_rem700, "sr25": gun_sr25, "xm7": gun_xm7, "awp": gun_awp,
    "vss": gun_vss,
    "fixer_pistol": gun_fixer_pistol, "m82": gun_m82,
    "turret_gun": gun_turret_gun, "warden_slam": gun_warden_slam,
    "minigun": gun_minigun,
}
