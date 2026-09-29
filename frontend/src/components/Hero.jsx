import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown } from "lucide-react";
import TheVibe from "@/components/TheVibe/TheVibe";
import { scrollToId } from "@/lib/scroll";

const EASE = [0.22, 1, 0.36, 1];

function RevealLine({ children, delay, className = "" }) {
  return (
    <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
      <motion.span
        className={`block ${className}`}
        initial={{ y: "115%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const vibeY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  return (
    <section
      ref={ref}
      data-testid="hero-section"
      className="relative min-h-screen overflow-hidden bg-[#0B0B10]"
    >
      {/* desktop: full-bleed living gradient + orb behind hero content (pointer events on the orb only) */}
      <motion.div
        style={{ y: vibeY }}
        className="absolute inset-0 hidden md:block pointer-events-none"
      >
        <TheVibe
          variant="hero"
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </motion.div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-5 md:px-10 flex flex-col min-h-screen">
        {/* mobile: the orb gets its own stage above the headline */}
        <div className="md:hidden pt-20">
          <TheVibe variant="hero" className="relative w-full h-[340px]" />
        </div>

        <motion.div
          style={{ y: contentY }}
          className="relative z-10 flex-1 flex flex-col justify-center pb-14 md:pb-0 md:min-h-screen"
        >
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
            className="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md px-4 py-1.5 mt-24 md:mt-16"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4BF] animate-pulse" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-white/70 uppercase">
              Context-aware music intelligence
            </span>
          </motion.div>

          <h1 className="mt-6 font-display font-extrabold tracking-tight leading-[1.02] text-[2.6rem] sm:text-6xl lg:text-7xl xl:text-[5.2rem] max-w-4xl">
            <RevealLine delay={0.2}>Playlists repeat.</RevealLine>
            <RevealLine delay={0.34}>
              Moments{" "}
              <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#FBBF24] via-[#FF2A6D] to-[#818CF8]">
                don&rsquo;t.
              </span>
            </RevealLine>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.6 }}
            className="mt-6 max-w-xl text-base md:text-lg text-white/60 leading-relaxed"
          >
            The Vibe scores every track on valence and energy, then matches it
            to the moment you&rsquo;re actually in — not the same twenty songs
            on rotation since March. Drag the orb. Feel the algorithm.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.75 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <button
              data-testid="hero-cta-playground"
              onClick={() => scrollToId("the-vibe-playground")}
              className="group inline-flex items-center gap-2.5 rounded-full bg-white text-[#0B0B10] font-semibold text-sm px-7 py-3.5 hover:scale-[1.03] active:scale-95 transition-transform duration-300 shadow-[0_0_40px_rgba(255,42,109,0.35)]"
            >
              Feel the algorithm
              <ArrowDown
                size={16}
                className="transition-transform duration-300 group-hover:translate-y-0.5"
              />
            </button>
            <button
              data-testid="hero-cta-problem"
              onClick={() => scrollToId("the-problem")}
              className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md text-white/80 font-medium text-sm px-7 py-3.5 hover:border-white/35 hover:text-white transition-colors duration-300"
            >
              The problem
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.05 }}
            className="mt-10 font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase"
          >
            Valence–Energy map · 6 mood zones · Zero repeats
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
