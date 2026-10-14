---
name: higgsfield-reel
description: Make a showcase-grade motion design film by generating material plates with Higgsfield
  (style frame → image-to-video) and finishing typography, cuts, transitions and texture passes in
  code. Use when the user wants a reel, launch film, manifesto or spec ad that must look like
  top-tier motion design, not a single AI-generated clip.
---

# Higgsfield reel

Read docs/system.md (the pipeline), docs/reference_analysis.md (the rules distilled from the best
work of 2026) and docs/matter_shotlist.md (a worked example) before starting.

## Steps
1. **Concept and medium map.** One committed material per section, a persistent device that
   carries the cut, two speeds (long holds vs stroboscopic runs), hard colour commitment, sparse
   exact type. Write `docs/<film>_shotlist.md` on a beat grid (BPM, beat = 60/BPM s).
2. **Quote before paying.** `balance`, then `get_cost: true` on one prompt per model. Budget:
   style frames `gpt_image_2_5` high/2k ≈ 2.75 cr; `kling3_0` pro 5 s ≈ 7.5 cr, 10 s ≈ 15 cr;
   Seedance 720p/1080p ≈ 35/80 cr (only when audio-locked or multi-reference motion is needed).
3. **Style frames** with `generate_image_batch`: material, light, palette (hex), composition,
   one subject, and always `no text, no letters, no logos, no watermark`. Inspect every frame.
   Rate-limited items (429) are resubmitted after the first batch finishes.
4. **Canary, then batch.** One `kling3_0` i2v per family (`start_image` = style-frame job id,
   `sound: off`), inspect its contact sheet, then `generate_video_batch` for the rest. If the
   preset recommender bounces a prompt, resubmit with the `declined_preset_id` it returns. A
   safety flag (`nsfw`) on a harmless subject means re-word the subject unambiguously (fully
   clothed athlete instead of a dancer in a leotard) and generate a fresh still.
5. **Plates to disk.** Add each accepted clip to `plates/plates.json` (id, url, job, cost,
   verdict), then `node tools/plates.mjs fetch && node tools/plates.mjs frames`.
6. **Film page.** `showcase/` pattern: `lib.js` (grid, springs, type), `fx.js` (dither, grain,
   aberration, scanlines, duotone, paper, thermal), `plates.js` (`drawPlate`), `scenes_*.js`,
   `main.js`. Pure function of `t`; no video elements; handoffs are match cuts on a shape whose
   screen position you measured in the plate.
7. **Sound.** `showcase/sound.py` on the same grid; cues on cuts and type entrances; −14 LUFS.
8. **Critique loop.** `node tools/sheet.mjs showcase/index.html 1920 1080 0 48 0.5 out/sheet.png 12`,
   look, score the six criteria, fix the three worst, repeat until all 8+.
9. **Render and finish.** `node render.mjs --page showcase/index.html --fps 30 --dur 48 --sub 4
   --w 1920 --h 1080 --out out/matter_16x9_silent.mp4`, then `tools/finish_showcase.sh`.

## Hard rules
- Never ask a model to render words, numbers, UI or logos. Models blur text and drift off the beat.
- Never pay twice: every job id and cost goes in `plates/plates.json` before the next call.
- Never use `<video>` in the page; frames come from `plates/<id>/%05d.jpg`.
- CLAUDE.md render contract and banned looks apply.
