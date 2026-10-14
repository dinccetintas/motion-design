# python reel/sound.py  ->  audio/reel_track.wav, audio/reel_cues.json
# Original 110 BPM cinematic-electronic score for the 60s reel, synthesized in code (seeded).
# Beat n lands at (1 + 6n) / 11 s, the same grid the film uses (reel/lib.js).
import json, os
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve

SR, DUR = 48000, 60.0
BEAT = 6 / 11
N = int(SR * DUR)
rng = np.random.default_rng(110)
dry = np.zeros((N, 2)); wet = np.zeros((N, 2))
cues = []

def beat_t(n): return (1 + 6 * n) / 11
SEC = {"open": 0, "hal": 5, "vec": 17, "mer": 29, "aura": 41, "close": 53}
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

# ---------- harmony: D minor, i - VI - III - VII ----------
CHORDS = [(50, [62, 65, 69, 72]), (46, [58, 62, 65, 69]), (53, [60, 65, 69, 72]), (48, [60, 64, 67, 71])]
def chord_at(k): return CHORDS[k % 4]

def section(sec, beats, *, kick_pat=None, clap_on=False, hats=None, arp=None, pulse_bass=False, padcut=1800, padgain=0.5):
    t0 = SEC[sec]
    for bar in range((beats + 3) // 4):
        b0 = bar * 4; d = min(4, beats - b0) * BEAT
        root, tones = chord_at(bar)
        place(pad(tones, d + 0.4, padcut), t0 + b0 * BEAT, padgain, 0, 0.6)
        if pulse_bass:
            for e in range(int(d / (BEAT / 2))): place(sub(root - 12, BEAT / 2 * 0.9, True), t0 + b0 * BEAT + e * BEAT / 2, 0.55)
        else: place(sub(root - 12, d), t0 + b0 * BEAT, 0.5)
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

# OPEN: drone + mark hit.
place(pad([50, 57, 62, 69], 5.2, 900), beat_t(0), 0.55, 0, 0.7)
place(sub(38, 4.9), beat_t(0), 0.35)
cue(beat_t(0), "line", whoosh(1.1), 0.25, -0.4)
cue(beat_t(2), "mark-hit", boom(2.0), 0.55)
cue(beat_t(3), "wordmark", whoosh(0.5), 0.3, 0.4)
cue(beat_t(7), "morph", whoosh(0.6), 0.3)
place(riser(1.6), 5.0 - 1.6, 0.35, 0, 0.4)
# HALCYON: calm, half-time.
section("hal", 22, kick_pat=lambda b: b % 4 == 0 and b < 21, arp=1800, padcut=1500, padgain=0.45)
for i in range(4): cue(at("hal", i), "logo-band", tick(f=1400 + 200 * i), 0.5, -0.2, 0.4)
for i in range(3): cue(at("hal", 8 + i), "word", click(f=1600), 0.4, 0.2, 0.4)
for i in range(4): cue(at("hal", 12 + i), "swatch", whoosh(0.45), 0.35, (-1) ** i * 0.4)
for i in range(6): cue(at("hal", 16 + i * 0.5), "icon", tick(f=2000), 0.45, (i % 3 - 1) * 0.4, 0.3)
for b in (19, 20): cue(at("hal", b), "pulse", click(f=1200), 0.5)
place(riser(1.6), 17.0 - 1.6, 0.45, 0, 0.4)
# VECTOR: four on the floor.
section("vec", 22, kick_pat=lambda b: b < 21, clap_on=True, hats=8, arp=3200, pulse_bass=True, padgain=0.35)
for i, b in enumerate((1, 1.5, 2, 2.5, 3, 3.5, 4, 5)): cue(at("vec", b), "panel", tick(f=1500 + 120 * i), 0.4, 0.3, 0.2)
for b in (7, 11, 14): cue(at("vec", b), "cursor-click", click(), 0.7, 0.1, 0.2)
cue(at("vec", 15), "camera-glide", whoosh(1.4), 0.4, -0.3)
cue(at("vec", 20), "push-in", riser(1.0), 0.4)
# MERIDIAN: driving, 16th hats.
section("mer", 22, kick_pat=lambda b: b < 17, clap_on=True, hats=16, arp=2600, pulse_bass=True, padgain=0.35)
for i in range(5): cue(at("mer", 3 + i), "route", whoosh(0.7), 0.3, (-1) ** i * 0.5)
for i in range(3): cue(at("mer", 8 + i), "stat", tick(f=2200), 0.5)
for i in range(8): cue(at("mer", 11) + i * BEAT / 4, "bar", tick(f=900 + 110 * i), 0.35)
place(riser(1.6), at("mer", 18) - 1.6, 0.5, 0, 0.4)
cue(at("mer", 18), "key-stat", boom(3.0), 0.75)
cue(at("mer", 21), "iris", whoosh(0.6), 0.35)
# AURA: breakdown, air.
for bar in range(6):
    root, tones = chord_at(bar)
    place(pad([m + 12 for m in tones], 4 * BEAT + 0.4, 2400), at("aura", bar * 4), 0.4, 0, 0.8)
    place(sub(root - 12, 4 * BEAT), at("aura", bar * 4), 0.4)
cue(at("aura", 0), "aura-hit", boom(3.0), 0.5)
for i in range(6): cue(at("aura", 8 + i * 0.5), "part", shimmer(74 + [0, 3, 7, 10, 12, 15][i]), 0.6, (i % 2) * 0.6 - 0.3, 0.6)
cue(at("aura", 16), "snap", kick(0.3, 1.3), 0.6)
place(riser(2.0), 53.0 - 2.0, 0.5, 0, 0.4)
# CLOSE: full kit, collapse, final chord.
section("close", 6, kick_pat=lambda b: True, clap_on=True, hats=16, arp=3400, pulse_bass=True, padgain=0.35)
for i in range(11): cue(at("close", 0) + i * 0.11, "tile", tick(f=1300 + 90 * i), 0.3, (i % 4 - 1.5) * 0.3)
cue(at("close", 5), "collapse", whoosh(0.6), 0.5)
cue(at("close", 6), "lockup", boom(4.0), 0.8)
place(pad([50, 57, 62, 65, 69, 74], 60 - at("close", 6), 1600), at("close", 6), 0.55, 0, 0.9)
place(sub(38, 60 - at("close", 6) - 0.1), at("close", 6), 0.45)
cue(at("close", 8), "web", tick(f=2400), 0.4, 0.3)

# ---------- reverb + master ----------
ir_t = tt(2.6)
ir = np.stack([rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.4) for _ in range(2)], 1)
ir[:, 0] = lp(ir[:, 0], 6000); ir[:, 1] = lp(ir[:, 1], 6000)
rev = np.stack([fftconvolve(wet[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = dry + rev * (np.max(np.abs(dry)) / (np.max(np.abs(rev)) + 1e-9)) * 0.35
mix = np.tanh(1.2 * mix / np.max(np.abs(mix)))
fade = np.ones(N); fade[-int(SR * 0.6):] = np.linspace(1, 0, int(SR * 0.6))
mix *= fade[:, None]
mix /= np.max(np.abs(mix)) * 1.02
os.makedirs("audio", exist_ok=True)
sf.write("audio/reel_track.wav", mix, SR)
json.dump(sorted(cues, key=lambda c: c["t"]), open("audio/reel_cues.json", "w"), indent=1)
print(f"wrote audio/reel_track.wav, {len(cues)} cues")
