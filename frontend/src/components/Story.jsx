import { motion } from "framer-motion";
import { Repeat, Clock, AudioWaveform } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];

const CARDS = [
  {
    icon: Repeat,
    num: "01",
    title: "Frozen rotations",
    body: "Static playlists shuffle from a frozen pool. Your 2PM focus grind and your 11PM wind-down get the same dice roll.",
  },
  {
    icon: Clock,
    num: "02",
    title: "Context-blind picks",
    body: "Time of day, motion, the mood you're in right now — none of it reaches the algorithm picking your next track.",
  },
  {
    icon: AudioWaveform,
    num: "03",
    title: "The vibe vector",
    body: "The Vibe scores every track on valence and energy, then matches the moment you're in. New songs, right context, zero skips.",
  },
];

const IMG = (id, w = 1200) =>
  `https://images.unsplash.com/${id}?crop=entropy&cs=srgb&fm=jpg&q=85&w=${w}&auto=format&fit=crop`;

function SpotlightFrame({ src, alt, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: 2 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1, ease: EASE, delay }}
      whileHover={{ rotate: -1, scale: 1.015 }}
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-[#12121A] ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover saturate-[0.85] contrast-[1.05] transition-all duration-700 group-hover:scale-[1.04] group-hover:saturate-125"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B10]/85 via-transparent to-[#0B0B10]/25" />
      <div className="absolute inset-0 opacity-60 group-hover:opacity-30 transition-opacity duration-700 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
    </motion.div>
  );
}

export default function Story() {
  return (
    <section
      id="the-problem"
      data-testid="the-problem-section"
      className="relative py-24 md:py-32 px-5 md:px-10 bg-[#0B0B10] overflow-hidden"
    >
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full bg-[#6366F1]/[0.07] blur-[120px]" />
      <div className="mx-auto max-w-[1400px]">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: EASE }}
              className="font-mono text-[10px] tracking-[0.35em] text-[#818CF8] uppercase"
            >
              The problem
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.08 }}
              className="mt-4 font-display font-bold tracking-tight text-3xl sm:text-4xl lg:text-5xl leading-[1.08]"
            >
              The same 20 songs,{" "}
              <span className="font-serif italic font-normal text-[#FBBF24]">
                on rotation forever.
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.16 }}
              className="mt-6 text-white/60 leading-relaxed text-base md:text-lg"
            >
              Every big playlist drifts back to the same rotation. Not because
              you love those songs that much — because the queue stopped
              listening to your context. We built an algorithm that never
              stops listening.
            </motion.p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 gap-4 md:gap-5 h-fit">
            <SpotlightFrame
              src={IMG("photo-1762274673430-f6ca404104d1")}
              alt="Listener in dark neon light"
              className="col-span-2 h-64 md:h-80"
            />
            <SpotlightFrame
              src={IMG("photo-1777146536285-e70e21c953eb", 800)}
              alt="Headphones glowing in the dark"
              className="h-40 md:h-52"
              delay={0.1}
            />
            <SpotlightFrame
              src={IMG("photo-1787875230358-177453c963ba", 800)}
              alt="Night listening moment"
              className="h-40 md:h-52"
              delay={0.2}
            />
          </div>
        </div>

        <div className="mt-16 md:mt-24 grid md:grid-cols-3 gap-4 md:gap-5">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.num}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.8, ease: EASE, delay: i * 0.1 }}
              className="h-full rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-7 md:p-8 hover:border-white/20 hover:bg-white/[0.05] transition-colors duration-500 group"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] group-hover:border-white/25 transition-colors duration-500">
                  <c.icon size={18} className="text-[#2DD4BF]" />
                </span>
                <span className="font-mono text-[10px] tracking-[0.3em] text-white/25">
                  {c.num}
                </span>
              </div>
              <h3 className="mt-6 font-display font-bold text-xl md:text-2xl tracking-tight">
                {c.title}
              </h3>
              <p className="mt-3 text-sm md:text-[15px] text-white/55 leading-relaxed">
                {c.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
