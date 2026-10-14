# MATTER — 48 s studio showcase, 1920×1080 (and 1080×1920), 30 fps

One circle travels through six materials. Each material is a Higgsfield plate; everything that
has to be exact (type, cards, counters, cuts, texture passes) is code. 120 BPM: beat = 0.5 s,
sections are 16 beats (8 s). Chapter cards are flat colour, condensed caps, numbered (Riso /
OpenTable). Rules from docs/reference_analysis.md apply: one material per section, a persistent
device, two speeds, hard colour commitment, sparse exact type, texture at reference intensity.

Fonts: Barlow Condensed 800 (display), Space Grotesk 500 (UI/labels). Accent per section only.

## 01 INK 0–8 s (white, black; finish = 1-bit ordered dither, radial speed lines, white flashes)
| t | beat | Action |
|---|---|---|
| 0.0 | 0 | Black frame. A single dot (the circle) at centre. |
| 0.5 | 1 | Hard cut to `ink_bloom` plate, full frame, dithered to 1 bit. The drop *is* the dot. |
| 0.5–4.0 | 1–8 | Ink spreads; every beat the dither cell size halves (coarse → fine). |
| 2.0 | 4 | Strobe run: 6 inserts of `ink_macro` at 0.08 s each, radial speed lines. |
| 4.0 | 8 | White flash (1 frame). "MATTER" in condensed caps, letters masked by the ink alpha: the ink reveals the word. |
| 6.0 | 12 | Chapter card: flat white, "01 — INK" top-left, small caps "every frame drawn by a material" bottom. |
| 7.5 | 15 | Card irises to a black dot at centre. Handoff → the dot is the clay sphere. |

## 02 CLAY 8–16 s (cobalt #0B3FA6, clay #C8643C; finish = stepped on twos, patch frame, paper grain)
| 8.0 | 0 | `clay_hands` plate inside a rounded "patch" card with a stitched edge (Moncler device); the patch background colour flips every 2 beats (cobalt → sand → coral → cobalt). Plate is held on twos (15 fps). |
| 9.0 | 2 | Label "02 — CLAY" and a hairline ruler with tick marks that counts mm as the sphere is rolled. |
| 11.0 | 6 | Patch scales up to full frame; cut to `clay_macro` (fingerprints) on the downbeat. |
| 13.0 | 10 | Three word cards stamp in one per beat on the clay: "PRESS" "ROLL" "HOLD" (condensed caps, slight wobble = line boil from seeded noise). |
| 15.0 | 14 | Sphere silhouette darkens to a black disc; background drops to midnight blue. Handoff → the ember. |

## 03 FIRE 16–24 s (midnight #0A1A3A, amber #FFB347; finish = additive light streaks, 2 cuts/s, big numerals)
| 16.0 | 0 | `fire_wool` plate. Sparks orbit the dark sphere. |
| 16.0–20.0 | 0–8 | Code light streaks: horizontal amber lines fired on every beat, leaving trails (NOMINT). |
| 18.0 | 4 | Cut burst: alternate `fire_wool` / `fire_skier` every half beat for 2 s (2 cuts/s). |
| 20.0 | 8 | Huge numeral counter "0001 → 0240" (frames lit by fire) in condensed caps, right third, odometer roll; chromatic aberration pass. |
| 22.0 | 12 | Chapter label "03 — FIRE". |
| 23.5 | 15 | The sphere's hot core blooms white and fills the frame. Handoff → thermal white-hot. |

## 04 HEAT 24–32 s (thermal palette: white, yellow, magenta, blue; finish = HUD mono labels, scribble lines, scanlines)
| 24.0 | 0 | `thermal_dancer` plate; CRT scanline + slight barrel pass. |
| 24.5 | 1 | HUD: tiny mono labels in corners replaced by *in-world* readouts: a crosshair on the hottest pixel with "41.6°" that updates every beat (Nike FD). |
| 26.0 | 4 | Magenta scribble lines (seeded) trace the dancer's limbs for two beats, then snap off. |
| 28.0 | 8 | Cut to `thermal_hands`; the sphere is the hottest point. Format play: the frame splits into three 9:16 slivers showing three moments of the plate (Turner). |
| 30.0 | 12 | Chapter label "04 — HEAT" on a lime card that clashes with magenta on purpose. |
| 31.5 | 15 | The white-hot sphere desaturates to a gold disc. Handoff → the sun. |

## 05 PAINT 32–40 s (purple #4A2A6A, orange #F07A2A, gold #F5C04A; finish = paper grain, one-hue remaps, pull-quote caps)
| 32.0 | 0 | `paint_city` plate, the sun is the disc; slow push in. Paper grain overlay. |
| 33.0 | 2 | Stills montage, one hue per shot (Tinariwen): the same plate remapped to magenta, green, red, blue, 0.25 s each, then back to full colour on the downbeat. |
| 35.0 | 6 | Pull quote in display caps over the sky (Arco): "MADE BY HAND." then at beat 10 "FINISHED IN CODE." |
| 38.0 | 12 | Cut to `paint_sky`; the sun disc holds its exact screen position across the cut. |
| 39.5 | 15 | The frame shrinks into a polaroid (Rimowa). Handoff → the polaroid falls onto the desk. |

## 06 DESK 40–48 s (the desk plate; finish = the film inside a polaroid, drop shadow, lockup)
| 40.0 | 0 | `desk` plate. The polaroid lands on the paper with a soft bounce and shadow; inside it the film keeps playing (a tiny loop of INK). Process is content (Dealies' zoom-out). |
| 41.0 | 2 | Five more polaroids, one per material, deal onto the desk on each beat, fanned. |
| 44.0 | 8 | Lockup stamped on the paper in condensed caps: "MATTER" / "six materials · one line" / studio mark. |
| 46.0 | 12 | Hold. Dust motes drift in the window light (seeded). |
| 48.0 | | End. |

## Sound (showcase/sound.py)
120 BPM. Kick on every beat in FIRE and HEAT only; INK is a ticking clock and ink-splash hits on the
strobe; CLAY is a soft wooden rim pattern on twos; PAINT is a sustained pad with a bell on the sun;
DESK is room tone, paper slides on each polaroid. Hits on every cut and card. −14 LUFS.
