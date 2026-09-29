const ITEMS = ["Focus", "Hype", "Chill", "Melancholy", "Euphoric", "Late Night"];

function Row({ hidden }) {
  return (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {ITEMS.map((t) => (
        <span
          key={t}
          className="flex items-center font-display font-extrabold uppercase text-4xl md:text-6xl tracking-tight"
        >
          <span className="text-stroke px-5 md:px-7">{t}</span>
          <span className="text-[#FF2A6D] text-xl md:text-2xl">✦</span>
        </span>
      ))}
    </div>
  );
}

export default function Marquee() {
  return (
    <div className="relative border-y border-white/[0.07] bg-[#08080D] py-6 md:py-8 overflow-hidden select-none">
      <div className="flex w-max animate-marquee-drift hover:[animation-play-state:paused]">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
