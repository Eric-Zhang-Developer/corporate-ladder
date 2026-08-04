"""
16-bit synthesis library for Severance Package (docs/sound-design.md §3).

Target: SNES-era — 32 kHz mono, composed layers, warm lowpass rounding, FM
for anything metallic-musical, damped echo for rooms. Pure stdlib; every
random source is seeded so regeneration is byte-stable.

Buffers are plain lists of floats in [-1, 1]; every processor returns a new
buffer. Recipes read as: make layers, filter them, mix at offsets, master.
"""

import math
import random
import struct
import wave

SR = 32000

# ----------------------------------------------------------------- envelopes
# Envelope = callable t -> amplitude, t normalized 0..1 over the buffer.


def dec(power=2.0):
    """Percussive exponential-ish decay. Higher power = snappier."""
    return lambda t: max(0.0, (1.0 - t)) ** power


def adec(attack=0.02, power=2.0):
    """Attack ramp then decay — for swells, servos, whooshes."""
    def env(t):
        if t < attack:
            return t / attack
        return max(0.0, (1.0 - (t - attack) / (1.0 - attack))) ** power
    return env


def gate(hold=0.85, release=8.0):
    """Sustain then fast release — musical notes that end on purpose."""
    def env(t):
        if t < hold:
            return 1.0
        return max(0.0, 1.0 - (t - hold) / (1.0 - hold)) ** release
    return env


def flat():
    return lambda t: 1.0


def shape(buf, env):
    """Apply an envelope to an existing buffer."""
    n = len(buf)
    if n <= 1:
        return list(buf)
    return [v * env(i / (n - 1)) for i, v in enumerate(buf)]


# ---------------------------------------------------------------- oscillators


def _sweep(f0, f1, t):
    """Exponential frequency sweep — pitch moves musically, not linearly."""
    if f0 <= 0:
        return 0.0
    return f0 * (f1 / f0) ** t


def osc(dur, wave_kind, f0, f1=None, duty=0.5, pwm=0.0, pwm_rate=6.0,
        vib=0.0, vib_rate=6.0, env=None, vol=1.0):
    """
    One oscillator voice. wave_kind: sine | tri | saw | pulse.
    f0->f1 exponential sweep; vib is fractional vibrato depth; pwm modulates
    pulse duty. tri is NOT quantized — the 8-bit stair-step was the old draft.
    """
    env = env or dec()
    f1 = f1 if f1 is not None else f0
    n = int(dur * SR)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / (n - 1) if n > 1 else 0.0
        f = _sweep(f0, f1, t)
        if vib:
            f *= 1.0 + vib * math.sin(2.0 * math.pi * vib_rate * i / SR)
        phase = (phase + f / SR) % 1.0
        if wave_kind == "sine":
            s = math.sin(2.0 * math.pi * phase)
        elif wave_kind == "tri":
            s = 4.0 * abs(phase - 0.5) - 1.0
        elif wave_kind == "saw":
            s = 2.0 * phase - 1.0
        else:  # pulse
            d = duty + (pwm * math.sin(2.0 * math.pi * pwm_rate * i / SR) if pwm else 0.0)
            s = 1.0 if phase < d else -1.0
        out[i] = s * env(t) * vol
    return out


def fm(dur, fc0, fc1=None, ratio=2.0, index0=3.0, index1=0.0, env=None, vol=1.0):
    """
    2-operator FM — the 16-bit workhorse for bells, barks, zaps, servos.
    Carrier sweeps fc0->fc1; modulator tracks at `ratio`; modulation index
    sweeps index0->index1 (falling index = the classic metallic attack).
    """
    env = env or dec()
    fc1 = fc1 if fc1 is not None else fc0
    n = int(dur * SR)
    out = [0.0] * n
    pc = pm = 0.0
    for i in range(n):
        t = i / (n - 1) if n > 1 else 0.0
        fc = _sweep(fc0, fc1, t)
        pm = (pm + fc * ratio / SR) % 1.0
        pc = (pc + fc / SR) % 1.0
        index = index0 + (index1 - index0) * t
        s = math.sin(2.0 * math.pi * pc + index * math.sin(2.0 * math.pi * pm))
        out[i] = s * env(t) * vol
    return out


# --------------------------------------------------------------------- noise


def white(dur, seed, env=None, vol=1.0):
    """Seeded white noise — the raw material for every blast body."""
    env = env or flat()
    rng = random.Random(seed)
    n = int(dur * SR)
    return [(rng.random() * 2.0 - 1.0) * env(i / (n - 1) if n > 1 else 0.0) * vol
            for i in range(n)]


def lfsr(dur, rate_hz, short=False, env=None, vol=1.0):
    """
    15-bit LFSR noise. Long tap = hiss; short tap (bit 6) = pitched metallic
    ring — ricochets, clatter, mechanisms. rate_hz is the shift-clock rate.
    """
    env = env or flat()
    n = int(dur * SR)
    out = [0.0] * n
    reg = 1
    acc = 0.0
    step = rate_hz / SR
    tap = 6 if short else 1
    for i in range(n):
        t = i / (n - 1) if n > 1 else 0.0
        acc += step
        while acc >= 1.0:
            acc -= 1.0
            bit = (reg ^ (reg >> tap)) & 1
            reg = (reg >> 1) | (bit << 14)
        out[i] = (1.0 if (reg & 1) else -1.0) * env(t) * vol
    return out


