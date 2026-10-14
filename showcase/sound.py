# python showcase/sound.py  ->  audio/showcase_track.wav, audio/showcase_cues.json
# Original 120 BPM score for MATTER, synthesized in code (seeded). Beat n lands at n / 2 s,
# the same grid the film uses (showcase/lib.js). Instruments are shared with reel/sound.py.
import json, os
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve

SR, DUR = 48000, 48.0
BEAT = 0.5
N = int(SR * DUR)
rng = np.random.default_rng(120)
dry = np.zeros((N, 2)); wet = np.zeros((N, 2))
cues = []

SEC = {"ink": 0, "clay": 8, "fire": 16, "heat": 24, "paint": 32, "desk": 40}
def at(sec, b): return SEC[sec] + b * BEAT

def tt(d): return np.arange(int(SR * d)) / SR
def place(sig, t, gain=1.0, pan=0.0, send=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0: return
    s = sig[: N - i] * gain
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    dry[i:i + len(s), 0] += s * l; dry[i:i + len(s), 1] += s * r
    if send: wet[i:i + len(s), 0] += s * l * send; wet[i:i + len(s), 1] += s * r * send

def lp(x, cutoff):  # two-pole lowpass via cascaded one-poles (vectorised with lfilter)
    from scipy.signal import lfilter
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([a], [1, a - 1], lfilter([a], [1, a - 1], x))
def hp(x, cutoff): return x - lp(x, cutoff)
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def saw(f, t): return 2 * ((f * t) % 1.0) - 1

# ---------- instruments ----------
def kick(d=0.5, punch=1.0):
    t = tt(d); f = 42 + 120 * np.exp(-t * 30)
    return np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5) * punch)
def clap(d=0.25):
    t = tt(d); n = hp(rng.standard_normal(len(t)), 900)
    env = np.exp(-t * 22) * (1 + 0.6 * np.exp(-((t - 0.012) ** 2) / 1e-5))
    return n * env * 0.5
def hat(d=0.05, open_=False):
    t = tt(0.22 if open_ else d); n = hp(rng.standard_normal(len(t)), 7000)
    return n * np.exp(-t * (14 if open_ else 80)) * 0.35
def pad(midis, d, cutoff=1800):
    t = tt(d); x = np.zeros(len(t))
    for m in midis:
        f = mtof(m)
        for det in (-0.12, 0.0, 0.11): x += saw(f * 2 ** (det / 12), t + rng.random())
    x = lp(x, cutoff) / (3 * len(midis))
    env = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.5)
    return x * env
def pluck(m, d=0.3, bright=2600):
    t = tt(d); x = saw(mtof(m), t) + 0.5 * saw(mtof(m) * 2.003, t)
    return lp(x, bright) * np.exp(-t * 9) * 0.5
def sub(m, d, pulse=False):
    t = tt(d); x = np.sin(2 * np.pi * mtof(m) * t) + 0.25 * np.tanh(3 * np.sin(2 * np.pi * mtof(m) * t))
    env = np.minimum(1, t / 0.01) * (np.exp(-t * 5) if pulse else np.minimum(1, (d - t) / 0.08))
    return x * env * 0.8
def boom(d=3.0):
    t = tt(d); f = 30 + 70 * np.exp(-t * 8)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    n = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 9) * 0.8
    return np.tanh(1.4 * (body + n))
def riser(d=1.6):
    t = tt(d); n = rng.standard_normal(len(t))
    sweep = np.linspace(400, 9000, len(t)) ** 1.0
    a = 1 - np.exp(-2 * np.pi * sweep / SR)
    y = np.empty_like(n); acc = 0.0
    for i, v in enumerate(n): acc += a[i] * (v - acc); y[i] = acc
    return y * (t / d) ** 2 * 0.9
def whoosh(d=0.8):
    t = tt(d); n = rng.standard_normal(len(t))
    a = 0.02 + 0.3 * np.sin(np.pi * t / d) ** 2
    y = np.empty_like(n); acc = 0.0
    for i, v in enumerate(n): acc += a[i] * (v - acc); y[i] = acc
    return y * np.sin(np.pi * t / d) ** 2 * 1.2
def click(d=0.04, f=2600):
    t = tt(d); return np.sin(2 * np.pi * f * t) * np.exp(-t * 220) * 0.6
def tick(d=0.06, f=1800):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.7 * t)) * np.exp(-t * 90) * 0.4
def shimmer(m, d=1.2):
    t = tt(d); x = sum(np.sin(2 * np.pi * mtof(m + o) * t) * g for o, g in ((0, 1), (12, 0.5), (19, 0.3)))
    return x * np.exp(-t * 3) * np.minimum(1, t / 0.005) * 0.25


