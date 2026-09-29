import { useEffect, useState } from "react";
import { AudioWaveform } from "lucide-react";
import { scrollToId, scrollToTop } from "@/lib/scroll";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0B0B10]/75 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1400px] px-5 md:px-10 h-16 flex items-center justify-between">
        <button
          data-testid="nav-logo"
          onClick={scrollToTop}
          className="flex items-center gap-2.5 group outline-none"
          aria-label="MOMENTM — back to top"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 group-hover:border-white/25 transition-colors duration-300">
            <AudioWaveform size={15} className="text-[#FBBF24]" />
          </span>
          <span className="font-display font-bold tracking-tight text-lg">
            The Vibe
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-9 font-mono text-[10px] tracking-[0.3em] text-white/55">
          <button
            data-testid="nav-link-problem"
            onClick={() => scrollToId("the-problem")}
            className="hover:text-white transition-colors duration-300 uppercase"
          >
            The Problem
          </button>
          <button
            data-testid="nav-link-playground"
            onClick={() => scrollToId("the-vibe-playground")}
            className="hover:text-white transition-colors duration-300 uppercase"
          >
            Playground
          </button>
        </nav>

        <button
          data-testid="nav-cta"
          onClick={() => scrollToId("the-vibe-playground")}
          className="rounded-full bg-white text-[#0B0B10] font-semibold text-xs md:text-[13px] px-5 py-2.5 hover:scale-[1.04] active:scale-95 transition-transform duration-300 shadow-[0_0_24px_rgba(255,255,255,0.15)]"
        >
          Feel the algorithm
        </button>
      </div>
    </header>
  );
}
