# Motion studio

Launch videos, product ads and showreels rendered from code. Every film is a page
(`index.html`) whose `window.seek(t)` paints the exact frame for time `t`. A headless
browser steps through time, screenshots each frame, and ffmpeg encodes the MP4.

## Setup

```bash
# Node, ffmpeg, Python (macOS: brew install node ffmpeg python)
pip install numpy librosa soundfile
npm install                     # playwright
npx playwright install chromium # skip if a matching Chromium is already installed

# Optional: framework skills
npx skills add remotion-dev/skills
npx skills add heygen-com/hyperframes

claude --model claude-opus-5-5  # then /model → effort: xhigh for new videos, max for big launches
```

## Files

| File | What it is |
|---|---|
| `CLAUDE.md` | House rules: render contract, banned looks, sound, the critique loop |
| `render.mjs` | Renderer: `node render.mjs --fps 60 --dur 15 --sub 4` → `out/silent.mp4` (4 blended subframes = motion blur) |
| `lib/motion.js` | Closed-form `spring()` and stacked-spring `track()` |
| `beats.py` | `python beats.py song.wav > beats.json` (bpm, beats, downbeats, hits) |
| `sound.py` | Synthesized 120 BPM music + UI sound effects → `audio/track.wav`, `audio/cues.json` |
| `index.html` | The current film: the 15-second showreel used to test the setup |
| `.claude/skills/motion-reel/SKILL.md` | `/motion-reel for [URL], 20s, vertical, reference ./refs/frame.png` |

API keys (e.g. `ELEVENLABS_API_KEY`) go in `.env`, never in a prompt.

## Showreel pipeline

```bash
node render.mjs --fps 60 --dur 15 --sub 4
python sound.py && python beats.py audio/track.wav > beats.json
ffmpeg -i audio/track.wav -af loudnorm=I=-14:TP=-1:LRA=11 -ar 48000 audio/track_14lufs.wav
ffmpeg -i out/silent.mp4 -i audio/track_14lufs.wav -c:v copy -c:a aac -b:a 192k -shortest out/final.mp4

# Review frames
ffmpeg -i out/final.mp4 -vf "fps=2,scale=270:-1,tile=6x5" -frames:v 1 out/contact.png
ffmpeg -ss 4.1 -i out/final.mp4 -vf "scale=320:-1,tile=12x1" -frames:v 1 out/strip.png
ffmpeg -i out/final.mp4 -vf "fps=1,scale=360:-1,tile=5x3" -frames:v 1 out/phone.png
ffmpeg -stream_loop 1 -i out/final.mp4 -c copy out/loop_check.mp4
```
