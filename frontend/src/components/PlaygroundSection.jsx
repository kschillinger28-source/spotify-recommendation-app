import { motion } from "framer-motion";
import TheVibe from "@/components/TheVibe/TheVibe";

const EASE = [0.22, 1, 0.36, 1];

export default function PlaygroundSection() {
  return (
    <section
      id="the-vibe-playground"
      data-testid="the-vibe-playground"
      className="relative py-24 md:py-32 px-4 md:px-8 bg-[#0B0B10]"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 md:mb-14 px-1"
        >
          <div>
            <p className="font-mono text-[10px] tracking-[0.35em] text-[#2DD4BF] uppercase">
              The Vibe · Interactive playground
            </p>
            <h2 className="mt-3 font-display font-bold tracking-tight text-3xl sm:text-4xl lg:text-5xl">
              Drag the orb. Lock a mood.
            </h2>
          </div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-white/40 uppercase md:text-right md:pb-2">
            Drag or arrow keys · Enter locks · Tap a zone to jump
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 40 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <TheVibe
            variant="playground"
            className="relative w-full h-[500px] md:h-[620px] rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-6 text-center font-mono text-[10px] tracking-[0.25em] text-white/30 uppercase"
        >
          Every lock is an anonymous signal — this is exactly how the real
          algorithm learns your moments
        </motion.p>
      </div>
    </section>
  );
}
