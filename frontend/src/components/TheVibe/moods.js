export const MOODS = [
  {
    id: "melancholy",
    label: "Melancholy",
    energy: 0.15,
    valence: 0.12,
    glow: "#6366F1",
    glow2: "#1E1B4B",
    desc: "Reverbed piano, minor pads, atmospheric hum",
    freq: 110,
    track: { title: "Echoes in Rain", artist: "Noir Strings", bpm: "60 BPM", key: "C Minor" },
  },
  {
    id: "chill",
    label: "Chill",
    energy: 0.2,
    valence: 0.68,
    glow: "#A855F7",
    glow2: "#3B82F6",
    desc: "Warm keys, lo-fi vinyl, slow sub-bass drift",
    freq: 123,
    track: { title: "Sunset Velvet", artist: "Aura Frequency", bpm: "74 BPM", key: "Db Major" },
  },
  {
    id: "focus",
    label: "Focus",
    energy: 0.46,
    valence: 0.8,
    glow: "#2DD4BF",
    glow2: "#0284C7",
    desc: "Deep flow, ambient textures, binaural precision",
    freq: 147,
    track: { title: "Synaptic Drift", artist: "Komorebi Lab", bpm: "86 BPM", key: "A Minor" },
  },
  {
    id: "late-night",
    label: "Late Night",
    energy: 0.52,
    valence: 0.3,
    glow: "#10B981",
    glow2: "#064E3B",
    desc: "Deep grooves, dark club intimacy",
    freq: 98,
    track: { title: "3AM Transmissions", artist: "Sub-Zero Audio", bpm: "122 BPM", key: "E Minor" },
  },
  {
    id: "euphoric",
    label: "Euphoric",
    energy: 0.8,
    valence: 0.88,
    glow: "#F59E0B",
    glow2: "#EC4899",
    desc: "Synth arpeggios, vocal swells, climax hooks",
    freq: 165,
    track: { title: "Solar Horizon", artist: "Lumina", bpm: "128 BPM", key: "G Major" },
  },
  {
    id: "hype",
    label: "Hype",
    energy: 0.93,
    valence: 0.58,
    glow: "#FF2A6D",
    glow2: "#FF758C",
    desc: "High-octane basslines, kinetic percussion",
    freq: 185,
    track: { title: "Neon Overdrive", artist: "Vektroid X", bpm: "142 BPM", key: "F# Major" },
  },
];

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const moodById = (id) => MOODS.find((m) => m.id === id) || null;

export function nearestMood(x, y) {
  let best = MOODS[0];
  let bd = Infinity;
  for (const m of MOODS) {
    const d = (m.energy - x) ** 2 + (m.valence - y) ** 2;
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

export function blendMoods(x, y) {
  let a = MOODS[0];
  let b = MOODS[1];
  let da = Infinity;
  let db = Infinity;
  for (const m of MOODS) {
    const d = Math.hypot(m.energy - x, m.valence - y);
    if (d < da) {
      b = a;
      db = da;
      a = m;
      da = d;
    } else if (d < db) {
      b = m;
      db = d;
    }
  }
  const t = da + db === 0 ? 0 : clamp01(da / (da + db));
  return { a, b, t };
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function lerpHex(h1, h2, t) {
  const c1 = hexToRgb(h1);
  const c2 = hexToRgb(h2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function hexAlpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
