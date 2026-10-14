# python3 scripts/tonal.py out/x.wav  -> energy per band in dB relative to the loudest band
# Rough modern-mix reference (pink-ish tilt): sub -6, bass 0, lowmid -4, mid -9, presence -14, air -20 (+-5).
import sys, json, numpy as np, soundfile as sf
y, sr = sf.read(sys.argv[1]); y = y.mean(1) if y.ndim > 1 else y
S = np.abs(np.fft.rfft(y * np.hanning(len(y)))) ** 2; f = np.fft.rfftfreq(len(y), 1 / sr)
bands = {"sub": (20, 60), "bass": (60, 250), "lowmid": (250, 1000), "mid": (1000, 4000), "presence": (4000, 8000), "air": (8000, 16000)}
ref = {"sub": -6, "bass": 0, "lowmid": -4, "mid": -9, "presence": -14, "air": -20}
e = {k: 10 * np.log10(S[(f >= a) & (f < b)].sum() + 1e-12) for k, (a, b) in bands.items()}
top = e["bass"]
rel = {k: round(v - top, 1) for k, v in e.items()}
dev = {k: round(rel[k] - ref[k], 1) for k in rel}
print(json.dumps({"rel_db": rel, "deviation": dev, "balanced": all(abs(d) <= 6 for d in dev.values())}))
