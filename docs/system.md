# The hybrid system: Higgsfield plates, code finish

A single prompt to a video model never produces showcase-grade motion design. The reference
reel (docs/reference_analysis.md) shows why: the pieces that impress are *materials* (ink, clay,
steel-wool fire, risograph ink, watercolour) finished with *precise graphic decisions* (type,
rhythm, match cuts, texture passes). Video models are good at the first and bad at the second:
they blur text, drift off the beat, and cannot hold a layout. Code is the opposite.

So the studio splits every film into two layers and owns the seam between them.

| Layer | Who draws it | Why |
|---|---|---|
| **Plates**: organic motion, materials, light, 3D-looking objects, painterly worlds | Higgsfield (`gpt_image_2_5` style frame → `kling3_0` image-to-video) | Models render matter better than code ever will |
| **Finish**: typography, numbers, UI, shapes, cuts, transitions, texture passes (dither, halftone, grain, chromatic aberration, scanlines, light trails) | `showcase/*.js` inside `window.seek(t)` | Exact, deterministic, on the beat |

## Pipeline

1. **Brief → medium map.** For each scene decide the *medium* (what the model paints) and the
   *finish* (what code adds). Write `docs/<film>_shotlist.md` on the beat grid first.
2. **Style frames.** One `gpt_image_2_5` still per scene (16:9, `quality: high`, `resolution: 2k`,
   ≈2.75 credits). The prompt describes material, light, palette and composition and ends with
   `no text, no letters, no logos, no watermark`: every glyph in the film comes from code.
   Preflight every prompt with `get_cost: true` (free); the preset recommender can bounce a long
   prompt, in which case resubmit with the `declined_preset_id` it returns.
3. **Motion.** `kling3_0`, `mode: pro`, `sound: off`, 5 s (7.5 credits) or 10 s (15). Pass the
   style frame as `start_image`; for a morph transition pass the next scene's frame as `end_image`
   so the model animates the match cut itself. One subject action + one camera move per prompt,
   a material lock ("the surface stays matte clay"), and the same no-text clause.
   Submit one canary per scene family, inspect it, then batch the rest (`generate_video_batch`).
4. **Plates on disk.** `plates/plates.json` lists every accepted clip (id, url, job, model, prompt,
   in/out trim). `node tools/plates.mjs fetch && node tools/plates.mjs frames` writes
   `plates/<id>/00001.jpg…` at the film fps. The page never uses `<video>`: it is not frame accurate.
5. **Film page.** `showcase/index.html` draws every frame from `t` alone (CLAUDE.md render
   contract). `showcase/plates.js` gives `drawPlate(ctx, id, localTime, x, y, w, h, {zoom, ax, ay})`.
   Finishes live in `showcase/fx.js` (dither, halftone, grain, chromatic aberration, scanlines,
   stepped frame rates) and are applied per scene at the reference's intensity.
6. **Sound.** `showcase/sound.py` synthesises the score on the same beat grid and emits
   `audio/showcase_cues.json`; hits land on cuts and type entrances. Mix to −14 LUFS.
7. **Critique loop.** `node tools/sheet.mjs showcase/index.html 1920 1080 0 48 0.5 out/sheet.png 8`,
   look, score (hook, phone readability, motion quality, variety, brand accuracy, sound sync),
   fix the worst three, repeat until every score is 8+. Only then `node render.mjs`.
8. **Deliver.** 16:9 and 9:16 (`?v=1`), contact sheet, poster, and a spend log in `plates/plates.json`.

## Budget rules (lite plan, 260 credits at the start of this project)

- Quote first: `get_cost: true` on every distinct request. Images 0.25–2.75, Kling 5 s 6.25–7.5,
  Seedance 720p 35 / 1080p 80 (reserve Seedance for shots that need audio-locked or multi-reference
  motion; it is 5–10× Kling).
- Canary one clip per family before batching. Reject by inspection (text artifacts, drift, wrong
  material), re-roll at most once per shot.
- Record every job id, cost and verdict in `plates/plates.json` so a re-run never pays twice.

## What the model is told and what it is not

- Told: material, light source, palette (hex names are fine), composition with the subject on a
  given third, the one action, the one camera move, duration feel ("slow"), and the lock
  ("the sphere keeps its exact silhouette").
- Not told: words to render, logos, UI, numbers, timing in seconds (prompt timecodes are hints the
  models ignore). Those are code.

## Editing

Edit decisions are an EDL in `showcase/edl.js`: one row per shot with `at` (film seconds), `plate`,
`in` (plate seconds), `dur`, `zoom/anchor` keys, and `finish` flags. Cuts sit on the beat grid;
holds and stills montages are allowed (stillness vs. action is a tool, see Tinariwen). Handoffs
between scenes are match cuts on a persistent shape, not dissolves.
