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

## MATTER: the Higgsfield showcase (showcase/)

A 48 s film where one circle travels through six materials. Higgsfield paints the materials
(style frame → Kling image-to-video), code paints everything exact. Read `docs/system.md`,
`docs/reference_analysis.md` and `docs/matter_shotlist.md`; the repeatable procedure is the
`higgsfield-reel` skill in `.claude/skills/`.

```bash
node tools/plates.mjs fetch && node tools/plates.mjs frames     # plates/plates.json -> plates/<id>/%05d.jpg
node tools/sheet.mjs showcase/index.html 1920 1080 0 48 0.5 out/sheet.png 12   # critique loop
python3 showcase/sound.py                                       # audio/showcase_track.wav + cues
node render.mjs --page showcase/index.html --fps 30 --dur 48 --sub 4 --w 1920 --h 1080 --out out/matter_16x9_silent.mp4
node render.mjs --page "showcase/index.html?v=1" --fps 30 --dur 48 --sub 4 --w 1080 --h 1920 --out out/matter_9x16_silent.mp4
tools/finish_showcase.sh                                        # -14 LUFS mux + review sheets
```

| File | What it is |
|---|---|
| `showcase/lib.js` | Beat grid (120 BPM), springs, palette, condensed-caps type helpers |
| `showcase/fx.js` | Ordered dither, grain, chromatic aberration, scanlines, duotone, paper, thermal passes |
| `showcase/plates.js` | Frame-accurate plate playback (`drawPlate`) from JPEG sequences |
| `showcase/scenes_a.js`, `scenes_b.js` | INK, CLAY, FIRE / HEAT, PAINT, DESK |
| `showcase/sound.py` | The score and SFX cues on the same grid |
| `tools/plates.mjs` | Fetch Higgsfield clips, extract frames, write `plates/manifest.js` |
| `plates/plates.json` | Every paid job: id, model, prompt, cost, verdict (never pay twice) |

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