# ------------------------------------------------------------------- filters


def lp1(buf, fc0, fc1=None):
    """One-pole lowpass, swept. The 'SNES gaussian warmth' when applied last."""
    fc1 = fc1 if fc1 is not None else fc0
    n = len(buf)
    out = [0.0] * n
    y = 0.0
    for i, x in enumerate(buf):
        t = i / (n - 1) if n > 1 else 0.0
        fc = _sweep(fc0, fc1, t)
        a = 1.0 - math.exp(-2.0 * math.pi * fc / SR)
        y += a * (x - y)
        out[i] = y
    return out


def hp1(buf, fc0, fc1=None):
    """One-pole highpass — strips the mud, or strips ALL low end (armor)."""
    fc1 = fc1 if fc1 is not None else fc0
    n = len(buf)
    out = [0.0] * n
    y = 0.0
    for i, x in enumerate(buf):
        t = i / (n - 1) if n > 1 else 0.0
        fc = _sweep(fc0, fc1, t)
        a = 1.0 - math.exp(-2.0 * math.pi * fc / SR)
        y += a * (x - y)
        out[i] = x - y
    return out


def svf(buf, mode, fc0, fc1=None, res=1.0):
    """
    Chamberlin state-variable filter: mode lp | bp | hp. res: 2.0 damped ..
    0.2 ringing. Cutoff clamped to SR/6 for stability — use hp1/lp1 above
    that. Swept bandpass on white noise IS the gun-body sound.
    """
    fc1 = fc1 if fc1 is not None else fc0
    n = len(buf)
    out = [0.0] * n
    low = band = 0.0
    q = max(0.05, min(2.0, res))
    for i, x in enumerate(buf):
        t = i / (n - 1) if n > 1 else 0.0
        fc = min(_sweep(fc0, fc1, t), SR / 6.0)
        f = 2.0 * math.sin(math.pi * fc / SR)
        low += f * band
        high = x - low - q * band
        band += f * high
        out[i] = low if mode == "lp" else (band if mode == "bp" else high)
    return out


# ------------------------------------------------------------------- effects


def echo(buf, delay=0.11, feedback=0.35, mix_level=0.3, damp=2600.0, tail=3):
    """
    SNES-style room: mono feedback delay, damped each pass so repeats darken.
    tail extends the buffer so the echo can finish speaking.
    """
    d = int(delay * SR)
    n = len(buf) + d * tail
    out = list(buf) + [0.0] * (d * tail)
    line = [0.0] * d
    pos = 0
    y = 0.0
    a = 1.0 - math.exp(-2.0 * math.pi * damp / SR)
    for i in range(n):
        dry = out[i]
        wet = line[pos]
        y += a * (wet - y)  # damping in the feedback path
        line[pos] = dry + y * feedback
        pos = (pos + 1) % d
        out[i] = dry + wet * mix_level
    return out


def crush(buf, bits=10, hold=2):
    """
    Subtle lo-fi grain: quantize to `bits` and sample-hold every `hold`
    samples. At 10 bits / hold 2 it reads as dust, not as Game Boy — this is
    the 'a little pixely' dial. Use sparingly, per-layer.
    """
    levels = float(1 << (bits - 1))
    out = [0.0] * len(buf)
    held = 0.0
    for i, x in enumerate(buf):
        if i % hold == 0:
            held = round(x * levels) / levels
        out[i] = held
    return out


def clip(buf, drive=1.0):
    """Soft saturation — glues layers, fattens transients."""
    return [math.tanh(x * drive) for x in buf]


# ------------------------------------------------------------------ assembly


def mix(*layers):
    n = max((len(x) for x in layers), default=0)
    out = [0.0] * n
    for layer in layers:
        for i, v in enumerate(layer):
            out[i] += v
    return out


def at(offset_s, buf):
    return [0.0] * int(offset_s * SR) + list(buf)


def seq(*chunks):
    out = []
    for c in chunks:
        out.extend(c)
    return out


def silence(dur):
    return [0.0] * int(dur * SR)


def gain(buf, vol):
    return [v * vol for v in buf]


def grains(count, spacing_s, make, gain_slope=1.0, spacing_jitter=0.0, seed=0):
    """
    A volley: `count` instances of make(i) laid out every spacing_s seconds.
    gain_slope < 1 decays successive grains; jitter humanizes the rhythm
    (seeded). The spray feel lives HERE, in the timing — not in longer noise.
    """
    rng = random.Random(seed)
    layers = []
    tpos = 0.0
    for i in range(count):
        layers.append(at(tpos, gain(make(i), gain_slope ** i)))
        step = spacing_s * (1.0 + (rng.random() * 2.0 - 1.0) * spacing_jitter)
        tpos += max(0.005, step)
    return mix(*layers)


# -------------------------------------------------------------------- output


def master(buf, peak=0.8, warmth=9500.0):
    """
    Final pass for every sound: gentle top-end rounding (the gaussian-
    interpolation warmth), then peak normalize to the category target.
    """
    out = lp1(buf, warmth)
    hi = max((abs(v) for v in out), default=1.0) or 1.0
    return [v * (peak / hi) for v in out]


def write_wav(path, buf):
    frames = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, v)) * 32767)) for v in buf
    )
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
