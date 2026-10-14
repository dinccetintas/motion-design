# Shot list: 60s studio showreel

110 BPM. Beat n lands at t = (1 + 6n) / 11 s, so a beat falls exactly on 5, 17, 29, 41 and 53s
(beats 9, 31, 53, 75, 97). Each project is 22 beats; `b` below is the beat within the section
(0.545s each). Easing: **type** = critically damped spring (no overshoot); **UI** = spring with ~5%
overshoot and settle (follow-through); **heavy** = soft spring (k≈60) for big objects and camera.
Motion blur comes from 4 blended subframes per frame.

## OPEN 0–5s (studio: black / white / accent)
| t | Beat | Action | Easing |
|---|---|---|---|
| 0.09 | 0 | A single accent line draws left→right through frame centre | type |
| 1.18 | 2 | Line pivots 72° and extrudes into a white parallelogram: the studio mark | UI |
| 1.73 | 3 | Wordmark slides out from behind the mark (masked) | type |
| 2.82 | 5 | Tagline sets under it | type |
| 3.91 | 7 | Wordmark retracts; mark un-skews and rounds into a circle | UI |
| 4.45 | 8 | Circle turns Halcyon teal; navy iris grows from it to fill the frame | heavy |
**Handoff:** the circle → Halcyon's sun.

## PROJECT 1, HALCYON 5–17s (brand motion system)
| t | b | Action | Easing |
|---|---|---|---|
| 5.00 | 0 | Teal circle settles; horizon line draws through it | UI |
| 5.55–6.64 | 1–3 | Three wave lines draw under the horizon, one per beat: the logo | type |
| 7.18 | 4 | "Halcyon" rises letter by letter beside the mark | type |
| 8.27 | 6 | Descriptor "Brand motion system" | type |
| 8.82 | 7 | Unfold: logo moves left, its wave lines extend into type baselines | heavy |
| 9.36–10.45 | 8–10 | Type behaviour: "Money," "made" "calm." land on the baselines; weight 300→600 on stress | type |
| 11.55–13.18 | 12–15 | Colour transitions: four swatch panels wipe in on each beat with name + hex | UI |
| 13.73–15.09 | 16–18.5 | Icon set: six line icons draw on, one per half-beat, in a 3×2 grid | type |
| 15.36–15.91 | 19–20 | All icons pulse together on the beat (consistent rhythm) | UI |
| 16.45 | 21 | The card icon grows into a rounded panel and recolours graphite | UI |
**Handoff:** the card shape → Vector's app window.

## PROJECT 2, VECTOR 17–29s (product launch)
Dashboard is a live canvas texture on a 3D plane (real perspective).
| t | b | Action | Easing |
|---|---|---|---|
| 17.00 | 0 | Card is now the app window; slight 3D tilt | heavy |
| 17.55–19.73 | 1–5 | Sidebar, top bar, four KPI cards, chart, table assemble one per beat | UI |
| 20.27 | 6 | Cursor enters, glides to the "Live" toggle | UI |
| 20.82 | 7 | Click: toggle flips; KPIs count up; chart gains a point every beat | UI |
| 22.45 | 10 | Cursor moves to the "Pipeline" card | UI |
| 23.00 | 11 | Click: card expands into a detail view (breakdown bars + rows) | UI |
| 25.18 | 15 | Camera glides across the tilted interface (yaw −24°, pitch 14°, dolly) | heavy |
| 27.91 | 20 | Camera pushes into the chart's newest data point | heavy |
| 28.45 | 21 | Data point scales up and turns Meridian amber on ocean ink | UI |
**Handoff:** the data point → Meridian's origin port.

## PROJECT 3, MERIDIAN 29–41s (data story)
| t | b | Action | Easing |
|---|---|---|---|
| 29.00 | 0 | Port dot (Rotterdam); land dots scale up in a wave from it | type |
| 30.64–33.36 | 3–8 | Five routes draw to Singapore, Santos, Los Angeles, Dubai and Shanghai; ships travel | type |
| 33.36–34.45 | 8–10 | Map slides up; three stats roll in with odometer digits | type |
| 35.00 | 11 | Eight quarterly bars grow, one per half-beat | UI |
| 36.64 | 14 | Bars morph: bodies collapse into their top points; a line draws through them | UI |
| 38.27 | 17 | Last point lifts and expands into a full-frame amber field | heavy |
| 38.82 | 18 | Key stat lands full-screen: "38% faster" | type |
| 40.45 | 21 | Amber field irises down to a circle at centre | heavy |
**Handoff:** the amber circle → Aura's earbud, seen front-on.

## PROJECT 4, AURA 41–53s (product hero, 3D)
| t | b | Action | Easing |
|---|---|---|---|
| 41.00 | 0 | Circle turns pearl: it is the earbud seen front-on. Slow orbit starts | heavy |
| 42.09 | 2 | "Aura" + line set beside it | type |
| 45.36 | 8 | Exploded view: tip, mesh, driver, chip, battery, shell separate along the stem axis, one per beat | UI |
| 45.91–48.09 | 9–13 | Each part labels itself (leader line + name + spec) | type |
| 49.73 | 16 | Parts snap back together with overshoot and settle | UI |
| 51.91 | 20 | Earbud shrinks toward a grid cell | heavy |
**Handoff:** the earbud → a tile in the closing grid.

## CLOSE 53–60s (studio)
| t | b | Action | Easing |
|---|---|---|---|
| 53.00–55.18 | 0–4 | Twelve tiles from all four projects fly in from the edges into a 4×3 grid | UI |
| 55.73 | 5 | Grid collapses to centre and merges into the studio mark | heavy |
| 56.27 | 6 | Lockup: mark + name, tagline | type |
| 57.36 | 8 | Website + contact line | type |
| 58–60 | | Hold 2s | |
