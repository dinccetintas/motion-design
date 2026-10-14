# python3 scripts/beatcheck.py out/x.wav <bpm>
# Validates the music against the film's beat grid.
#  - tempo: librosa tempo estimate vs the target bpm
#  - kick phase: the rising edge of sub-120 Hz energy, folded modulo one beat. Its peak says
#    where kicks physically land relative to the grid (should be within ~0-30 ms after it).
import sys, json, numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfiltfilt
y, sr = sf.read(sys.argv[1]); y = y.mean(1) if y.ndim > 1 else y
bpm = float(sys.argv[2]); beat = 60 / bpm
lo = sosfiltfilt(butter(4, 150, 'lp', fs=sr, output='sos'), y)  # zero-phase: no filter delay
k = int(sr * 0.002); env = np.convolve(np.abs(lo), np.ones(k) / k, mode='same')
rise = np.maximum(np.diff(env, prepend=env[0]), 0)
n = int(round(beat * sr)); seg = len(rise) // n
fold = rise[:seg * n].reshape(seg, n).sum(0)
peak_ms = np.argmax(fold) / sr * 1000
if peak_ms > beat * 500: peak_ms -= beat * 1000
peakiness = float(fold.max() / (fold.mean() + 1e-12))
yr = librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=22050)
tempo = float(librosa.feature.tempo(y=yr, sr=22050, start_bpm=bpm)[0])
# Accept half/double time readings (trap, cinematic) as the same grid.
ratio = min(abs(tempo - bpm), abs(tempo * 2 - bpm), abs(tempo / 2 - bpm)) / bpm
print(json.dumps({"target_bpm": bpm, "tempo": round(tempo, 2), "kick_phase_ms": round(float(peak_ms), 1),
  "peakiness": round(peakiness, 1), "aligned": bool(-10 <= peak_ms <= 40 and ratio < 0.03)}))
