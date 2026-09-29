import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { MOODS, nearestMood, moodById, clamp01 } from "./moods";
import { publishLock, subscribeLocks } from "./moodStore";

const DEFAULT_POS = {
  hero: { x: 0.72, y: 0.5 },
  playground: { x: 0.5, y: 0.55 },
};

export default function useMoodOrb({ variant, onLock }) {
  const reduced = useReducedMotion();
  const containerRef = useRef(null);
  const defaultPos = DEFAULT_POS[variant] || DEFAULT_POS.playground;

  const x = useMotionValue(defaultPos.x);
  const y = useMotionValue(defaultPos.y);
  const sx = useSpring(x, { stiffness: 170, damping: 24, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 170, damping: 24, mass: 0.7 });

  const draggingRef = useRef(false);
  const baseRef = useRef({ x: defaultPos.x, y: defaultPos.y });
  const cursorRef = useRef(null);
  const phaseRef = useRef(Math.random() * 100);
  const visibleRef = useRef(true);
  const reducedRef = useRef(false);
  const lockedRef = useRef(null);
  const nearestRef = useRef(nearestMood(defaultPos.x, defaultPos.y));

  const [isDragging, setIsDragging] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [nearest, setNearest] = useState(nearestRef.current);
  const [lockedMood, setLockedMood] = useState(null);

  useEffect(() => {
    reducedRef.current = !!reduced;
  }, [reduced]);

  const pointerPos = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01(1 - (clientY - rect.top) / rect.height),
    };
  }, []);

  const markInteracted = useCallback(() => setInteracted(true), []);

  const commitMood = useCallback((nx, ny) => {
    const m = nearestMood(nx, ny);
    if (m.id !== nearestRef.current.id) {
      nearestRef.current = m;
      setNearest(m);
    }
  }, []);

  const applyPos = useCallback(
    (nx, ny) => {
      x.set(nx);
      y.set(ny);
      if (reducedRef.current) {
        sx.jump(nx);
        sy.jump(ny);
      }
    },
    [x, y, sx, sy]
  );

  const lockAt = useCallback(
    (nx, ny, moodId) => {
      const mood = moodId ? moodById(moodId) : nearestMood(nx, ny);
      if (!mood) return;
      applyPos(mood.energy, mood.valence);
      baseRef.current = { x: mood.energy, y: mood.valence };
      lockedRef.current = mood;
      setLockedMood(mood);
      nearestRef.current = mood;
      setNearest(mood);
      publishLock(mood.id, variant);
      if (onLock) onLock(mood, variant);
    },
    [applyPos, variant, onLock]
  );

  const onPointerDown = useCallback(
    (e) => {
      if (reducedRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        /* no capture, no problem */
      }
      draggingRef.current = true;
      setIsDragging(true);
      lockedRef.current = null;
      setLockedMood(null);
      markInteracted();
    },
    [markInteracted]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      const p = pointerPos(e.clientX, e.clientY);
      if (!p) return;
      applyPos(p.x, p.y);
      commitMood(p.x, p.y);
    },
    [pointerPos, applyPos, commitMood]
  );

  const endDrag = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
      const p = pointerPos(e.clientX, e.clientY);
      const nx = p ? p.x : x.get();
      const ny = p ? p.y : y.get();
      baseRef.current = { x: nx, y: ny };
      if (variant === "playground") lockAt(nx, ny);
    },
    [pointerPos, x, y, variant, lockAt]
  );

  const onKeyDown = useCallback(
    (e) => {
      const key = e.key;
      if (key === "Enter" || key === " ") {
        e.preventDefault();
        markInteracted();
        lockAt(x.get(), y.get());
        return;
      }
      const mIdx = ["1", "2", "3", "4", "5", "6"].indexOf(key);
      if (mIdx >= 0) {
        e.preventDefault();
        const m = MOODS[mIdx];
        markInteracted();
        lockAt(m.energy, m.valence, m.id);
        return;
      }
      const step = e.shiftKey ? 0.08 : 0.03;
      let nx = baseRef.current.x;
      let ny = baseRef.current.y;
      let handled = true;
      if (key === "ArrowLeft") nx -= step;
      else if (key === "ArrowRight") nx += step;
      else if (key === "ArrowUp") ny += step;
      else if (key === "ArrowDown") ny -= step;
      else handled = false;
      if (!handled) return;
      e.preventDefault();
      e.stopPropagation();
      nx = clamp01(nx);
      ny = clamp01(ny);
      baseRef.current = { x: nx, y: ny };
      lockedRef.current = null;
      setLockedMood(null);
      markInteracted();
      applyPos(nx, ny);
      commitMood(nx, ny);
    },
    [x, y, applyPos, commitMood, lockAt, markInteracted]
  );

  const jumpToMood = useCallback(
    (moodId) => {
      const m = moodById(moodId);
      if (!m) return;
      markInteracted();
      lockAt(m.energy, m.valence, m.id);
    },
    [lockAt, markInteracted]
  );

  const cycleMood = useCallback(() => {
    const idx = MOODS.findIndex((m) => m.id === nearestRef.current.id);
    jumpToMood(MOODS[(idx + 1) % MOODS.length].id);
  }, [jumpToMood]);

  // cross-variant sync: a lock in the playground moves the hero orb, and vice versa
  useEffect(() => {
    const unsub = subscribeLocks((s) => {
      if (s.source === variant) return;
      const m = moodById(s.moodId);
      if (!m) return;
      applyPos(m.energy, m.valence);
      baseRef.current = { x: m.energy, y: m.valence };
      lockedRef.current = m;
      setLockedMood(m);
      nearestRef.current = m;
      setNearest(m);
    });
    return unsub;
  }, [variant, applyPos]);

  // pause all loops when the canvas is offscreen or display:none
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // idle drift + magnetic cursor pull (hero only, skipped for reduced motion)
  useEffect(() => {
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visibleRef.current || reducedRef.current || draggingRef.current) return;
      if (variant !== "hero" || lockedRef.current) return;
      phaseRef.current += 1 / 60;
      const t = phaseRef.current;
      const bx = baseRef.current.x;
      const by = baseRef.current.y;
      let tx = bx + Math.sin(t * 0.6) * 0.018;
      let ty = by + Math.cos(t * 0.8) * 0.024;
      const c = cursorRef.current;
      if (c) {
        const dx = tx - c.x;
        const dy = ty - c.y;
        const pull = Math.exp(-Math.hypot(dx, dy) * 4) * 0.12;
        tx -= dx * pull;
        ty -= dy * pull;
      }
      const nx = clamp01(tx);
      const ny = clamp01(ty);
      x.set(nx);
      y.set(ny);
      commitMood(nx, ny);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [variant, x, y, commitMood]);

  // cursor tracking on window so the magnetic pull works even with pointer-events-none hosts
  useEffect(() => {
    if (variant !== "hero") return undefined;
    const mm = (e) => {
      if (!visibleRef.current || draggingRef.current) return;
      const p = pointerPos(e.clientX, e.clientY);
      if (p) cursorRef.current = p;
    };
    const ml = () => {
      cursorRef.current = null;
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseout", ml);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseout", ml);
    };
  }, [variant, pointerPos]);

  return {
    containerRef,
    sx,
    sy,
    isDragging,
    interacted,
    nearest,
    lockedMood,
    reduced,
    orbHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
    },
    jumpToMood,
    cycleMood,
  };
}
