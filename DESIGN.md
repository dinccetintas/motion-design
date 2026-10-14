# Flatbed design system

Flatbed is a film cutting bench pressed flat into a page. The interface is the bench and the
films are the light. Every visual choice comes from that one object: black ink, a grain-orange
rail with sprocket holes, white mats that frames sit in, and marks made with a grease pencil.

Tokens and components live in `public/css/flatbed.css`. The landing page adds
`public/css/landing.css` and the studio adds `public/css/studio.css`. The landing page's direction
contract is in `.impeccable/surfaces/public-index-html.md`.

## Color

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0A0A0A` | Page ground, the bench. Never pure `#000`. |
| `--char`, `--char-2` | `#131313`, `#1A1A1A` | Panels and fields one step off the ground. |
| `--spool`, `--rule` | `#2A2A2A`, `#3A3A3A` | Dividers and resting borders. |
| `--white` | `#F4F1EA` | Text on ink, and the punched-white mats. |
| `--dim` | `#A7A196` | Secondary text. Stays at 4.5:1 or better on ink. |
| `--orange` | `#FF5A1F` | The one accent: the rail, the primary action, the playhead. |
| `--on-orange` | `#0A0A0A` | Text on orange. Orange never carries white text. |

There is one accent. Orange marks what is live or what you act on. It is never used for decoration.
Films bring their own palettes, and the chrome around them stays neutral so they read true.

## Type

- **Big Shoulders Display** at 800, in caps (`.cond`, `.label`): headlines, labels, tab buttons.
  Condensed, so long scene names and big headlines fit the rail.
- **Archivo** at a 92% stretch: everything you read.
- **JetBrains Mono**: only timecode, beats, scores and measurements, always with tabular figures.

There is one display face and one text face. Mono is a measuring tool and is never used for voice.

## Materials

- **Grain orange** (`.grain-orange`): orange with SVG turbulence grain multiplied on top. Used for
  the rail and the closing band.
- **Perforation** (`.perf-row`): one sprocket hole tiled along a rail edge.
- **Punched white** (`.punched`): an off-white mat for frames, crew cards and the measurement
  sheet.

## Components

- **Tab** (`.tab`): the only button. It is perforated, with sprocket dots at both edges. Variants:
  `.solid` (orange, the primary action) and `.ghost` (rule line). `.small` is used for chips.
  Pressing it scales to 0.97 over 160ms with a custom ease-out.
- **Field** (`.field`): char ground with a rule border that turns orange on focus. No glow.
- **Marks**: state is a mark, not a hue.
  - Tape flag (`.flag`): the playhead.
  - Grease cross (`.cross`): approved by the critic.
  - Pin (`.pin`): an earlier version or take.
  - Orange corner tab: flagged by the critic.

  The critic's marks sit on a frame's label strip and never cover the picture.
- **Rail** (studio): scenes are cells whose width is proportional to their beats, strung on a
  perforated orange strip with a numbered bar ruler. Each cell is painted as a strip of real frames
  at the film's aspect, sampled across the scene. Scrubbing moves freely and settles on the beat
  grid when released.

## Motion

The rules follow Emil Kowalski's:
- UI motion is short (120-240ms) and uses custom curves (`--ease-out`, `--ease-in-out`).
- Keyboard actions never animate.
- `:active` gets a 0.97 press.
- Hover effects only apply on fine pointers.
- `prefers-reduced-motion` collapses every animation.

Films follow the render contract in `CLAUDE.md`: frame t is a pure function of t, painted by
`film.seek(t)`.

## Banned

The following are banned: a centered title on a gradient, everything fading in, glow on UI,
corner labels and frame borders inside films, generic particle bursts, and side-stripe accent
borders. When something needs emphasis, it gets a mark or the accent, not a new color.
