# Product

<!-- impeccable:product-schema 1 -->

> Written from the owner's brief. The owner asked not to be interviewed ("don't ask me questions, choose the best answers"); facts marked *(inferred)* are decisions taken on their behalf.

## Platform

web

## Stack

Delegated: plain HTML, CSS and ES modules served by a small Node server (no build step), so the same engine modules run in the studio preview and the headless renderer. Rendering uses Playwright + ffmpeg; the agent team uses the Claude API.

## Users

The owner of the studio, and people they share it with *(inferred)*: founders, marketers and creators who need a short motion-design film (a launch video, an explainer, a social post) and have a website, an article, a topic or a few lines of text, but no motion designer. They use it at a desk, in a browser, in focused sessions of a few minutes per film.

## Product Purpose

A motion design studio run by a team of AI agents. You describe the film in a chat (or paste a URL, an article, a topic); a researcher, writer, art director and director turn it into a beat-synchronized motion-design film with original music, a critic measures and reviews every cut, and the studio renders a broadcast-quality MP4. Success: people watch the result and ask how it was possible.

## Positioning

Films are code, not generated pixels: every frame is a pure function of time, typography is set by a real type engine, music is composed for the cut, and every cut is measured (readability, contrast, rhythm, sync, loudness) before anyone sees it. Unlike text-to-video models, text is always crisp and correct, brand colors and real screenshots are exact, and a revision is a precise edit rather than a re-roll.

## Operating Context

- Input: a chat message containing a URL, pasted article text, a topic, or revision notes ("make it square", "more energetic", "use blue").
- The team works live: research, story, art direction, direction, critique and revision steps stream into the studio.
- The film previews instantly in the browser (same engine as the final render) and renders to MP4 in draft or master quality.
- Formats: 9:16, 16:9, 1:1, 4:5.

## Capabilities and Constraints

- 21 scene types, 8 transitions, 10 style packs, 7 synthesized music moods.
- Without an Anthropic API key the studio runs an offline heuristic director (lower creative quality, same pipeline).
- Rendering is CPU-bound: a 25 s master (60 fps, 4x motion blur) takes about 2-3 minutes on 4 cores; drafts are about 4x faster.
- Undecided: user accounts, sharing links, hosting/deployment target, pricing.

## Brand Commitments

None given by the owner. The studio's own name is undecided *(inferred working name: "Motion studio")*.

## Evidence on Hand

- Showcase films are produced by the studio itself from real inputs; nothing on the site may claim customers, usage numbers, testimonials or awards that do not exist.

## Product Principles

1. Show the work: the film and the team's process are the interface; chrome stays out of the way.
2. Measured, not guessed: every quality claim the studio makes about a cut comes from a measurement or a named review.
3. Truth in the films: agents never invent statistics, quotes or customers.
4. Revisions are conversation: any note in plain language changes the cut.
5. Speed of first frame: something good is on screen within seconds of asking.

## Accessibility & Inclusion

WCAG 2.2 AA for the studio interface; keyboard-operable chat, player and timeline; reduced-motion respected in the UI (films themselves are the content).
