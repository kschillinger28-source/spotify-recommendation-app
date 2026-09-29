import { useEffect, useRef } from "react";

export default function Waveform({ stateRef, height = 90, className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let raf;
    let w = 0;
    let h = 0;
    let phase = 0;
    let visible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
    });
    io.observe(canvas);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible || !w) return;
      const s = stateRef.current || {};
      const energy = s.energy ?? 0.5;
      const valence = s.valence ?? 0.5;
      const color = s.color || "#FF2A6D";

      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) phase += 0.02 + energy * 0.1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const amp = h * (0.12 + energy * 0.2);
      const freq = 2 + energy * 9;
      const jag = (1 - valence) * 0.9;
      const passes = [
        { lw: 6, alpha: 0.16 },
        { lw: 1.4, alpha: 0.9 },
      ];

      for (const p of passes) {
        ctx.beginPath();
        for (let px = 0; px <= w; px += 3) {
          const t = px / w;
          const env = Math.pow(Math.sin(Math.PI * t), 1.1);
          let v = Math.sin(t * freq * Math.PI * 2 + phase) * env;
          v += Math.sin(t * freq * Math.PI * 4 - phase * 1.7) * env * 0.25 * valence;
          if (jag > 0.05) {
            v +=
              Math.sin(t * 91.7 + phase * 2.3) *
              Math.sin(t * 13.1 - phase) *
              jag *
              0.35 *
              env;
          }
          const y = h / 2 + v * amp;
          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = p.alpha;
        ctx.lineWidth = p.lw;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [stateRef]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="waveform-canvas"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
      style={{ width: "100%", height, display: "block" }}
    />
  );
}