def cue(t, kind, sig, gain, pan=0.0, send=0.3):
    place(sig, t, gain, pan, send); cues.append({"t": round(t, 3), "sfx": kind})

def room(d, cutoff=600):
    t = tt(d); n = lp(rng.standard_normal(len(t)), cutoff)
    env = np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 0.8)
    return n * env * 0.12
def rim(d=0.12, f=640):
    t = tt(d); x = np.sin(2 * np.pi * f * t) * np.exp(-t * 60) + 0.3 * hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 120)
    return x * 0.5
def paper(d=0.35):
    t = tt(d); n = hp(lp(rng.standard_normal(len(t)), 5000), 1200)
    return n * np.sin(np.pi * t / d) ** 1.5 * 0.5

# ---------- harmony: D minor, i - VI - III - VII ----------
CHORDS = [(50, [62, 65, 69, 72]), (46, [58, 62, 65, 69]), (53, [60, 65, 69, 72]), (48, [60, 64, 67, 71])]
def chord_at(k): return CHORDS[k % 4]

def section(sec, beats, *, kick_pat=None, clap_on=False, hats=None, arp=None, pulse_bass=False, padcut=1800, padgain=0.5, bass=True):
    t0 = SEC[sec]
    for bar in range((beats + 3) // 4):
        b0 = bar * 4; d = min(4, beats - b0) * BEAT
        root, tones = chord_at(bar)
        place(pad(tones, d + 0.4, padcut), t0 + b0 * BEAT, padgain, 0, 0.6)
        if bass and pulse_bass:
            for e in range(int(d / (BEAT / 2))): place(sub(root - 12, BEAT / 2 * 0.9, True), t0 + b0 * BEAT + e * BEAT / 2, 0.55)
        elif bass: place(sub(root - 12, d), t0 + b0 * BEAT, 0.5)
        if arp:
            seq = [tones[i] + 12 for i in (0, 1, 2, 3, 2, 1, 0, 2)]
            for s in range(int(d / (BEAT / 4))):
                place(pluck(seq[s % 8], 0.3, arp), t0 + b0 * BEAT + s * BEAT / 4, 0.16, 0.35 * (-1) ** s, 0.35)
    for b in range(beats):
        tb = t0 + b * BEAT
        if kick_pat and kick_pat(b): place(kick(), tb, 0.95)
        if clap_on and b % 2 == 1: place(clap(), tb, 0.5, 0.05, 0.4)
        if hats == 8: place(hat(), tb + BEAT / 2, 0.55, 0.3)
        if hats == 16:
            for s in range(4): place(hat(open_=(s == 2)), tb + s * BEAT / 4, 0.4 if s % 2 else 0.25, 0.3)

# INK: a clock ticks, the ink hits, the title lands.
place(pad([50, 57, 62], 8.4, 700), 0, 0.4, 0, 0.8)
place(sub(38, 7.8), 0, 0.3)
cue(0.1, "dot", tick(f=2600), 0.5)
for b in range(1, 12): cue(at("ink", b), "tick", tick(f=1800 if b % 2 else 1300), 0.45, (-1) ** b * 0.25, 0.3)
for i in range(6): cue(at("ink", 4) + i * 0.08, "strobe", click(f=3000 - 200 * i), 0.55, (i % 2) * 0.8 - 0.4, 0.2)
cue(at("ink", 8), "flash", boom(2.2), 0.7)
for i in range(6): cue(at("ink", 8) + 0.04 * i, "letter", click(f=1400 + 100 * i), 0.25, (i - 2.5) * 0.25, 0.3)
cue(at("ink", 12), "card", whoosh(0.4), 0.45, -0.4)
cue(at("ink", 15), "iris", whoosh(0.5), 0.4)
place(riser(1.5), 8.0 - 1.5, 0.3, 0, 0.4)
# CLAY: wooden rim on twos, soft pad, stamps.
section("clay", 16, kick_pat=lambda b: b % 4 == 0, padcut=1400, padgain=0.4)
for b in range(16):
    for s in (0, 0.5): place(rim(f=640 if s == 0 else 880), at("clay", b) + s * BEAT, 0.35 if s else 0.5, 0.3 - 0.6 * s, 0.25)
for b in (2, 4, 6): cue(at("clay", b), "patch-flip", click(f=900), 0.5, 0.2)
cue(at("clay", 2), "label", tick(f=2000), 0.45)
cue(at("clay", 6), "macro-cut", whoosh(0.5), 0.45)
for i in range(3): cue(at("clay", 10 + 2 * i), "stamp", kick(0.35, 1.2), 0.7, (i - 1) * 0.3)
cue(at("clay", 14), "darken", boom(2.0), 0.45)
place(riser(1.6), 16.0 - 1.6, 0.45, 0, 0.4)
# FIRE: four on the floor, 16th hats, streak whooshes.
section("fire", 15, kick_pat=lambda b: True, clap_on=True, hats=16, arp=3000, pulse_bass=True, padgain=0.35)
for b in range(16): cue(at("fire", b), "streak", whoosh(0.35), 0.28, 0.5 - (b % 3) * 0.5, 0.3)
for i in range(8): cue(at("fire", 4) + i * 0.25, "burst-cut", click(f=2200), 0.45, (i % 2) * 0.8 - 0.4, 0.2)
for b in range(8, 14): cue(at("fire", b), "counter", tick(f=1500), 0.35, 0.5)
cue(at("fire", 12), "label", tick(f=2000), 0.4)
place(riser(1.2), at("fire", 15) - 1.0, 0.5, 0, 0.4)
cue(at("fire", 15), "bloom", boom(2.5), 0.8)
# HEAT: driving, readouts, slivers.
section("heat", 15, kick_pat=lambda b: b < 12, clap_on=True, hats=8, arp=2400, pulse_bass=True, padgain=0.3)
for b in range(1, 8): cue(at("heat", b), "readout", tick(f=2400), 0.3, 0.4, 0.2)
cue(at("heat", 4), "scribble", click(f=3400), 0.5, -0.3)
cue(at("heat", 6), "snap-off", click(f=800), 0.5)
for i in range(3): cue(at("heat", 8) + i * 0.12, "sliver", whoosh(0.4), 0.45, (i - 1) * 0.6)
cue(at("heat", 12), "card", whoosh(0.5), 0.5)
cue(at("heat", 14), "card-out", whoosh(0.5), 0.4)
cue(at("heat", 15), "to-sun", shimmer(74, 1.6), 0.6, 0, 0.7)
# PAINT: bright pad, bell on the sun, quotes land.
for bar in range(4):
    root, tones = chord_at(bar)
    place(pad([m + 12 for m in tones], 4 * BEAT + 0.4, 2600), at("paint", bar * 4), 0.42, 0, 0.8)
    place(sub(root - 12, 4 * BEAT), at("paint", bar * 4), 0.4)
cue(at("paint", 0), "sun", shimmer(86, 2.0), 0.6, 0.3, 0.8)
for i in range(4): cue(at("paint", 2) + i * 0.25, "hue", click(f=1200 + 300 * i), 0.5, (i % 2) * 0.8 - 0.4, 0.3)
cue(at("paint", 4), "full-colour", whoosh(0.5), 0.4)
cue(at("paint", 6), "quote-1", boom(2.0), 0.6)
cue(at("paint", 10), "quote-2", boom(2.0), 0.6)
cue(at("paint", 12), "sky-cut", whoosh(0.6), 0.45, 0.4)
cue(at("paint", 15), "shrink", whoosh(0.8), 0.5)
# DESK: room tone, paper slides, lockup chord.
place(room(8.4), SEC["desk"] - 0.2, 1.0, 0, 0.2)
cue(at("desk", 0), "land", kick(0.3, 0.8), 0.5)
cue(at("desk", 0) + 0.05, "paper", paper(), 0.5)
for i in range(5): cue(at("desk", 2 + i), "deal", paper(0.3), 0.5, (i - 2) * 0.3, 0.2)
cue(at("desk", 8), "lockup", boom(3.0), 0.7)
place(pad([50, 57, 62, 65, 69, 74], 48 - at("desk", 8), 1600), at("desk", 8), 0.5, 0, 0.9)
place(sub(38, 48 - at("desk", 8) - 0.1), at("desk", 8), 0.4)
cue(at("desk", 9), "line", tick(f=2400), 0.35, 0.2)
cue(at("desk", 10), "dot", tick(f=3000), 0.35)

# ---------- reverb + master ----------
ir_t = tt(2.6)
ir = np.stack([rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.4) for _ in range(2)], 1)
ir[:, 0] = lp(ir[:, 0], 6000); ir[:, 1] = lp(ir[:, 1], 6000)
rev = np.stack([fftconvolve(wet[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = dry + rev * (np.max(np.abs(dry)) / (np.max(np.abs(rev)) + 1e-9)) * 0.35
mix = np.tanh(1.2 * mix / np.max(np.abs(mix)))
fade = np.ones(N); fade[-int(SR * 0.8):] = np.linspace(1, 0, int(SR * 0.8))
mix *= fade[:, None]
mix /= np.max(np.abs(mix)) * 1.02
os.makedirs("audio", exist_ok=True)
sf.write("audio/showcase_track.wav", mix, SR)
json.dump(sorted(cues, key=lambda c: c["t"]), open("audio/showcase_cues.json", "w"), indent=1)
print(f"wrote audio/showcase_track.wav, {len(cues)} cues")
