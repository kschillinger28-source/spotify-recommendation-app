/* TheVibe — "The Mood Orb"
 *
 * Mood map math:
 *   The canvas is a 2D valence–energy map. x = energy (0 = calm, 1 = hype),
 *   y = valence (0 = melancholy, 1 = euphoric), both normalized 0..1 with the
 *   origin at the bottom-left of the canvas. Six mood anchors sit on this map
 *   (see moods.js). At any orb position (ex, ey) we compute the two nearest
 *   anchors by Euclidean distance and blend their palette colors with
 *   t = d1 / (d1 + d2), so gradients interpolate continuously while the
 *   one-word label crossfades to the single nearest anchor. Dropping the orb
 *   snaps it to the nearest anchor ("lock"), freezes the gradient there,
 *   reshapes the waveform and reveals the mood-matched fake track.
 *
 * Drag runs on pointer events (mouse + touch); transforms are written through
 * framer-motion springs, so no React state re-renders happen during a drag —
 * only the discrete mood-label change re-renders. All effects guard for
 * SSR (typeof window / IntersectionObserver) and prefers-reduced-motion,
 * which swaps dragging for a click-to-cycle control with no continuous motion.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useTransform } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { MOODS, blendMoods, lerpHex, hexAlpha } from "./moods";
import useMoodOrb from "./useMoodOrb";
import Waveform from "./Waveform";
import AskTheVibe from "./AskTheVibe";
import { playMoodTone } from "./moodSound";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const zoneParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } },
};
const zoneVar = {
  hidden: { opacity: 0, scale: 0.7 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

export default function TheVibe({ variant = "playground", className = "" }) {
  const isPlayground = variant === "playground";

  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(false);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const lastPost = useRef({ id: null, t: 0 });
  const orb = useMoodOrb({
    variant,
    onLock: (mood, source) => {
      if (soundOnRef.current) playMoodTone(mood.freq);
      const now = Date.now();
      if (mood.id !== lastPost.current.id || now - lastPost.current.t > 4000) {
        lastPost.current = { id: mood.id, t: now };
        fetch(`${API}/vibe-locks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mood: mood.label,
            energy: Number(mood.energy.toFixed(3)),
            valence: Number(mood.valence.toFixed(3)),
            source,
          }),
        }).catch(() => {});
      }
    },
  });

  // gradient + orb color are written directly to the DOM from a single rAF loop — zero re-renders
  const rootRef = useRef(null);
  const layerARef = useRef(null);
  const layerBRef = useRef(null);
  const glowRef = useRef(null);
  const coreRef = useRef(null);
  const stateRef = useRef({ energy: 0.5, valence: 0.5, color: "#FF2A6D" });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let visible = true;
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const ex = orb.sx.get();
      const ey = orb.sy.get();
      const { a, b, t } = blendMoods(ex, ey);
      const c = lerpHex(a.glow, b.glow, t);
      const c2 = lerpHex(a.glow2, b.glow2, t);
      stateRef.current = { energy: ex, valence: ey, color: c };
      const px = `${ex * 100}%`;
      const py = `${(1 - ey) * 100}%`;
      if (layerARef.current) {
        layerARef.current.style.background = `radial-gradient(ellipse 90% 90% at ${px} ${py}, ${hexAlpha(
          c,
          0.4
        )} 0%, transparent 62%)`;
      }
      if (layerBRef.current) {
        layerBRef.current.style.background = `radial-gradient(circle at ${px} ${py}, ${hexAlpha(
          a.glow,
          0.5
        )} 0%, transparent 26%)`;
      }
      if (glowRef.current) glowRef.current.style.background = c;
      if (coreRef.current) {
        coreRef.current.style.background = `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95) 0%, ${c} 48%, ${c2} 100%)`;
      }
    };
    loop();
    let io;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
      });
      io.observe(root);
    }
    return () => {
      if (io) io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [orb.sx, orb.sy]);

  const left = useTransform(orb.sx, (v) => `${v * 100}%`);
  const top = useTransform(orb.sy, (v) => `${(1 - v) * 100}%`);

  const track = orb.nearest.track;

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        orb.containerRef.current = node;
      }}
      data-testid={isPlayground ? "vibe-playground-canvas" : "vibe-hero-canvas"}
      className={`overflow-hidden bg-[#0B0B10] isolate ${className}`}
    >
      {/* living gradient */}
      <div ref={layerARef} className="absolute inset-0 z-0 pointer-events-none" />
      <div ref={layerBRef} className="absolute inset-0 z-0 pointer-events-none" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(11,11,16,0.9)_100%)]" />

      {/* valence–energy axis furniture (playground) */}
      {isPlayground && (
        <>
          <div className="absolute left-1/2 top-0 bottom-0 z-[1] border-l border-dashed border-white/[0.07] pointer-events-none" />
          <div className="absolute top-1/2 left-0 right-0 z-[1] border-t border-dashed border-white/[0.07] pointer-events-none" />
          <span className="absolute bottom-3 left-4 z-[1] font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase pointer-events-none">
            Calm
          </span>
          <span className="absolute bottom-3 right-4 z-[1] font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase pointer-events-none">
            Hype →
          </span>
          <span className="absolute top-3 right-4 z-[1] font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase pointer-events-none">
            ↑ Euphoric
          </span>
        </>
      )}

      {/* mood zones (playground) */}
      {isPlayground && (
        <motion.div
          className="absolute inset-0 z-[2] pointer-events-none"
          variants={zoneParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          {MOODS.map((m) => {
            const active = orb.lockedMood?.id === m.id;
            return (
              <div
                key={m.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${m.energy * 100}%`, top: `${(1 - m.valence) * 100}%` }}
              >
                <motion.button
                  variants={zoneVar}
                  data-testid={`mood-zone-${m.id}`}
                  onClick={() => orb.jumpToMood(m.id)}
                  className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase transition-all duration-300 ${
                    active ? "text-white" : "text-white/45 hover:text-white"
                  }`}
                  style={{
                    borderColor: active ? m.glow : "rgba(255,255,255,0.14)",
                    background: active
                      ? hexAlpha(m.glow, 0.16)
                      : "rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: m.glow,
                      boxShadow: active ? `0 0 10px ${m.glow}` : "none",
                    }}
                  />
                  {m.label}
                </motion.button>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* mood label */}
      <div
        className={`absolute z-10 max-w-[230px] pointer-events-none ${
          isPlayground
            ? "top-5 left-5 md:top-7 md:left-7"
            : "top-20 left-5 md:left-10"
        }`}
      >
        <p className="font-mono text-[9px] tracking-[0.35em] text-white/50 uppercase">
          Current mood
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={orb.nearest.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            <h3 className="mt-1.5 font-display font-bold text-3xl md:text-4xl tracking-tight text-white">
              {orb.nearest.label}
            </h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/50 hidden sm:block">
              {orb.nearest.desc}
            </p>
          </motion.div>
        </AnimatePresence>
        {orb.reduced && (
          <button
            data-testid="mood-cycle-button"
            onClick={orb.cycleMood}
            className="pointer-events-auto mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-4 py-2 font-mono text-[10px] tracking-[0.25em] uppercase text-white/80 hover:text-white hover:border-white/40 transition-colors"
          >
            Cycle mood
          </button>
        )}
      </div>

      {/* the orb */}
      <motion.div
        className="absolute z-20 pointer-events-none"
        style={{ left, top }}
      >
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: isPlayground ? 0.5 : 0.35, type: "spring", stiffness: 130, damping: 16 }}
          className="relative -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div
            data-testid={isPlayground ? "playground-mood-orb" : "hero-mood-orb"}
            role="slider"
            tabIndex={0}
            aria-label="Mood orb — drag, or use arrow keys to move across the valence and energy map. Press Enter to lock the nearest mood."
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(orb.nearest.energy * 100)}
            aria-valuetext={`${orb.nearest.label}${
              orb.lockedMood ? " (locked)" : ""
            } — sample track: ${track.title}`}
            {...orb.orbHandlers}
            onClick={orb.reduced ? orb.cycleMood : undefined}
            animate={{ scale: orb.isDragging ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className={`group relative flex items-center justify-center outline-none touch-none select-none pointer-events-auto ${
              orb.isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div
              ref={glowRef}
              className="absolute -inset-8 md:-inset-10 rounded-full blur-2xl opacity-70"
            />
            <div
              ref={coreRef}
              className={`relative h-16 w-16 md:h-20 md:w-20 rounded-full ring-1 ring-white/25 transition-shadow duration-300 ${
                orb.lockedMood
                  ? "shadow-[0_0_0_3px_rgba(255,255,255,0.65)]"
                  : "group-focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.55)]"
              }`}
            />
            <AnimatePresence>
              {orb.lockedMood && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute top-full mt-3 font-mono text-[9px] tracking-[0.35em] text-white/70 uppercase whitespace-nowrap"
                >
                  Locked
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {!orb.interacted && !orb.reduced && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 1.4 } }}
                  exit={{ opacity: 0, transition: { duration: 0.4 } }}
                  className="absolute top-full mt-3 font-mono text-[9px] tracking-[0.35em] text-white/55 uppercase whitespace-nowrap pointer-events-none"
                >
                  Drag me
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ask the algorithm (playground, AI via Claude) */}
      {isPlayground && <AskTheVibe orb={orb} />}

      {/* waveform */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <Waveform stateRef={stateRef} height={isPlayground ? 110 : 70} />
      </div>

      {/* now playing chip (playground) */}
      <AnimatePresence>
        {isPlayground && orb.lockedMood && (
          <motion.div
            key="chip"
            data-testid="now-playing-chip"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute z-30 bottom-4 left-4 right-4 sm:right-auto sm:bottom-5 sm:left-5 flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                style={{ background: orb.lockedMood.glow }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ background: orb.lockedMood.glow }}
              />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[9px] tracking-[0.35em] text-white/50 uppercase">
                Now playing
              </p>
              <p className="text-sm text-white font-medium truncate">
                {track.title}{" "}
                <span className="text-white/40 font-normal">— {track.artist}</span>
              </p>
              <p className="font-mono text-[10px] text-white/40">
                {track.bpm} · {track.key} · matched to {orb.lockedMood.label}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* sound toggle (playground) */}
      {isPlayground && (
        <button
          data-testid="vibe-sound-toggle"
          aria-pressed={soundOn}
          onClick={() => setSoundOn((s) => !s)}
          className="absolute z-30 bottom-5 right-5 hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-xl px-4 py-2 font-mono text-[9px] tracking-[0.3em] uppercase text-white/60 hover:text-white hover:border-white/35 transition-colors"
        >
          {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
          Sound {soundOn ? "on" : "off"}
        </button>
      )}
    </div>
  );
}
