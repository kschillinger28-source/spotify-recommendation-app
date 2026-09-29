# THE VIBE — copy-paste prompt (refined, very specific wording)

Use this prompt against any existing React + Tailwind codebase. It encodes exactly what was built and verified here.

---

You are editing my existing website. Add ONE new creative, interactive feature called "The Vibe" without changing anything else.

HARD RULES — do not violate:
1. Do NOT remove, rename, or restyle any existing className, id, data-attribute, prop, route, import, or component.
2. Do NOT change existing functionality, layout, copy, colors, fonts, or behavior of any current element.
3. Only ADD new files inside one self-contained folder `/src/components/TheVibe/`, and mount the component at exactly two places. If you must touch an existing file, insert new lines only — never edit existing lines.
4. If my stack differs (Vue/Svelte/etc.), adapt the syntax but keep every rule above and every behavior below.

CONTEXT:
My site is about a smarter music recommendation algorithm that solves the problem of large playlists rotating the same 20 songs and never matching the user's current moment/mood.

MOOD MAP MATH (must be exact):
- The canvas is a 2D map. x = energy, normalized 0 (calm) → 1 (hype), left→right. y = valence, normalized 0 (melancholy) → 1 (euphoric), bottom→top.
- Six mood anchors: Melancholy (0.15, 0.12), Chill (0.20, 0.68), Focus (0.46, 0.80), Late Night (0.52, 0.30), Euphoric (0.80, 0.88), Hype (0.93, 0.58).
- At any orb position, compute the two nearest anchors by Euclidean distance; blend their palette colors with t = d1/(d1+d2) for a continuously interpolated gradient; the single nearest anchor wins the one-word label.
- Each mood palette needs: glow hex, secondary hex, a fake track {title, artist, bpm, key}, and a synth root frequency.

FILES TO CREATE (exactly):
1. `moods.js` — MOODS array + `nearestMood`, `blendMoods`, `lerpHex`, `hexAlpha`, `clamp01`.
2. `moodStore.js` — module-level pub/sub publishing mood locks with a `source` tag, so the hero orb and playground orb stay in sync.
3. `moodSound.js` — Web Audio API: on lock, play a ~2.4s detuned triangle+sine pad (root, fifth, sub-octave) through a lowpass filter with exponential gain envelope. No audio files. Guard every call.
4. `useMoodOrb.js` — the hook: framer-motion `useMotionValue` + `useSpring` for x/y; pointer capture drag (pointerdown/move/up, works for mouse AND touch, `touch-action: none`); hero-only idle drift (small sin/cos wobble) with magnetic cursor pull using window mousemove (works through pointer-events-none hosts); keyboard handler (arrows = 0.03 steps, shift = 0.08, Enter/Space locks nearest mood, keys 1–6 snap to moods, preventDefault on all); IntersectionObserver to pause every rAF loop when offscreen; `useReducedMotion` respected.
5. `Waveform.jsx` — Canvas 2D, own rAF: amplitude = h·(0.12 + energy·0.2), frequency = 2 + energy·9, phase speed = 0.02 + energy·0.1, jagged noise term scaled by (1 − valence); two-pass stroke (6px glow at 16% alpha + 1.4px core at 90%); DPR capped at 1.5; ResizeObserver for sizing; static when prefers-reduced-motion.
6. `TheVibe.jsx` — prop `variant: "hero" | "playground"`. Top-of-file comment block explaining the mood map math. Gradient/orb colors written to DOM refs from one rAF loop (zero React re-renders during drag; only the discrete mood-label change re-renders, via AnimatePresence crossfade). Orb: role="slider", tabIndex 0, aria-valuemin 0 / aria-valuemax 100 / aria-valuenow (energy %) / aria-valuetext "<mood> — sample track: <title>", scale 1.15 while dragging, white ring + "LOCKED" tag when locked.

MOUNT POINTS (additive only):
(a) HERO: `<TheVibe variant="hero" />` twice — once inside an `absolute inset-0 hidden md:block pointer-events-none` wrapper (full-bleed living gradient + waveform + orb, orb gets `pointer-events-auto` ONLY on itself so all hero text/CTAs stay clickable), once inside a `md:hidden` wrapper as a relative 340px stage above the mobile headline.
(b) PLAYGROUND: a new `<section id="the-vibe-playground">` directly after the hero, containing `<TheVibe variant="playground" />` (500px mobile / 620px desktop canvas, rounded-3xl, border white/10, deep shadow; scroll-in reveal: opacity 0→1, scale 0.94→1 via whileInView once).

PLAYGROUND BEHAVIOR (must be exact):
- 6 zone pill buttons anchored at the mood coordinates (`data-testid="mood-zone-<id>"`, staggered spring fade-in on scroll). Tapping a zone jumps the orb there and locks it.
- Dropping the orb (pointerup) or pressing Enter snaps it to the nearest anchor, locks the gradient, and fades in a glassmorphism "NOW PLAYING: <title> — <artist> · <bpm> · <key>" chip (`data-testid="now-playing-chip"`). Dragging again unlocks.
- On every lock: POST {mood, energy, valence, source} to `/api/vibe-locks` (debounced: skip if same mood within 4s) and play the synth pad only if the user enabled sound (default OFF, toggle button `data-testid="vibe-sound-toggle"`, aria-pressed).
- Axis furniture: dashed center lines, mono labels CALM / → HYPE (bottom) and ↑ EUPHORIC (top).

ACCESSIBILITY & EDGE CASES (required, already specified — keep all):
- prefers-reduced-motion: no drift, no drag; a "Cycle mood" button (`data-testid="mood-cycle-button"`) plus orb click cycles moods; position changes jump instantly (no springs).
- Full keyboard support as defined in useMoodOrb.js. On mobile: no hover effects, drag stays, canvas shrinks to viewport width, no horizontal overflow.
- Guard all window/document/IntersectionObserver usage for SSR.

TECH: React + Tailwind + framer-motion only (no Three.js). Never call React state during drag — transform/spring motion values and direct DOM writes only.

DELIVERABLES: the six files in `/src/components/TheVibe/`, the two hero mounts, the one playground section, zero edits to any existing line. Confirm the hard rules back to me before outputting files. If any rule conflicts with a request, ask before proceeding.
