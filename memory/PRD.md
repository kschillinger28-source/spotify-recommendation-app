# PRD — MOMENTM ("The Vibe" Mood Orb site)

## Original problem statement
Add one creative, non-destructive interactive feature — "The Vibe" — to a music-tech site: a draggable glowing Mood Orb on a 2D valence–energy map. Hero gets a compact cursor-reactive version; a new playground section (`#the-vibe-playground`) gets a larger canvas with 6 labeled mood zones, lock-on-drop, morphing gradient, reshaping waveform, and a "Now playing" chip. Site story: a context-aware music recommendation algorithm that fixes playlists rotating the same 20 songs.

## User decisions (from clarifying round)
- Full landing page built around The Vibe (workspace started from blank template)
- "Now playing" = visual chip by default; subtle Web Audio synth tones available behind a sound toggle (default OFF, gesture-gated)
- Mood locks stored as anonymous analytics in Mongo (one endpoint)
- Deliver also a very specific copy-paste prompt (THE_VIBE_PROMPT.md)

## Architecture
- Frontend: React 19 (CRA/craco) + Tailwind + framer-motion 11 + lenis 1.3.26 smooth scroll
- TheVibe is a fully self-contained folder `/frontend/src/components/TheVibe/`:
  - `moods.js` — 6 mood anchors (x=energy 0–1, y=valence 0–1), palettes, fake tracks, blend/lerp helpers
  - `moodStore.js` — module-level lock pub/sub syncing hero ↔ playground orbs
  - `moodSound.js` — Web Audio synth pad on lock (no files, no licensing)
  - `useMoodOrb.js` — pointer/keyboard/drift/reduced-motion/IntersectionObserver logic; spring motion values, zero re-render during drag
  - `Waveform.jsx` — Canvas 2D waveform (amplitude←energy, frequency+scroll←energy, jaggedness←low valence)
  - `TheVibe.jsx` — mounts: hero (desktop absolute bg layer + mobile 340px stage) and playground (620px canvas, zones, chip, sound toggle)
- Backend: FastAPI + Motor; additive routes `POST /api/vibe-locks` (validated mood, 0–1 floats) and `GET /api/vibe-locks/summary`
- Landing sections: Navbar, Hero (masked line-by-line reveal, parallax), Marquee, PlaygroundSection, Story (problem + treated Unsplash frames + 3 cards), Footer
- Brand: MOMENTM; original SVG orb-wave logo used as favicon (`public/logo.svg`)

## Accessibility & edge cases (as briefed)
- prefers-reduced-motion: no drift/drag; "Cycle mood" button + orb click cycles; springs jumped instantly
- role="slider" orb, tabIndex, arrow keys (+shift = 8%), Enter/Space locks, keys 1–6 snap, aria-valuetext, aria-live via valuetext
- Pointer events for mouse+touch, touch-action none on orb; hover effects only on pointer devices
- SSR guards (typeof window / IntersectionObserver checks), rAF loops paused when offscreen

## Implemented (2026-09-29)
- All of the above; verified via curl (root, valid/invalid lock, summary) and screenshots (desktop 1440 hero + playground + zone-lock flow with chip; mobile 390 hero + playground; no horizontal overflow)

## Backlog
- P0: none outstanding
- P1: real 30s audio previews behind licensing decision; vibe-locks dashboard for the algorithm story; shareable mood card
- P2: mood-history strip per visitor; more mood zones; i18n
