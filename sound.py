# python sound.py  ->  audio/track.wav, audio/cues.json
# Original 120 BPM music and UI sound effects, synthesized in code (seeded, deterministic).
import json, os, numpy as np, soundfile as sf

SR, DUR, BPM = 48000, 15.0, 120
BEAT = 60 / BPM
rng = np.random.default_rng(7)
N = int(SR * DUR)
mix = np.zeros((N, 2))

def place(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N: return
    sig = sig[: N - i] * gain
    mix[i : i + len(sig), 0] += sig * np.sqrt(0.5 * (1 - pan))
    mix[i : i + len(sig), 1] += sig * np.sqrt(0.5 * (1 + pan))

def tt(d): return np.arange(int(SR * d)) / SR

def kick(d=0.45):
    t = tt(d); f = 45 + 95 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)

def hat(d=0.06):
    n = rng.standard_normal(int(SR * d)); n = np.diff(n, prepend=0)
    return n * np.exp(-tt(d) * 70) * 0.25

def bass(freq, d):
    t = tt(d); ph = (freq * t) % 1.0
    saw = 2 * ph - 1; sub = np.sin(2 * np.pi * freq * t)
    env = np.minimum(1, t * 200) * np.exp(-t * 6)
    return (0.35 * saw + 0.8 * sub) * env

def pad(freqs, d):
    t = tt(d); env = np.minimum(1, t * 3) * np.minimum(1, (d - t) * 4)
    return sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.003 * f * t) for f in freqs) * env * 0.08

def lowpass(x, a):
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y

def whoosh(d=0.5):
    t = tt(d); n = rng.standard_normal(len(t))
    sweep = 0.02 + 0.25 * np.sin(np.pi * t / d) ** 2
    y = np.empty_like(n); acc = 0.0
    for i, v in enumerate(n): acc += sweep[i] * (v - acc); y[i] = acc
    return y * np.sin(np.pi * t / d) ** 2 * 1.4

def click(d=0.03):
    t = tt(d); return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 260) * 0.5

def pop(d=0.12):
    t = tt(d); f = 900 * np.exp(-t * 18) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.5

def thump(d=0.6):
    t = tt(d); f = 35 + 60 * np.exp(-t * 20)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 1.2

# Music: A minor, one chord per bar (2s). Am - F - C - G, then Am to close.
roots = [55.0, 43.65, 65.41, 49.0, 55.0, 43.65, 65.41, 55.0]
chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 261.6, 329.6], [196, 246.9, 293.7],
          [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 261.6, 329.6], [220, 261.6, 329.6]]
nbeats = int(DUR / BEAT)
for b in range(nbeats):
    t = b * BEAT
    if t < 14.5: place(kick(), t, 0.9)
    place(hat(), t + BEAT / 2, 0.6, pan=0.3)
for bar in range(8):
    t0 = bar * 2.0
    if t0 >= DUR: break
    place(pad(chords[bar], min(2.0, DUR - t0)), t0, 1.0)
    for e in range(4 if t0 < 14 else 1):
        place(bass(roots[bar], BEAT * 0.9), t0 + e * BEAT, 0.5)

# Sound effects, timed to the beat grid and the animation's transitions.
cues = []
def cue(kind, t, gain, pan=0.0):
    fx = {"whoosh": whoosh, "click": click, "pop": pop, "thump": thump}[kind]
    place(fx(), t, gain, pan); cues.append({"t": round(t, 3), "sfx": kind})

for t in (0.0, 0.5, 1.0): cue("thump", t, 0.7)                     # MO / TI / ON slam
for t in (1.4, 3.25, 5.4, 7.55, 11.3): cue("whoosh", t, 0.5, 0.2)  # shot transitions (peak on the cut)
for t in (2.0, 2.5, 3.0, 3.5): cue("click", t, 0.6, -0.3)          # grid wave steps
for t in (4.0, 4.25, 4.5): cue("pop", t, 0.5, 0.2)                  # marquee rows enter
for t in (6.0, 6.5, 7.0, 7.5): cue("click", t, 0.7)                 # shape morphs
cue("whoosh", 8.0, 0.4)                                             # line starts drawing
for i in range(4): cue("pop", 10.0 + i * 0.25, 0.6, (-1) ** i * 0.3)  # bands sweep in
cue("thump", 12.0, 0.8)                                             # circle lands
for i, t in enumerate((12.15, 12.2, 12.25, 12.3, 12.4, 12.45, 12.5, 12.55)): cue("click", t, 0.35, -0.4 + i * 0.1)
cue("whoosh", 13.25, 0.45); cue("thump", 13.75, 0.9)                # underline, 2026
for i in range(21): cue("click", 14.0 + i / 36, 0.15)               # mono line typing

mix /= np.max(np.abs(mix)) * 1.05
os.makedirs("audio", exist_ok=True)
sf.write("audio/track.wav", mix, SR)
json.dump(sorted(cues, key=lambda c: c["t"]), open("audio/cues.json", "w"), indent=1)
print(f"wrote audio/track.wav ({DUR}s) and {len(cues)} cues")
