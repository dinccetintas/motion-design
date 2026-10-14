# Flatbed — a motion design studio run by agents

Paste a link, an article or a topic. A crew of AI agents researches it, writes it, designs it,
composes the music and cuts a motion design film on the beat, then measures every frame before
you see it. Talk to the crew in plain language to revise the cut, edit anything by hand, and
render a broadcast-quality MP4.

Films are code, not generated pixels: every frame is a pure function of time (`film.seek(t)`),
type is set by a real type engine, music is composed for each cut, and the same engine runs the
in-browser preview and the final render. Text is always crisp, brand colors and screenshots are
exact, and a revision changes exactly what you asked.

## Run it

```bash
npm install                       # Playwright + the Anthropic SDK
export ANTHROPIC_API_KEY=sk-ant-… # the agent crew (without it: offline director)
npm start                         # http://localhost:4100
```

Needs Node 22+, ffmpeg, and a Chromium for Playwright (`npx playwright install chromium` if you
don't have one). Optional: `STUDIO_MODEL` (default `claude-opus-5-5`), `PORT` (default 4100).

- `/` — the landing page; the showreel plays live from the engine.
- `/studio` — the studio: the crew log and composer, live preview with sound, the rail
  (timeline), the inspector (scene copy, style, music, colors, review, takes, renders).

Without an API key the studio runs an **offline director**: the same pipeline with heuristic
agents. It works, but the films are far better with the real crew.

## The crew

| Agent | Does | How |
|---|---|---|
| Researcher | Reads the source | URLs are rendered in Chromium: screenshots, headings, copy, numbers in context, brand colors, fonts, logo. Topics use web search. |
| Writer | Finds the story | One core idea, a hook that lands in 2 s, copy short enough to read on the beat. Only true facts. |
| Art director | Picks the world | Style pack, palette (from brand colors), music mood, format. |
| Director | Cuts the film | A FilmSpec on the beat grid: scene types, copy, beats, grounds, transitions. |
| Composer | Scores it | Original music composed in code for the cut; every transition gets its hit; mastered to −14 LUFS. |
| Critic | Reviews it | Renders a contact sheet, measures every frame, scores six axes, sends the worst problems back. Revisions loop until every score is 8+. |

Each agent is a Claude call with adaptive thinking (its summarized thoughts stream into the crew
log), structured JSON output validated against the FilmSpec schema, and a server-side fallback on
refusals.

## The validation layer

`server/qa.js` scores every cut 1–10 on the studio's six axes (see `CLAUDE.md`) from measurements:

- **Hook** — content on frame 0, readable by 0.5 s, motion energy of the first 2 s vs the film.
- **Readability** — every word on every settled frame is probed: size at phone scale, WCAG
  contrast against the pixels behind it, overflow, overlap, safe areas, reading speed.
- **Motion** — longest static stretch, share of frames in motion, transition variety.
- **Variety** — scene type repetition, ground rhythm, a new event every 2–4 s, a closing lockup.
- **Brand** — name, URL, logo, screenshot and brand palette used.
- **Sync** — motion onsets against the beat grid; loudness and true peak of the render.

`scripts/beatcheck.py` and `scripts/tonal.py` validate the music itself (kick phase against the
grid, tempo, tonal balance per band).

## Make films from the command line

```bash
node scripts/qa.mjs films/black-holes.json --sheet out/sheet.png   # score + contact sheet
node scripts/sheet.mjs films/black-holes.json out/sheet.png --times scenes
node render.mjs films/black-holes.json out/black-holes.mp4 --fps 60 --sub 4
node scripts/showcase.mjs                                          # re-measure and publish the reel
npm test
```

## Files

| Path | What |
|---|---|
| `engine/` | The film engine: `film.js` (timeline, transitions, camera, grain), `gfx.js` (type fitting, probes), `kinetic.js` (kinetic type), `scenes/` (21 scene types), `styles.js` (10 style packs), `transitions.js`, `schema.js` (FilmSpec JSON schema), `audio/` (pure-JS DSP synth and arranger). |
| `server/` | `index.js` (HTTP + SSE), `agents/` (prompts, pipeline, offline director), `ingest.js`, `renderer.js` (parallel frame rendering, motion blur, ffmpeg, loudnorm), `qa.js` (the critic's measurements), `llm.js`. |
| `public/` | Landing (`index.html`), studio (`studio.html`), CSS, the player, rail and inspector, vendored fonts, published showcase films. |
| `films/` | Hand-directed film specs, including the showreel. |
| `CLAUDE.md` | House rules: render contract, banned looks, sound, the critique loop. |
| `PRODUCT.md`, `DESIGN.md` | Product truth and the Flatbed design system. |

## The render contract

Every film is a pure function of time. No CSS transitions, timers or carried state in render
mode; noise is seeded. Frames render in parallel workers, four subframes are blended per frame
for motion blur, and video is encoded H.264 yuv420p at CRF 16 with the score at −14 LUFS.

## Credits

The black-holes showcase film uses the image of M87* by the Event Horizon Telescope
Collaboration, licensed CC BY 4.0. Every other frame, font setting and sound is drawn or
synthesized by the engine.
