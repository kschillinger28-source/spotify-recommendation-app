import { AudioWaveform, ArrowUp } from "lucide-react";
import { scrollToId, scrollToTop } from "@/lib/scroll";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.07] bg-[#08080D] px-5 md:px-10 py-14">
      <div className="mx-auto max-w-[1400px] flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10">
              <AudioWaveform size={15} className="text-[#FBBF24]" />
            </span>
            <span className="font-display font-bold tracking-tight text-lg">
              MOMENTM
            </span>
          </div>
          <p className="mt-4 text-sm text-white/50 max-w-sm leading-relaxed">
            Music that knows your moment. The right song for the right time —
            not the same rotation, forever.
          </p>
          <p className="mt-4 font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase">
            Visual concept · All tracks are fictional
          </p>
        </div>

        <nav className="flex flex-col sm:flex-row gap-4 sm:gap-8 font-mono text-[10px] tracking-[0.3em] text-white/50 uppercase">
          <button
            data-testid="footer-link-problem"
            onClick={() => scrollToId("the-problem")}
            className="hover:text-white transition-colors duration-300 text-left"
          >
            The Problem
          </button>
          <button
            data-testid="footer-link-playground"
            onClick={() => scrollToId("the-vibe-playground")}
            className="hover:text-white transition-colors duration-300 text-left"
          >
            Playground
          </button>
          <button
            data-testid="footer-back-to-top"
            onClick={scrollToTop}
            className="inline-flex items-center gap-2 hover:text-white transition-colors duration-300"
          >
            Back to top <ArrowUp size={12} />
          </button>
        </nav>
      </div>
    </footer>
  );
}
