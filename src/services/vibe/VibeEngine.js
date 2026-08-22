import {
  getArtistsByIds,
  getAudioFeaturesByTrackIds,
  getCurrentPlayback,
  getPlaybackQueue,
  getPlaylistTrackCandidates,
  getRecentlyPlayedTrackEvents,
  getRecentlyPlayedTracks,
  getSavedTracks,
  getSpotifyRecommendations,
  getUserTopTracks
} from "../../utils/spotify.js";
import { embeddingSimilarity01, getTrackEmbedding, getTrackEmbeddings } from "./audioSimilarity.js";

// How many top candidates (by cheap feature-based score) get the expensive
// audio-embedding similarity pass. Keeps latency bounded — embeddings are cached
// per trackId afterward, so repeat requests for the same candidates are instant.
const EMBEDDING_SHORTLIST_SIZE = 22;

const DISCOVERY_FRESH_WINDOW_MS = 4 * 60 * 60 * 1000;

const BPM_FIT_FALLBACK = 4;   // tempo unknown for one/both tracks — mildly positive-of-
                               // center, matching every other missing-data fallback in
                               // this file (never punish a candidate for data we lack)
const BPM_COMFORT_PCT = 4;    // beatmatchable with no pitch-bend
const BPM_STRETCH_PCT = 12;   // needs pitch-bend (typical DJ gear: ±8-10%) or sits at the
                               // edge of a half/double-tempo read
const BPM_FIT_MAX = 26;       // at 0% diff — on par with a strong embeddingFit
const BPM_FIT_MID = 14;       // at BPM_COMFORT_PCT
const BPM_FIT_LOW = -6;       // at BPM_STRETCH_PCT
const BPM_FIT_FLOOR = -20;    // hard floor beyond stretch range

const SPOTIFY_SEED_GENRE_POOL = [
  "pop",
  "rock",
  "dance",
  "house",
  "techno",
  "hip-hop",
  "r-n-b",
  "indie",
  "ambient",
  "electronic",
  "latin",
  "reggaeton",
  "funk",
  "soul",
  "jazz",
  "edm",
  "acoustic",
  "country",
  "metal",
  "alternative",
  "indie-pop",
  "deep-house",
  "progressive-house",
  "chill",
  "groove",
  "synth-pop",
  "k-pop",
  "world-music"
];

const TRANSITION_KINDS = ["power_cut", "slow_merge", "drop_in"];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Internal scoring stays conservative (many penalties); map to a public 0–100 that
 * reads like “match quality” — strong picks land high 80s / 90s.
 */
function toPublicVibeMatchPercent(rawScore) {
  const x = clamp(Number(rawScore) || 0, 0, 100);
  const y = 85 + (x - 36) * 0.42;
  return Math.round(clamp(y, 72, 99));
}

function toBpmBucket(tempo) {
  const value = Number(tempo);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const start = Math.floor(value / 10) * 10;
  return `${start}-${start + 9}`;
}

// Camelot wheel numbers by pitch class (0=C .. 11=B), indexed for major (B) and minor (A) modes.
const MAJOR_CAMELOT_NUMBER = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const MINOR_CAMELOT_NUMBER = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

function keyModeToCamelot(key, mode) {
  if (!Number.isInteger(key) || key < 0 || key > 11 || (mode !== 0 && mode !== 1)) {
    return null;
  }
  const num = mode === 1 ? MAJOR_CAMELOT_NUMBER[key] : MINOR_CAMELOT_NUMBER[key];
  const letter = mode === 1 ? "B" : "A";
  return { num, letter, code: `${num}${letter}` };
}

// Heuristic harmonic-mixing compatibility (Camelot wheel adjacency), 0..1.
function camelotCompatibilityScore(a, b) {
  if (!a || !b) {
    return 0.5;
  }
  if (a.num === b.num && a.letter === b.letter) {
    return 1;
  }
  if (a.num === b.num && a.letter !== b.letter) {
    return 0.88;
  }
  const diff = Math.min(Math.abs(a.num - b.num), 12 - Math.abs(a.num - b.num));
  if (diff === 1) {
    return a.letter === b.letter ? 0.78 : 0.55;
  }
  if (diff === 2) {
    return a.letter === b.letter ? 0.4 : 0.3;
  }
  return 0.25;
}

function dedupeByUri(tracks) {
  const seen = new Set();
  const output = [];
  for (const track of tracks) {
    if (!track?.uri || seen.has(track.uri)) {
      continue;
    }
    seen.add(track.uri);
    output.push(track);
  }
  return output;
}

function stableSessionRandom01(sessionId, salt) {
  let h = 2166136261;
  const s = `${String(sessionId ?? "")}::${salt}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function shuffleWithSessionSeed(items, sessionId, salt) {
  const arr = [...items];
  const seed = stableSessionRandom01(sessionId, salt);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j =
      Math.floor((stableSessionRandom01(sessionId, `${salt}:${i}`) + seed) * (i + 1)) %
      (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeGenreToSeedToken(g) {
  return String(g ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseYearFromAlbum(playbackItem) {
  const raw = String(playbackItem?.album?.release_date ?? "").trim();
  const m = raw.match(/^(\d{4})/);
  return m?.[1] ? Number(m[1]) : null;
}

/** Half-window in years from current; null = no era filter (nostalgia ~0). */
function computeEraYearBounds(currentYear, nostalgiaSlider) {
  if (!Number.isFinite(currentYear)) {
    return null;
  }
  const n = clamp(Number(nostalgiaSlider) ?? 50, 0, 100);
  if (n <= 2) {
    return null;
  }
  const halfWindow = Math.round(3 + ((100 - n) / 100) * 27);
  return {
    minY: currentYear - halfWindow,
    maxY: currentYear + halfWindow,
    halfWindow
  };
}

function formatEraBadgeLabel(year) {
  if (!Number.isFinite(year)) {
    return "Unknown era";
  }
  const decade = Math.floor(year / 10) * 10;
  let flavor = "Classic";
  if (decade < 1980) {
    flavor = "Warm Vinyl";
  } else if (decade < 2000) {
    flavor = "Vintage";
  } else if (decade >= 2020) {
    flavor = "Now";
  }
  return `${decade}s ${flavor}`;
}

function computeEraAlignmentPercent(currentYear, candidateYear) {
  if (!Number.isFinite(currentYear) || !Number.isFinite(candidateYear)) {
    return null;
  }
  const d = Math.abs(candidateYear - currentYear);
  if (d <= 3) {
    return Math.round(100 - d * 6);
  }
  return Math.max(0, Math.round(82 - (d - 3) * 3.5));
}

function filterDiscoveryByTemporalRules(tracks, currentYear, nostalgiaSlider) {
  const bounds = computeEraYearBounds(currentYear, nostalgiaSlider);
  return tracks.filter((t) => {
    if (bounds) {
      const y = t.releaseYear;
      if (!Number.isFinite(y)) {
        return false;
      }
      if (y < bounds.minY || y > bounds.maxY) {
        return false;
      }
    }
    return true;
  });
}

function needsLargeEraGapTransition(current, queueNext) {
  const cy = current?.releaseYear;
  const ny = queueNext?.releaseYear;
  if (!Number.isFinite(cy) || !Number.isFinite(ny)) {
    return false;
  }
  const dec = (y) => Math.floor(Number(y) / 10);
  return Math.abs(dec(cy) - dec(ny)) >= 3 || Math.abs(cy - ny) >= 28;
}

function pickEraGapBridgeCandidate(candidates, current, queueNext) {
  if (!needsLargeEraGapTransition(current, queueNext)) {
    return null;
  }
  const cy = Number(current.releaseYear);
  const ny = Number(queueNext.releaseYear);
  const low = Math.min(cy, ny);
  const high = Math.max(cy, ny);
  const mid = (cy + ny) / 2;
  let targetMin;
  let targetMax;
  if (high - low > 35) {
    targetMin = 1990;
    targetMax = 2009;
  } else {
    targetMin = Math.round(mid) - 8;
    targetMax = Math.round(mid) + 8;
  }
  const pool = candidates.filter((c) => c.source === "discovery_recommendation");
  const t0 = Number(current.tempo);
  const t1 = Number(queueNext.tempo);
  const tempoMid =
    Number.isFinite(t0) && Number.isFinite(t1) && t0 > 0 && t1 > 0 ? (t0 + t1) / 2 : null;

  let best = null;
  let bestScore = Infinity;
  for (const c of pool) {
    if (!c?.uri || c.uri === queueNext.uri) {
      continue;
    }
    const y = c.releaseYear;
    if (!Number.isFinite(y) || y < targetMin || y > targetMax) {
      continue;
    }
    const ct = Number(c.tempo);
    if (Number.isFinite(tempoMid) && Number.isFinite(ct)) {
      if (Math.abs(ct - tempoMid) > 14) {
        continue;
      }
    }
    const eraDist = Math.abs(y - mid);
    const tempoDist =
      Number.isFinite(tempoMid) && Number.isFinite(ct) ? Math.abs(ct - tempoMid) : 0;
    const s = eraDist * 0.35 + tempoDist;
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

function pickBridgeCandidate(candidates, current, queueNext) {
  const t0 = Number(current?.tempo);
  const t1 = Number(queueNext?.tempo);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t0 <= 0 || t1 <= 0) {
    return null;
  }
  const gap = Math.abs(t0 - t1);
  if (gap <= 20) {
    return null;
  }
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  const mid = (t0 + t1) / 2;
  const pool = candidates.filter((c) => c.source === "discovery_recommendation");
  let best = null;
  let bestScore = Infinity;
  for (const c of pool) {
    if (!c?.uri || c.uri === queueNext.uri) {
      continue;
    }
    const ct = Number(c.tempo);
    if (!Number.isFinite(ct)) {
      continue;
    }
    const inBand = ct >= lo - 2 && ct <= hi + 2;
    const dist = Math.abs(ct - mid);
    const s = inBand ? dist : dist + 55;
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

function buildAdvancedTransitionPlan({
  sessionId,
  currentTrack,
  nextTrack,
  entryPointBase,
  remixModeEnabled,
  nostalgiaSlider = 50
}) {
  const pick = Math.floor(stableSessionRandom01(sessionId, "trans-kind") * 3) % 3;
  let transitionKind = TRANSITION_KINDS[pick];

  const cE = Number(currentTrack.energy);
  const nE = Number(nextTrack.energy);
  let highEnergy = cE > 0.65 && nE > 0.65;
  const cBpm = Number(currentTrack.tempo);
  const nBpm = Number(nextTrack.tempo);
  const bpmDelta =
    Number.isFinite(cBpm) && Number.isFinite(nBpm) && cBpm > 0 && nBpm > 0
      ? Math.abs(cBpm - nBpm)
      : null;

  const cY = currentTrack.releaseYear;
  const nY = nextTrack.releaseYear;
  let eraRemixNote = "";

  if (
    remixModeEnabled &&
    Number.isFinite(cY) &&
    Number.isFinite(nY) &&
    Number(nostalgiaSlider) >= 25
  ) {
    const both70s = cY >= 1970 && cY <= 1979 && nY >= 1970 && nY <= 1979;
    const bothModern = cY >= 2010 && nY >= 2010;
    if (both70s) {
      transitionKind = "slow_merge";
      highEnergy = false;
      eraRemixNote = "70s warmth · long crossfade";
    } else if (bothModern) {
      transitionKind = "power_cut";
      highEnergy = true;
      eraRemixNote = "modern pop · punch cut";
    }
  }

  const currentCamelot = keyModeToCamelot(currentTrack.key, currentTrack.mode);
  const nextCamelot = keyModeToCamelot(nextTrack.key, nextTrack.mode);
  const harmonicCompatibility = camelotCompatibilityScore(currentCamelot, nextCamelot);
  const harmonicKnown = Boolean(currentCamelot && nextCamelot);

  if (!eraRemixNote && harmonicKnown) {
    if (harmonicCompatibility >= 0.85) {
      transitionKind = "slow_merge";
    } else if (harmonicCompatibility <= 0.3 && highEnergy) {
      transitionKind = "power_cut";
    }
  }

  let transitionWindowMs = highEnergy ? 2000 : 6000;
  if (transitionKind === "power_cut") {
    transitionWindowMs = 400;
  } else if (transitionKind === "slow_merge") {
    transitionWindowMs = highEnergy ? 3500 : 6000;
  } else {
    transitionWindowMs = highEnergy ? 1800 : 5200;
  }

  if (remixModeEnabled && eraRemixNote.startsWith("70s")) {
    transitionWindowMs = Math.max(transitionWindowMs, 5600);
  } else if (remixModeEnabled && eraRemixNote.startsWith("modern")) {
    transitionWindowMs = Math.min(transitionWindowMs, 500);
  }

  let recommendedOffsetMs = entryPointBase.recommendedOffsetMs;
  let recommendedOffsetSeconds = entryPointBase.recommendedOffsetSeconds;
  if (transitionKind === "drop_in") {
    const dur = Number(nextTrack.durationMs) || 0;
    const chorusish = dur > 0 ? Math.round(Math.min(dur * 0.42, dur - 12000)) : recommendedOffsetMs;
    recommendedOffsetMs = Math.max(recommendedOffsetMs, chorusish);
    recommendedOffsetSeconds = Math.round(recommendedOffsetMs / 1000);
  }

  const smoothFadeDurationMs = clamp(Math.round(transitionWindowMs), 200, 6200);

  const l1 = currentTrack.loudness;
  const l2 = nextTrack.loudness;
  let volumeNormalizationPercentDelta = 0;
  if (Number.isFinite(l1) && Number.isFinite(l2)) {
    volumeNormalizationPercentDelta = clamp(Math.round((l1 - l2) * 0.65), -14, 14);
  }

  const warmEra = eraRemixNote.startsWith("70s");
  const mockDuckProfile = {
    outgoingEndRatio:
      transitionKind === "power_cut" ? 0.12 : warmEra ? 0.38 : 0.28,
    incomingStartRatio: warmEra ? 0.28 : 0.22,
    fadeAsymmetric: transitionKind !== "slow_merge"
  };

  const harmonicLabel = !harmonicKnown
    ? null
    : harmonicCompatibility >= 0.85
      ? "harmonic match"
      : harmonicCompatibility >= 0.6
        ? "compatible keys"
        : harmonicCompatibility >= 0.4
          ? "neutral keys"
          : "key clash";

  const strategy = `${transitionKind.replace(/_/g, " ")} · ${Math.round(
    transitionWindowMs / 1000
  )}s window${
    bpmDelta !== null ? ` · Δ${Math.round(bpmDelta)} BPM` : ""
  }${
    volumeNormalizationPercentDelta !== 0
      ? ` · loudness Δ ${volumeNormalizationPercentDelta > 0 ? "+" : ""}${volumeNormalizationPercentDelta}%`
      : ""
  } · mock EQ via duck${eraRemixNote ? ` · ${eraRemixNote}` : ""}${
    harmonicLabel ? ` · ${harmonicLabel} (${currentCamelot.code}→${nextCamelot.code})` : ""
  }`;

  return {
    transitionKind,
    transitionLabel:
      transitionKind === "power_cut"
        ? "The Power Cut"
        : transitionKind === "slow_merge"
          ? "The Slow Merge"
          : "The Drop-In",
    transitionWindowMs,
    crossfadeDurationMs: smoothFadeDurationMs,
    smoothFadeDurationMs,
    bpmComparison: {
      currentBpm: Number.isFinite(cBpm) ? cBpm : null,
      nextBpm: Number.isFinite(nBpm) ? nBpm : null,
      deltaBpm: bpmDelta
    },
    harmonicMatch: {
      currentCamelotKey: currentCamelot?.code ?? null,
      nextCamelotKey: nextCamelot?.code ?? null,
      compatibilityPercent: harmonicKnown ? Math.round(harmonicCompatibility * 100) : null,
      compatibilityLabel: harmonicLabel
    },
    mockDuckProfile,
    volumeNormalizationPercentDelta,
    recommendedOffsetMs,
    recommendedOffsetSeconds,
    eraRemixNote: eraRemixNote || null,
    strategy: remixModeEnabled
      ? `Remix mode: ${strategy}`
      : strategy
  };
}

function primaryArtistId(track) {
  return track?.artists?.[0]?.id ?? null;
}

const REGION_GENRE_HINTS = {
  US: ["hip hop", "pop", "country", "r&b"],
  GB: ["grime", "uk garage", "dance", "house"],
  BR: ["brazil", "funk", "sertanejo", "bossa"],
  IN: ["bollywood", "desi", "indian"],
  MX: ["latin", "reggaeton", "regional mexican"],
  DE: ["techno", "house", "electronic"],
  FR: ["french", "electro", "rap"],
  JP: ["j-pop", "city pop", "anime"]
};

function inferSeedGenreToken(raw) {
  const allowed = new Set(SPOTIFY_SEED_GENRE_POOL);
  const direct = normalizeGenreToSeedToken(raw);
  if (direct && allowed.has(direct)) {
    return direct;
  }
  const s = String(raw ?? "").toLowerCase();
  const rules = [
    [/metal|thrash|death|black|grindcore/, "metal"],
    [/punk|grunge|hardcore/, "alternative"],
    [/classic rock|hard rock|southern rock|arena rock|album rock|roots rock/, "rock"],
    [/\brock\b|rock\s*&\s*roll/, "rock"],
    [/country|bluegrass|americana/, "country"],
    [/soul|gospel|motown/, "soul"],
    [/funk/, "funk"],
    [/r&b|rnb/, "r-n-b"],
    [/hip hop|hip-hop|rap|trap/, "hip-hop"],
    [/jazz|bebop|swing/, "jazz"],
    [/edm|brostep|dubstep/, "edm"],
    [/deep house|garage|uk garage/, "deep-house"],
    [/house/, "house"],
    [/techno|trance|drum\s*&\s*bass|dnb/, "techno"],
    [/indie pop/, "indie-pop"],
    [/indie/, "indie"],
    [/acoustic|folk|singer-songwriter/, "acoustic"],
    [/ambient|chill|lo-?fi|downtempo/, "ambient"],
    [/latin|reggaeton|salsa|cumbia/, "latin"],
    [/synth-pop|synthpop/, "synth-pop"],
    [/k-pop|kpop/, "k-pop"],
    [/dance/, "dance"],
    [/pop/, "pop"]
  ];
  for (const [re, token] of rules) {
    if (re.test(s) && allowed.has(token)) {
      return token;
    }
  }
  return null;
}

// Only derives seeds from the seed artists' own Spotify genre tags — never guesses.
// Region ("user is in the US") says nothing about what THIS song sounds like, and a
// fabricated genre seed (e.g. "country") gets sent straight into Spotify's own
// /recommendations call, which then returns genre-mismatched candidates that the
// scoring pass can't reliably filter back out (genreSimilarityScore is neutral, not
// penalizing, when tags are thin). When the artist has no usable genre tags — common
// for genre-blending/indie artists — this returns an empty array, and the discovery
// call below simply omits seed_genres and leans on the track/artist seeds instead.
function buildCoherentGenreSeeds(artistGenreList, sessionId) {
  const out = [];
  for (const g of artistGenreList ?? []) {
    const t = inferSeedGenreToken(g);
    if (t && !out.includes(t)) {
      out.push(t);
    }
    if (out.length >= 3) {
      break;
    }
  }
  return shuffleWithSessionSeed(out, sessionId, "coherent-genre").slice(0, 2);
}

async function fetchDiscoveryRecommendationGrid(
  accessToken,
  {
    seedTrackIds,
    seedArtistIds,
    coherentGenreSeeds,
    sessionId,
    currentTempo,
    currentReleaseYear,
    nostalgiaSlider,
    currentFeatures
  }
) {
  const tempoSync =
    Number.isFinite(currentTempo) && currentTempo > 0 && Number(nostalgiaSlider) >= 40;
  const tempoExtra = tempoSync
    ? {
        min_tempo: Math.max(40, Math.round((currentTempo - 5) * 10) / 10),
        max_tempo: Math.min(220, Math.round((currentTempo + 5) * 10) / 10)
      }
    : {};

  const artists = seedArtistIds.filter(Boolean).slice(0, 2);
  // No fabricated fallback here either — an empty seedGenres just means the
  // /recommendations call below leans on seedTrackIds/seedArtistIds instead,
  // which is always safe since we always have at least a current-track seed.
  const seedGenres = (coherentGenreSeeds ?? []).filter(Boolean).slice(0, 2);

  const cf = currentFeatures ?? {};
  const narrow = {};
  const e = Number(cf.energy);
  if (Number.isFinite(e)) {
    narrow.target_energy = round1(clamp(e, 0, 1));
    narrow.min_energy = round1(clamp(e - 0.14, 0, 1));
    narrow.max_energy = round1(clamp(e + 0.14, 0, 1));
  }
  const ac = Number(cf.acousticness);
  if (Number.isFinite(ac)) {
    narrow.target_acousticness = round1(clamp(ac, 0, 1));
    narrow.min_acousticness = round1(clamp(ac - 0.16, 0, 1));
    narrow.max_acousticness = round1(clamp(ac + 0.16, 0, 1));
  }
  const d = Number(cf.danceability);
  if (Number.isFinite(d)) {
    narrow.target_danceability = round1(clamp(d, 0, 1));
    narrow.min_danceability = round1(clamp(d - 0.14, 0, 1));
    narrow.max_danceability = round1(clamp(d + 0.14, 0, 1));
  }
  const v = Number(cf.valence);
  if (Number.isFinite(v)) {
    narrow.target_valence = round1(clamp(v, 0, 1));
    narrow.min_valence = round1(clamp(v - 0.12, 0, 1));
    narrow.max_valence = round1(clamp(v + 0.12, 0, 1));
  }
  if (Object.keys(narrow).length === 0) {
    narrow.target_energy = 0.48;
    narrow.min_energy = 0.28;
    narrow.max_energy = 0.72;
  }

  const baseParams = { ...narrow, ...tempoExtra };

  const results = await Promise.allSettled([
    getSpotifyRecommendations(accessToken, {
      seedTrackIds,
      seedArtistIds: artists,
      seedGenres,
      limit: 50,
      extraQueryParams: { ...baseParams, target_popularity: 46 }
    }),
    getSpotifyRecommendations(accessToken, {
      seedTrackIds,
      seedArtistIds: artists,
      seedGenres,
      limit: 50,
      extraQueryParams: { ...baseParams, target_popularity: 62 }
    })
  ]);

  const merged = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      merged.push(...r.value);
    } else {
      // Spotify restricted /recommendations (along with /audio-features and
      // /audio-analysis) to apps with Extended Quota Mode in Nov 2024. A dev-mode
      // app without that grant gets a 403 here on every call, silently degrading
      // discovery to whatever weak fallback candidates remain — worth surfacing.
      console.error("[VibeEngine] /recommendations call failed:", r.reason?.message ?? r.reason);
    }
  }

  let tagged = dedupeByUri(
    merged.map((t) => ({
      ...t,
      source: "discovery_recommendation"
    }))
  );

  tagged = filterDiscoveryByTemporalRules(tagged, currentReleaseYear, nostalgiaSlider);

  if (tagged.length < 12 && Number(nostalgiaSlider) > 5) {
    const relaxed = dedupeByUri(
      merged.map((t) => ({
        ...t,
        source: "discovery_recommendation"
      }))
    );
    tagged = filterDiscoveryByTemporalRules(relaxed, currentReleaseYear, 8);
  }

  if (tagged.length === 0 && merged.length > 0) {
    tagged = dedupeByUri(
      merged.map((t) => ({
        ...t,
        source: "discovery_recommendation"
      }))
    );
  }

  return shuffleWithSessionSeed(tagged, sessionId, "discovery-shuffle");
}

const CHILL_GENRE_HINTS = ["acoustic", "chill", "lofi", "indie", "folk", "ambient"];
const HEAT_GENRE_HINTS = ["dance", "house", "edm", "summer", "latin", "reggaeton", "party"];

// Where a candidate came from must not decide ranking — musical similarity does.
// "discovery_recommendation" is Spotify's own collaborative-filtering /recommendations
// endpoint; it's only used here to widen the candidate pool, so it gets no edge over
// tracks pulled from the user's own library/history. Kept nearly flat on purpose.
function sourceBonus(source) {
  if (source === "library_saved" || source === "library_playlist") {
    return 3;
  }
  if (source === "history_recent" || source === "top_track") {
    return 2.5;
  }
  if (source === "queue") {
    return 2;
  }
  if (source === "discovery_recommendation" || source === "recommendation") {
    return 1;
  }
  if (source === "affinity_search") {
    return 1;
  }
  return 1;
}

// Finds the closest tempo alignment between two tracks, treating exact half/double
// tempo as an equally valid DJ match (90 and 180 BPM mix as cleanly as 90 and 90).
// Returns the raw BPM gap AND the reference tempo that comparison was made against,
// so the percentage is scaled correctly regardless of which octave matched.
function computeTempoAlignment(currentTempo, candidateTempo) {
  if (
    !Number.isFinite(currentTempo) ||
    !Number.isFinite(candidateTempo) ||
    currentTempo <= 0 ||
    candidateTempo <= 0
  ) {
    return null;
  }
  const options = [
    { distance: Math.abs(currentTempo - candidateTempo), reference: Math.max(currentTempo, candidateTempo) },
    { distance: Math.abs(currentTempo - candidateTempo * 2), reference: Math.max(currentTempo, candidateTempo * 2) },
    { distance: Math.abs(currentTempo * 2 - candidateTempo), reference: Math.max(currentTempo * 2, candidateTempo) }
  ];
  return options.reduce((best, option) => (option.distance < best.distance ? option : best));
}

function computeTempoDiffPercent(currentTempo, candidateTempo) {
  const alignment = computeTempoAlignment(currentTempo, candidateTempo);
  return alignment ? (alignment.distance / alignment.reference) * 100 : null;
}

function computeBpmFit(tempoDiffPercent) {
  if (tempoDiffPercent === null) {
    return BPM_FIT_FALLBACK;
  }
  if (tempoDiffPercent <= BPM_COMFORT_PCT) {
    return BPM_FIT_MAX - tempoDiffPercent * ((BPM_FIT_MAX - BPM_FIT_MID) / BPM_COMFORT_PCT);
  }
  if (tempoDiffPercent <= BPM_STRETCH_PCT) {
    return BPM_FIT_MID - (tempoDiffPercent - BPM_COMFORT_PCT) *
      ((BPM_FIT_MID - BPM_FIT_LOW) / (BPM_STRETCH_PCT - BPM_COMFORT_PCT));
  }
  return Math.max(BPM_FIT_FLOOR, BPM_FIT_LOW - (tempoDiffPercent - BPM_STRETCH_PCT) * 1.75);
}

function includesAnyGenre(genreTags, hints) {
  const genres = Array.isArray(genreTags) ? genreTags : [];
  return genres.some((genre) =>
    hints.some((hint) => String(genre).toLowerCase().includes(hint))
  );
}

/**
 * 0..1 genre-hierarchy match: exact microgenre overlap counts most, shared parent
 * genre (e.g. "death metal" and "black metal" both roll up to "metal") counts partially.
 */
function genreSimilarityScore(currentGenres, candidateGenres) {
  const a = new Set((currentGenres ?? []).map((g) => String(g).toLowerCase()));
  const b = new Set((candidateGenres ?? []).map((g) => String(g).toLowerCase()));
  if (a.size === 0 || b.size === 0) {
    return null;
  }

  let exactOverlap = 0;
  for (const genre of a) {
    if (b.has(genre)) {
      exactOverlap += 1;
    }
  }
  const union = new Set([...a, ...b]).size;
  const exactJaccard = union > 0 ? exactOverlap / union : 0;

  const parentA = new Set([...a].map((g) => inferSeedGenreToken(g)).filter(Boolean));
  const parentB = new Set([...b].map((g) => inferSeedGenreToken(g)).filter(Boolean));
  let parentOverlap = 0;
  for (const token of parentA) {
    if (parentB.has(token)) {
      parentOverlap += 1;
    }
  }
  const parentUnion = new Set([...parentA, ...parentB]).size;
  const parentJaccard = parentUnion > 0 ? parentOverlap / parentUnion : 0;

  return clamp(exactJaccard * 0.7 + parentJaccard * 0.3, 0, 1);
}

function normalizeUserContext(rawContext = {}) {
  const timezone = String(rawContext.timezone ?? "").trim();
  const countryCode = String(rawContext.countryCode ?? "")
    .trim()
    .toUpperCase();
  const weather = String(rawContext.weather ?? "")
    .trim()
    .toLowerCase();
  const gender = String(rawContext.gender ?? "unspecified")
    .trim()
    .toLowerCase();
  const moodLevel = clamp(Number(rawContext.moodLevel ?? 50), 0, 100);
  const accountAgeYears = Math.max(0, Number(rawContext.accountAgeYears ?? 0));
  const ageRaw = Number(rawContext.age);
  const age = Number.isFinite(ageRaw) && ageRaw > 0 ? Math.round(ageRaw) : null;
  const tempC = Number(rawContext.tempC);
  const localHourRaw = Number(rawContext.localHour);
  const localHour = Number.isFinite(localHourRaw)
    ? clamp(Math.round(localHourRaw), 0, 23)
    : new Date().getHours();

  const nostalgiaSlider = clamp(Number(rawContext.nostalgiaSlider ?? 50), 0, 100);
  const seasonVibe = String(rawContext.seasonVibe ?? "").trim();

  return {
    timezone: timezone || null,
    countryCode: countryCode || null,
    weather: weather || "clear",
    gender,
    age,
    moodLevel,
    nostalgiaSlider,
    accountAgeYears: Number.isFinite(accountAgeYears) ? accountAgeYears : 0,
    tempC: Number.isFinite(tempC) ? tempC : null,
    localHour,
    seasonVibe: seasonVibe || null
  };
}

function getAffinityBoost(candidate, searchAffinity) {
  const terms = searchAffinity?.termWeights ?? {};
  const artistTerms = searchAffinity?.artistTermWeights ?? {};

  const searchable = [
    candidate?.name ?? "",
    ...(candidate?.artistNames ?? []),
    candidate?.albumName ?? "",
    ...(candidate?.genreTags ?? [])
  ]
    .join(" ")
    .toLowerCase();

  let boost = 0;
  for (const [term, weight] of Object.entries(terms)) {
    if (term && searchable.includes(term)) {
      boost += Number(weight) || 0;
    }
  }
  for (const [term, weight] of Object.entries(artistTerms)) {
    if (term && searchable.includes(term)) {
      boost += (Number(weight) || 0) * 1.2;
    }
  }
  return Math.min(20, boost);
}

function getContextSignalAdjustment(candidate, context, musicalScore) {
  const userContext = context.userContext;
  const adjustments = {
    weatherRainValenceBoost: 0,
    temperatureMoodBoost: 0,
    locationBoost: 0,
    nostalgiaBoost: 0,
    dayPartBoost: 0,
    moodBoost: 0
  };
  const logicLog = [];

  const wx = userContext.weather;
  const rainyMood =
    wx.includes("rain") ||
    wx.includes("drizzle") ||
    wx.includes("shower") ||
    wx.includes("thunderstorm");
  if (rainyMood && Number(candidate.valence) <= 0.45) {
    const rainyBoost = Math.min(8, musicalScore * 0.1);
    adjustments.weatherRainValenceBoost += rainyBoost;
    logicLog.push(`Boosted ${candidate.name} by ${Math.round(rainyBoost)} due to rainy low-valence match.`);
  }

  if (Number.isFinite(userContext.tempC)) {
    if (userContext.tempC < 15) {
      if ((Number(candidate.energy) || 0) < 0.55 || includesAnyGenre(candidate.genreTags, CHILL_GENRE_HINTS)) {
        adjustments.temperatureMoodBoost += 2.4;
        logicLog.push(`Boosted ${candidate.name} for cool weather chill fit (${Math.round(userContext.tempC)}°C).`);
      }
    } else if (userContext.tempC > 25) {
      if ((Number(candidate.energy) || 0) > 0.72 || includesAnyGenre(candidate.genreTags, HEAT_GENRE_HINTS)) {
        adjustments.temperatureMoodBoost += 2.6;
        logicLog.push(`Boosted ${candidate.name} for warm weather energy fit (${Math.round(userContext.tempC)}°C).`);
      }
    }
  }

  if (userContext.countryCode && REGION_GENRE_HINTS[userContext.countryCode]) {
    const hints = REGION_GENRE_HINTS[userContext.countryCode];
    if (includesAnyGenre(candidate.genreTags, hints)) {
      adjustments.locationBoost += 1.8;
      logicLog.push(`Boosted ${candidate.name} by local region affinity (${userContext.countryCode}).`);
    }
  }

  if (userContext.accountAgeYears > 5 && Number.isFinite(candidate.releaseYear)) {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - userContext.accountAgeYears;
    const nearStartEra = Math.abs(candidate.releaseYear - startYear) <= 3;
    const sprinkleGate = (String(candidate.id ?? "").charCodeAt(0) || 0) % 3 === 0;
    if (nearStartEra && sprinkleGate) {
      adjustments.nostalgiaBoost += 1.7;
      logicLog.push(`Boosted ${candidate.name} by nostalgia factor (account age context).`);
    }
  }

  if (userContext.localHour >= 5 && userContext.localHour <= 10) {
    if ((Number(candidate.tempo) || 999) <= 108) {
      adjustments.dayPartBoost += 1.4;
      logicLog.push(`Boosted ${candidate.name} for morning lower-BPM preference.`);
    }
  } else if (userContext.localHour >= 21 || userContext.localHour <= 2) {
    if ((Number(candidate.danceability) || 0) >= 0.65) {
      adjustments.dayPartBoost += 1.6;
      logicLog.push(`Boosted ${candidate.name} for late-night danceability preference.`);
    }
  }

  if (userContext.moodLevel <= 35) {
    if ((Number(candidate.energy) || 1) <= 0.55) {
      adjustments.moodBoost += 2;
      logicLog.push(`Boosted ${candidate.name} for mellow mood setting.`);
    } else if ((Number(candidate.energy) || 0) >= 0.8) {
      adjustments.moodBoost -= 1.2;
    }
  } else if (userContext.moodLevel >= 65) {
    if ((Number(candidate.energy) || 0) >= 0.7 || (Number(candidate.danceability) || 0) >= 0.65) {
      adjustments.moodBoost += 2.2;
      logicLog.push(`Boosted ${candidate.name} for hype mood setting.`);
    } else if ((Number(candidate.energy) || 1) <= 0.45) {
      adjustments.moodBoost -= 1.1;
    }
  }

  // Gender and age are captured as context but not used for direct musical filtering — no
  // data source exists for "listeners like you" by age/gender, so faking it would be dishonest.
  if (userContext.gender && userContext.gender !== "unspecified") {
    logicLog.push(`Captured gender context (${userContext.gender}) for future personalization.`);
  }
  if (Number.isFinite(userContext.age)) {
    logicLog.push(`Captured age context (${userContext.age}) for future personalization.`);
  }

  const rawAdjustment = Object.values(adjustments).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );
  const cappedAdjustment = clamp(rawAdjustment, -8, 10);

  return {
    contextualAdjustment: round1(cappedAdjustment),
    contextSignalBreakdown: {
      weatherRainValenceBoost: round1(adjustments.weatherRainValenceBoost),
      temperatureMoodBoost: round1(adjustments.temperatureMoodBoost),
      locationBoost: round1(adjustments.locationBoost),
      nostalgiaBoost: round1(adjustments.nostalgiaBoost),
      dayPartBoost: round1(adjustments.dayPartBoost),
      moodBoost: round1(adjustments.moodBoost)
    },
    logicLog
  };
}

function scoreCandidate(candidate, context) {
  const currentTrack = context.currentTrack;
  const tempoDiffPercent = computeTempoDiffPercent(currentTrack.tempo, candidate.tempo);
  const energyGap =
    Number.isFinite(currentTrack.energy) && Number.isFinite(candidate.energy)
      ? Math.abs(currentTrack.energy - candidate.energy)
      : null;
  const durationGapSeconds = Math.abs(candidate.durationMs - currentTrack.durationMs) / 1000;
  const currentPopularity = Number(currentTrack.popularity ?? 50);
  const candidatePopularity = Number(candidate.popularity ?? 50);
  // Popularity/source/artist-name are tie-breakers only — kept intentionally small so they
  // can never outweigh the musical-similarity terms below (embeddings, genre, key, mood, etc).
  const popularityFit = Math.max(0, 3 - Math.abs(candidatePopularity - currentPopularity) * 0.05);
  const durationFit = Math.max(0, 6 - durationGapSeconds * 0.08);

  const bpmFit = computeBpmFit(tempoDiffPercent);

  const energyFit = energyGap === null ? 1 : Math.max(-5, 9 - energyGap * 18);
  const acGap =
    Number.isFinite(currentTrack.acousticness) && Number.isFinite(candidate.acousticness)
      ? Math.abs(currentTrack.acousticness - candidate.acousticness)
      : null;
  const acousticFit = acGap === null ? 1 : Math.max(-4, 7 - acGap * 20);
  const insGap =
    Number.isFinite(currentTrack.instrumentalness) &&
    Number.isFinite(candidate.instrumentalness)
      ? Math.abs(currentTrack.instrumentalness - candidate.instrumentalness)
      : null;
  const instrumentalFit = insGap === null ? 1 : Math.max(-4, 7 - insGap * 24);
  const speechGap =
    Number.isFinite(currentTrack.speechiness) && Number.isFinite(candidate.speechiness)
      ? Math.abs(currentTrack.speechiness - candidate.speechiness)
      : null;
  const vocalContinuityFit = speechGap === null ? 0 : Math.max(-4, 4 - speechGap * 16);

  const valenceGap =
    Number.isFinite(currentTrack.valence) && Number.isFinite(candidate.valence)
      ? Math.abs(currentTrack.valence - candidate.valence)
      : null;
  const moodFit = valenceGap === null ? 1 : Math.max(-6, 9 - valenceGap * 20);

  const loudnessGap =
    Number.isFinite(currentTrack.loudness) && Number.isFinite(candidate.loudness)
      ? Math.abs(currentTrack.loudness - candidate.loudness)
      : null;
  const productionFit = loudnessGap === null ? 0 : Math.max(-3, 3 - loudnessGap * 0.3);

  const currentCamelot = keyModeToCamelot(currentTrack.key, currentTrack.mode);
  const candidateCamelot = keyModeToCamelot(candidate.key, candidate.mode);
  const keyFit =
    currentCamelot && candidateCamelot
      ? (camelotCompatibilityScore(currentCamelot, candidateCamelot) - 0.5) * 18
      : 0;

  const genreSimilarity = genreSimilarityScore(currentTrack.genreTags, candidate.genreTags);
  const genreFit = genreSimilarity === null ? 0 : round1(clamp(genreSimilarity * 24 - 4, -6, 20));

  // Populated by the two-stage embedding pass (rankCandidatesWithEmbeddings); null for
  // candidates outside the embedding shortlist, in which case it simply contributes nothing
  // rather than penalizing tracks we just didn't have budget to fetch audio-analysis for.
  const embeddingFit =
    typeof candidate.embeddingSimilarity === "number"
      ? round1(clamp((candidate.embeddingSimilarity - 0.5) * 52, -26, 26))
      : 0;

  const artistContinuity =
    primaryArtistId(candidate) && primaryArtistId(candidate) === primaryArtistId(currentTrack)
      ? 4
      : 0;
  const explicitFit = candidate.explicit === currentTrack.explicit ? 4 : -1.5;
  const sourceFit = sourceBonus(candidate.source);
  const repeatPenalty = context.recentUris.has(candidate.uri) ? -18 : 0;
  const surfaceRepeatPenalty =
    context.recentSuggestedUrisSet && context.recentSuggestedUrisSet.has(candidate.uri)
      ? 36
      : 0;

  const trackPenalty = Number(context.sessionPenalty.skippedTrackPenalty[candidate.id] ?? 0);
  const artistPenalty = Math.max(
    0,
    ...(candidate.artists ?? []).map(
      (artist) => Number(context.sessionPenalty.artistPenalty[artist.id] ?? 0)
    )
  );
  const genrePenalty = Math.max(
    0,
    ...(candidate.genreTags ?? []).map((genre) =>
      Number(context.sessionPenalty.genrePenalty[genre] ?? 0)
    )
  );
  const bpmBucketPenalty = Number(
    context.sessionPenalty.bpmRangePenalty[toBpmBucket(candidate.tempo)] ?? 0
  );
  // Reflects the user's own in-session search behavior (not collaborative filtering),
  // but still capped low so it can only nudge, never override, musical similarity.
  const affinityBoost = Math.min(8, getAffinityBoost(candidate, context.searchAffinity));
  const historicalTrackCount = Number(
    context.sessionHistory.recommendedTrackCount[candidate.id] ?? 0
  );
  const historicalArtistCount = Math.max(
    0,
    ...(candidate.artists ?? []).map(
      (artist) =>
        Number(context.sessionHistory.recommendedArtistCount[artist.id] ?? 0)
    )
  );
  const journeyBoost = Math.max(0, 6 - historicalArtistCount * 1.6);
  const repetitionHistoryPenalty = Math.min(
    28,
    historicalTrackCount * 9 + historicalArtistCount * 2.8
  );

  const discoveryNovelty =
    context.recentHistoryUriSet === undefined
      ? 0
      : context.recentHistoryUriSet.has(candidate.uri)
        ? -4.5
        : 2.2;

  const musicalScoreRaw = round1(
    30 +
      embeddingFit +
      genreFit +
      keyFit +
      moodFit +
      bpmFit +
      energyFit +
      acousticFit +
      instrumentalFit +
      vocalContinuityFit +
      productionFit +
      artistContinuity +
      durationFit +
      popularityFit +
      explicitFit +
      sourceFit +
      affinityBoost +
      discoveryNovelty -
      repeatPenalty * -1 -
      surfaceRepeatPenalty -
      trackPenalty -
      artistPenalty -
      genrePenalty -
      bpmBucketPenalty -
      repetitionHistoryPenalty +
      journeyBoost
  );
  const musicalScore = clamp(musicalScoreRaw, 0, 100);

  const contextSignals = getContextSignalAdjustment(candidate, context, musicalScore);
  let total = clamp(
    round1(musicalScore + contextSignals.contextualAdjustment),
    0,
    100
  );
  // Unclamped counterpart of `total`, used only to rank candidates against each other.
  // `total` saturates at 100 once the non-BPM signals alone clear that ceiling, which would
  // otherwise erase bpmFit's (and every other term's) influence on ordering for exactly the
  // "already a great match, wrong tempo" candidates this is meant to distinguish between.
  let rankingScore = round1(musicalScoreRaw + contextSignals.contextualAdjustment);

  const nostalgiaN = clamp(
    Number(context.userContext?.nostalgiaSlider ?? 50) / 100,
    0,
    1
  );
  const cy = currentTrack.releaseYear;
  const y = candidate.releaseYear;
  const eraAlignmentPercent = computeEraAlignmentPercent(
    Number.isFinite(cy) ? cy : null,
    Number.isFinite(y) ? y : null
  );
  let eraMatchBoostApplied = false;
  if (
    Number.isFinite(cy) &&
    Number.isFinite(y) &&
    Math.abs(y - cy) <= 3 &&
    nostalgiaN > 0
  ) {
    total = clamp(round1(total * (1 + 0.15 * nostalgiaN)), 0, 100);
    rankingScore = round1(rankingScore * (1 + 0.15 * nostalgiaN));
    eraMatchBoostApplied = true;
  }

  return {
    score: total,
    rankingScore,
    musicalScore,
    temporalVibe: {
      currentReleaseYear: Number.isFinite(cy) ? cy : null,
      candidateReleaseYear: Number.isFinite(y) ? y : null,
      eraAlignmentPercent,
      eraMatchBoostApplied,
      eraLabel: Number.isFinite(y) ? formatEraBadgeLabel(y) : null
    },
    scoreBreakdown: {
      embeddingFit: round1(embeddingFit),
      embeddingSimilarity:
        typeof candidate.embeddingSimilarity === "number"
          ? round1(candidate.embeddingSimilarity)
          : null,
      genreFit: round1(genreFit),
      genreSimilarity: genreSimilarity === null ? null : round1(genreSimilarity),
      keyFit: round1(keyFit),
      moodFit: round1(moodFit),
      productionFit: round1(productionFit),
      vocalContinuityFit: round1(vocalContinuityFit),
      bpmFit: round1(bpmFit),
      energyFit: round1(energyFit),
      acousticFit: round1(acousticFit),
      instrumentalFit: round1(instrumentalFit),
      artistContinuity: round1(artistContinuity),
      durationFit: round1(durationFit),
      popularityFit: round1(popularityFit),
      explicitFit: round1(explicitFit),
      sourceFit: round1(sourceFit),
      affinityBoost: round1(affinityBoost),
      journeyBoost: round1(journeyBoost),
      repeatPenalty: round1(-Math.max(0, repeatPenalty * -1)),
      trackPenalty: round1(-trackPenalty),
      artistPenalty: round1(-artistPenalty),
      genrePenalty: round1(-genrePenalty),
      bpmBucketPenalty: round1(-bpmBucketPenalty),
      repetitionHistoryPenalty: round1(-repetitionHistoryPenalty),
      surfaceRepeatPenalty: round1(-surfaceRepeatPenalty),
      discoveryNovelty: round1(discoveryNovelty),
      contextualAdjustment: round1(contextSignals.contextualAdjustment),
      contextSignalBreakdown: contextSignals.contextSignalBreakdown
    },
    logicLog: contextSignals.logicLog,
    flowConfidence: total
  };
}

// Greedy next-hop scoring for smart-queue ordering: rewards close BPM, harmonic
// (Camelot wheel) key compatibility, and a gentle energy arc; penalizes artist repeats.
function computeFlowScore(anchor, candidate, usedArtistIds) {
  const tempoDiffPercent = computeTempoDiffPercent(anchor.tempo, candidate.tempo);
  const bpmFlowScore = tempoDiffPercent === null ? 5 : Math.max(-20, 20 - tempoDiffPercent * 1.8);

  const anchorCamelot = keyModeToCamelot(anchor.key, anchor.mode);
  const candidateCamelot = keyModeToCamelot(candidate.key, candidate.mode);
  const harmonicFlowScore = camelotCompatibilityScore(anchorCamelot, candidateCamelot) * 18;

  const energyGap =
    Number.isFinite(anchor.energy) && Number.isFinite(candidate.energy)
      ? Math.abs(anchor.energy - candidate.energy)
      : null;
  const energyFlowScore = energyGap === null ? 3 : Math.max(-10, 10 - energyGap * 22);

  const artistRepeatPenalty = (candidate.artists ?? []).some(
    (artist) => artist.id && usedArtistIds.has(artist.id)
  )
    ? -14
    : 0;

  const baseVibeScore = Number(candidate.rankingScore ?? candidate.score ?? 0) * 0.22;

  // If both tracks have an audio embedding attached (see rankCandidatesWithEmbeddings),
  // reward candidates whose timbral/harmonic "musical DNA" continues the anchor's.
  const embeddingFlowScore =
    anchor.embedding && candidate.embedding
      ? embeddingSimilarity01(anchor.embedding, candidate.embedding) * 20
      : 0;

  return round1(
    bpmFlowScore +
      harmonicFlowScore +
      energyFlowScore +
      artistRepeatPenalty +
      baseVibeScore +
      embeddingFlowScore
  );
}

/**
 * Two-stage ranking: score every candidate cheaply on audio-features/genre/etc, then fetch
 * real audio embeddings (chroma+timbre from /audio-analysis) for only the top N and re-score
 * those with embedding similarity folded in. Keeps embeddings — the dominant, most expensive
 * signal — bounded in cost while still driving the final ranking for the tracks that matter.
 */
async function rankCandidatesWithEmbeddings(
  accessToken,
  currentTrack,
  candidates,
  scoringContextBase,
  { shortlistSize = EMBEDDING_SHORTLIST_SIZE, attachEmbeddingVectors = false } = {}
) {
  const preliminary = candidates
    .map((candidate) => ({ ...candidate, ...scoreCandidate(candidate, scoringContextBase) }))
    .sort((a, b) => b.rankingScore - a.rankingScore);

  const shortlist = preliminary.slice(0, shortlistSize);
  const tail = preliminary.slice(shortlistSize);

  if (shortlist.length === 0 || !currentTrack?.id) {
    return preliminary;
  }

  const embeddingIds = [currentTrack.id, ...shortlist.map((c) => c.id).filter(Boolean)];
  const embeddingsById = await getTrackEmbeddings(accessToken, embeddingIds);
  const currentEmbedding = embeddingsById[currentTrack.id] ?? null;

  const rescored = shortlist.map((candidate) => {
    const candidateEmbedding = embeddingsById[candidate.id] ?? null;
    const similarity = embeddingSimilarity01(currentEmbedding, candidateEmbedding);
    const withEmbedding = {
      ...candidate,
      embeddingSimilarity: similarity,
      embedding: attachEmbeddingVectors ? candidateEmbedding : undefined
    };
    return { ...withEmbedding, ...scoreCandidate(withEmbedding, scoringContextBase) };
  });

  return [...rescored, ...tail].sort((a, b) => b.rankingScore - a.rankingScore);
}

function scoreEntryPoint(candidate, currentRemainingMs) {
  let offsetMs = 12000;
  if (candidate.durationMs < 180000) {
    offsetMs = 8000;
  } else if (candidate.durationMs > 300000) {
    offsetMs = 17000;
  }

  if (currentRemainingMs <= 20000) {
    offsetMs += 3000;
  }

  const capByDuration = Math.max(0, Math.min(45000, Math.round(candidate.durationMs * 0.35)));
  let clampedOffsetMs = clamp(Math.round(offsetMs), 0, capByDuration || 45000);

  const tempo = Number(candidate.tempo);
  if (Number.isFinite(tempo) && tempo >= 60 && tempo <= 220) {
    const beatMs = 60000 / tempo;
    const barMs = beatMs * 4;
    clampedOffsetMs = Math.max(0, Math.round(clampedOffsetMs / barMs) * barMs);
    clampedOffsetMs = clamp(clampedOffsetMs, 0, capByDuration || 45000);
  }

  return {
    recommendedOffsetMs: clampedOffsetMs,
    recommendedOffsetSeconds: Math.round(clampedOffsetMs / 1000)
  };
}

function getRejectedReasonMessage(result) {
  if (result?.status !== "rejected") {
    return null;
  }
  const reason = result.reason;
  if (!reason) {
    return "Request failed";
  }
  if (typeof reason === "string") {
    return reason;
  }
  return reason.message ?? "Request failed";
}

export default class VibeEngine {
  constructor(sessionStore) {
    this.sessionStore = sessionStore;
    this.sourceSliceCache = new Map();
  }

  buildSourceCacheKey(accessToken, sourceKey) {
    const tokenSlice = String(accessToken ?? "").slice(0, 18);
    return `${sourceKey}:${tokenSlice}`;
  }

  getCachedSource(accessToken, sourceKey, ttlMs) {
    const cacheKey = this.buildSourceCacheKey(accessToken, sourceKey);
    const cached = this.sourceSliceCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (Date.now() - cached.cachedAtMs > Math.max(0, Number(ttlMs) || 0)) {
      this.sourceSliceCache.delete(cacheKey);
      return null;
    }
    return cached.value;
  }

  setCachedSource(accessToken, sourceKey, value) {
    const cacheKey = this.buildSourceCacheKey(accessToken, sourceKey);
    this.sourceSliceCache.set(cacheKey, {
      cachedAtMs: Date.now(),
      value
    });

    if (this.sourceSliceCache.size > 120) {
      const entries = [...this.sourceSliceCache.entries()].sort(
        (a, b) => (a[1].cachedAtMs ?? 0) - (b[1].cachedAtMs ?? 0)
      );
      const trimCount = this.sourceSliceCache.size - 100;
      for (const [staleKey] of entries.slice(0, trimCount)) {
        this.sourceSliceCache.delete(staleKey);
      }
    }
  }

  async loadSourceWithCache(accessToken, sourceKey, ttlMs, loader) {
    const cached = this.getCachedSource(accessToken, sourceKey, ttlMs);
    if (cached) {
      return cached;
    }
    const value = await loader();
    this.setCachedSource(accessToken, sourceKey, value);
    return value;
  }

  async enrichTrackMetadata(accessToken, tracks, currentTrack = null) {
    const artistIds = [
      ...(currentTrack?.artists ?? []).map((artist) => artist.id),
      ...tracks.flatMap((track) => (track.artists ?? []).map((artist) => artist.id))
    ].filter(Boolean);

    const trackIds = [currentTrack?.id, ...tracks.map((track) => track.id)].filter(Boolean);

    const [artistsById, featuresByTrackId] = await Promise.all([
      getArtistsByIds(accessToken, artistIds).catch((error) => {
        console.error("[VibeEngine] getArtistsByIds failed:", error.message);
        return {};
      }),
      getAudioFeaturesByTrackIds(accessToken, trackIds).catch((error) => {
        console.error("[VibeEngine] getAudioFeaturesByTrackIds failed:", error.message);
        return {};
      })
    ]);

    const enrich = (track) => {
      const features = featuresByTrackId[track.id] ?? {};
      const genreTags = [
        ...new Set(
          (track.artists ?? []).flatMap(
            (artist) => artistsById[artist.id]?.genres?.map((genre) => genre.toLowerCase()) ?? []
          )
        )
      ];
      const camelot = keyModeToCamelot(features.key, features.mode);

      return {
        ...track,
        tempo: Number.isFinite(features.tempo) ? features.tempo : null,
        energy: Number.isFinite(features.energy) ? features.energy : null,
        danceability: Number.isFinite(features.danceability)
          ? features.danceability
          : null,
        valence: Number.isFinite(features.valence) ? features.valence : null,
        loudness: Number.isFinite(features.loudness) ? features.loudness : null,
        acousticness: Number.isFinite(features.acousticness) ? features.acousticness : null,
        instrumentalness: Number.isFinite(features.instrumentalness)
          ? features.instrumentalness
          : null,
        speechiness: Number.isFinite(features.speechiness) ? features.speechiness : null,
        liveness: Number.isFinite(features.liveness) ? features.liveness : null,
        key: Number.isInteger(features.key) ? features.key : null,
        mode: features.mode === 0 || features.mode === 1 ? features.mode : null,
        camelotKey: camelot?.code ?? null,
        genreTags
      };
    };

    return {
      currentTrack: currentTrack ? enrich(currentTrack) : null,
      candidates: tracks.map((track) => enrich(track))
    };
  }

  async _gatherRecommendationContext(accessToken, sessionId, userContextInput = {}) {
    const session = this.sessionStore.snapshot(sessionId);
    const userContext = normalizeUserContext(userContextInput);
    const playback = await getCurrentPlayback(accessToken);
    if (!playback?.item) {
      throw new Error("No active Spotify track found. Start playback and try again.");
    }

    const releaseYear = parseYearFromAlbum(playback.item);
    const currentTrack = {
      id: playback.item.id,
      uri: playback.item.uri,
      name: playback.item.name,
      artistNames: (playback.item.artists ?? []).map((artist) => artist.name),
      artists: (playback.item.artists ?? []).map((artist) => ({
        id: artist.id,
        name: artist.name
      })),
      albumName: playback.item.album?.name ?? "",
      albumImageUrl:
        playback.item.album?.images?.[0]?.url ??
        playback.item.album?.images?.[1]?.url ??
        null,
      durationMs: playback.item.duration_ms ?? 0,
      explicit: Boolean(playback.item.explicit),
      popularity: Number(playback.item.popularity ?? 50),
      releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
      releaseDateFull: playback.item?.album?.release_date ?? null
    };

    const currentProgressMs = Math.max(0, Number(playback.progress_ms) || 0);
    const currentRemainingMs = Math.max(0, (currentTrack.durationMs || 0) - currentProgressMs);
    const seedTrackIds = currentTrack.id ? [currentTrack.id] : [];
    const seedArtistIdsTwo = (currentTrack.artists ?? [])
      .slice(0, 2)
      .map((artist) => artist.id)
      .filter(Boolean);

    const discoveryRandomnessFactor = stableSessionRandom01(sessionId, "discovery-rf");

    const [artistsByIdResult, recentEventsResult, queueResult, topTracksResult, currentAudioFeaturesResult] =
      await Promise.allSettled([
        getArtistsByIds(accessToken, seedArtistIdsTwo).catch(() => ({})),
        getRecentlyPlayedTrackEvents(accessToken, { limit: 50 }),
        getPlaybackQueue(accessToken),
        this.loadSourceWithCache(
          accessToken,
          "top_short_term",
          1000 * 60 * 2,
          () => getUserTopTracks(accessToken, { limit: 12, timeRange: "short_term" })
        ),
        getAudioFeaturesByTrackIds(accessToken, [currentTrack.id]).catch((error) => {
          console.error(
            "[VibeEngine] getAudioFeaturesByTrackIds (current track) failed:",
            error.message
          );
          return {};
        })
      ]);

    const currentFeatMap =
      currentAudioFeaturesResult.status === "fulfilled"
        ? currentAudioFeaturesResult.value ?? {}
        : {};
    const currentTempoForDiscovery = Number.isFinite(currentFeatMap[currentTrack.id]?.tempo)
      ? currentFeatMap[currentTrack.id].tempo
      : null;

    const artistsById =
      artistsByIdResult.status === "fulfilled" ? artistsByIdResult.value ?? {} : {};
    const artistGenreList = [];
    for (const aid of seedArtistIdsTwo) {
      const genres = artistsById[aid]?.genres ?? [];
      artistGenreList.push(...genres);
    }

    const coherentGenreSeeds = buildCoherentGenreSeeds(artistGenreList, sessionId);
    const currentTrackFeatures =
      currentFeatMap[currentTrack.id] && typeof currentFeatMap[currentTrack.id] === "object"
        ? currentFeatMap[currentTrack.id]
        : {};

    let discoveryRecommendationCandidates = [];
    try {
      discoveryRecommendationCandidates = await fetchDiscoveryRecommendationGrid(accessToken, {
        seedTrackIds,
        seedArtistIds: seedArtistIdsTwo,
        coherentGenreSeeds,
        sessionId,
        currentTempo: currentTempoForDiscovery,
        currentReleaseYear: currentTrack.releaseYear,
        nostalgiaSlider: userContext.nostalgiaSlider,
        currentFeatures: currentTrackFeatures
      });
    } catch {
      discoveryRecommendationCandidates = [];
    }

    const queueCandidates =
      queueResult.status === "fulfilled"
        ? queueResult.value.map((track) => ({ ...track, source: "queue" }))
        : [];
    const topTrackCandidates =
      topTracksResult.status === "fulfilled"
        ? topTracksResult.value.map((track) => ({ ...track, source: "top_track" }))
        : [];
    let recentPlayedCandidates = [];
    let savedLibraryCandidates = [];
    let playlistLibraryCandidates = [];
    let libraryExpansionApplied = false;
    const sourceWarnings = [];

    const appendWarningIfRejected = (sourceLabel, result) => {
      const reason = getRejectedReasonMessage(result);
      if (!reason) {
        return;
      }
      sourceWarnings.push(
        `Could not read Spotify ${sourceLabel} source. Reconnect Spotify to grant library/history permissions.`
      );
    };

    const nowMs = Date.now();
    const recentEvents =
      recentEventsResult.status === "fulfilled" ? recentEventsResult.value ?? [] : [];
    const playedWithin4hUris = new Set();
    const recentHistoryUriSet = new Set();
    for (const ev of recentEvents) {
      const u = ev.track?.uri;
      if (!u) {
        continue;
      }
      recentHistoryUriSet.add(u);
      if (
        ev.playedAtMs !== null &&
        Number.isFinite(ev.playedAtMs) &&
        nowMs - ev.playedAtMs < DISCOVERY_FRESH_WINDOW_MS
      ) {
        playedWithin4hUris.add(u);
      }
    }

    // Discovery = Spotify /recommendations from current track + artists (+ genres inside fetch).
    // Do NOT merge past site-search results — those are unrelated to “similar to now playing”.
    let candidatePool = dedupeByUri([
      ...discoveryRecommendationCandidates,
      ...queueCandidates.slice(0, 6),
      ...topTrackCandidates
    ]).filter((track) => track.uri && track.uri !== currentTrack.uri);

    const recentSuggestedList = this.sessionStore.peekRecentSuggestedUris(sessionId);
    const recentSuggestedSet = new Set(recentSuggestedList);
    let diversifiedPool = candidatePool.filter((t) => !recentSuggestedSet.has(t.uri));
    if (diversifiedPool.length < 18 && recentSuggestedList.length > 0) {
      const tail = new Set(recentSuggestedList.slice(-14));
      diversifiedPool = candidatePool.filter((t) => !tail.has(t.uri));
    }
    if (diversifiedPool.length < 12) {
      diversifiedPool = candidatePool;
    }
    candidatePool = diversifiedPool;

    if (candidatePool.length < 45) {
      libraryExpansionApplied = true;
      const [recentPlayedResult, savedTracksResult] = await Promise.allSettled([
        this.loadSourceWithCache(
          accessToken,
          "recent_played",
          1000 * 60 * 2,
          () => getRecentlyPlayedTracks(accessToken, { limit: 30 })
        ),
        this.loadSourceWithCache(
          accessToken,
          "saved_tracks",
          1000 * 60 * 3,
          () => getSavedTracks(accessToken, { limit: 40 })
        )
      ]);

      recentPlayedCandidates =
        recentPlayedResult.status === "fulfilled"
          ? recentPlayedResult.value.map((track) => ({ ...track, source: "history_recent" }))
          : [];
      savedLibraryCandidates =
        savedTracksResult.status === "fulfilled"
          ? savedTracksResult.value.map((track) => ({ ...track, source: "library_saved" }))
          : [];
      appendWarningIfRejected("history", recentPlayedResult);
      appendWarningIfRejected("library", savedTracksResult);

      candidatePool = dedupeByUri([
        ...candidatePool,
        ...recentPlayedCandidates,
        ...savedLibraryCandidates
      ]).filter((track) => track.uri && track.uri !== currentTrack.uri);

      if (candidatePool.length < 70) {
        const playlistTracksResult = await Promise.allSettled([
          this.loadSourceWithCache(
            accessToken,
            "playlist_candidates",
            1000 * 60 * 4,
            () =>
              getPlaylistTrackCandidates(accessToken, {
                playlistLimit: 8,
                tracksPerPlaylist: 14
              })
          )
        ]);
        const playlistResult = playlistTracksResult[0];
        playlistLibraryCandidates =
          playlistResult.status === "fulfilled"
            ? playlistResult.value.map((track) => ({ ...track, source: "library_playlist" }))
            : [];
        appendWarningIfRejected("playlists", playlistResult);

        candidatePool = dedupeByUri([
          ...candidatePool,
          ...playlistLibraryCandidates
        ]).filter((track) => track.uri && track.uri !== currentTrack.uri);
      }
    }

    if (candidatePool.length === 0) {
      throw new Error("Could not generate recommendation candidates from Spotify right now.");
    }

    const candidatesExcludedBy4hWindow = candidatePool.filter((track) =>
      playedWithin4hUris.has(track.uri)
    ).length;
    let poolForScoring = candidatePool.filter((track) => !playedWithin4hUris.has(track.uri));
    if (poolForScoring.length === 0) {
      poolForScoring = candidatePool;
      sourceWarnings.push(
        "Discovery mode: no candidates outside the 4h replay window — using full pool."
      );
    }

    const recentUris = new Set([
      currentTrack.uri,
      ...queueCandidates.slice(0, 10).map((track) => track.uri)
    ]);

    const enriched = await this.enrichTrackMetadata(accessToken, poolForScoring, currentTrack);
    const enrichedCurrentTrack = enriched.currentTrack;
    let enrichedCandidates = enriched.candidates;

    if (
      Number(userContext.nostalgiaSlider) >= 45 &&
      Number.isFinite(enrichedCurrentTrack.tempo) &&
      enrichedCurrentTrack.tempo > 0
    ) {
      const lo = enrichedCurrentTrack.tempo - 5;
      const hi = enrichedCurrentTrack.tempo + 5;
      const narrowed = enrichedCandidates.filter(
        (c) => Number.isFinite(c.tempo) && c.tempo >= lo && c.tempo <= hi
      );
      if (narrowed.length >= 6) {
        enrichedCandidates = narrowed;
      }
    }

    return {
      session,
      userContext,
      currentTrack,
      currentProgressMs,
      currentRemainingMs,
      queueCandidates,
      topTrackCandidates,
      discoveryRecommendationCandidates,
      recentPlayedCandidates,
      savedLibraryCandidates,
      playlistLibraryCandidates,
      libraryExpansionApplied,
      sourceWarnings,
      recentHistoryUriSet,
      recentSuggestedList,
      candidatesExcludedBy4hWindow,
      poolForScoring,
      recentUris,
      enrichedCurrentTrack,
      enrichedCandidates,
      coherentGenreSeeds,
      seedArtistIdsTwo,
      discoveryRandomnessFactor
    };
  }

  async buildNextSongRecommendation(accessToken, sessionId, userContextInput = {}) {
    const {
      session,
      userContext,
      currentTrack,
      currentProgressMs,
      currentRemainingMs,
      queueCandidates,
      topTrackCandidates,
      discoveryRecommendationCandidates,
      recentPlayedCandidates,
      savedLibraryCandidates,
      playlistLibraryCandidates,
      libraryExpansionApplied,
      sourceWarnings,
      recentHistoryUriSet,
      recentSuggestedList,
      candidatesExcludedBy4hWindow,
      poolForScoring,
      recentUris,
      enrichedCurrentTrack,
      enrichedCandidates,
      coherentGenreSeeds,
      seedArtistIdsTwo,
      discoveryRandomnessFactor
    } = await this._gatherRecommendationContext(accessToken, sessionId, userContextInput);

    const queueNextRaw = queueCandidates[0] ?? null;
    const queueNextEnriched = queueNextRaw
      ? enrichedCandidates.find((c) => c.uri === queueNextRaw.uri) ?? null
      : null;

    const eraBridgePick =
      queueNextEnriched && enrichedCurrentTrack
        ? pickEraGapBridgeCandidate(enrichedCandidates, enrichedCurrentTrack, queueNextEnriched)
        : null;
    const bpmBridgePick =
      queueNextEnriched && enrichedCurrentTrack
        ? pickBridgeCandidate(enrichedCandidates, enrichedCurrentTrack, queueNextEnriched)
        : null;
    const bridgePick = eraBridgePick ?? bpmBridgePick;

    const scoringContextBase = {
      currentTrack: enrichedCurrentTrack,
      recentUris,
      recentHistoryUriSet,
      recentSuggestedUrisSet: new Set(recentSuggestedList),
      sessionPenalty: {
        artistPenalty: session.artistPenalty ?? {},
        genrePenalty: session.genrePenalty ?? {},
        bpmRangePenalty: session.bpmRangePenalty ?? {},
        skippedTrackPenalty: session.skippedTrackPenalty ?? {}
      },
      sessionHistory: {
        recommendedTrackCount: session.recommendedTrackCount ?? {},
        recommendedArtistCount: session.recommendedArtistCount ?? {}
      },
      searchAffinity: session.searchAffinity ?? { termWeights: {}, artistTermWeights: {} },
      userContext
    };

    const scoredCandidates = await rankCandidatesWithEmbeddings(
      accessToken,
      enrichedCurrentTrack,
      enrichedCandidates,
      scoringContextBase
    );

    let selectedCandidate = scoredCandidates[0];
    let bridgeContext = null;

    if (bridgePick) {
      const scoredBridge = {
        ...bridgePick,
        ...scoreCandidate(bridgePick, scoringContextBase)
      };
      selectedCandidate = scoredBridge;
      const t0 = Number(enrichedCurrentTrack.tempo);
      const t1 = Number(queueNextEnriched.tempo);
      const cy = enrichedCurrentTrack.releaseYear;
      const ny = queueNextEnriched.releaseYear;
      bridgeContext = {
        injected: true,
        bridgeKind:
          eraBridgePick && bridgePick.uri === eraBridgePick.uri ? "era_gap" : "bpm_gap",
        queueNextUri: queueNextRaw?.uri ?? null,
        queueNextName: queueNextRaw?.name ?? null,
        bpmGap: Number.isFinite(t0) && Number.isFinite(t1) ? Math.abs(t0 - t1) : null,
        eraGapYears:
          Number.isFinite(cy) && Number.isFinite(ny) ? Math.abs(cy - ny) : null,
        bridgeName: bridgePick.name ?? null
      };
    }

    const entryPointBase = scoreEntryPoint(selectedCandidate, currentRemainingMs);
    const advancedPlan = buildAdvancedTransitionPlan({
      sessionId,
      currentTrack: enrichedCurrentTrack,
      nextTrack: selectedCandidate,
      entryPointBase,
      remixModeEnabled: session.remixModeEnabled,
      nostalgiaSlider: userContext.nostalgiaSlider
    });

    const entryPoint = {
      recommendedOffsetMs: advancedPlan.recommendedOffsetMs,
      recommendedOffsetSeconds: advancedPlan.recommendedOffsetSeconds
    };

    const logicLog = [
      ...(selectedCandidate?.logicLog ?? []),
      ...sourceWarnings,
      bridgeContext?.injected
        ? `Shuffle bridge (${bridgeContext.bridgeKind ?? "mix"}): ${bridgeContext.bridgeName ?? "bridge"} before "${bridgeContext.queueNextName ?? "next"}".`
        : null
    ]
      .filter(Boolean)
      .slice(0, 8);

    const surfaceUris = [
      selectedCandidate?.uri,
      ...scoredCandidates.slice(0, 5).map((c) => c.uri)
    ].filter(Boolean);
    this.sessionStore.appendRecentSuggestedUris(sessionId, surfaceUris);
    this.sessionStore.recordRecommendedTrack(sessionId, {
      trackId: selectedCandidate?.id,
      artistIds: (selectedCandidate?.artists ?? []).map((artist) => artist.id)
    });

    return {
      generatedAt: new Date().toISOString(),
      mode: session.remixModeEnabled ? "dj_remix" : "standard_vibe",
      userContext,
      discoveryMeta: {
        discoveryRandomnessFactor,
        spotifyApiNote:
          "Dual /recommendations calls share the same genre seeds and audio-feature targets; popularity targets differ slightly for variety.",
        temporalYearNote:
          "GET /recommendations does not support min_year/max_year; release years are enforced by filtering recommendation results (and tempo via min_tempo/max_tempo when Nostalgia ≥ 40%).",
        eraYearBounds: computeEraYearBounds(
          enrichedCurrentTrack.releaseYear ?? currentTrack.releaseYear,
          userContext.nostalgiaSlider
        ),
        nostalgiaSlider: userContext.nostalgiaSlider,
        seedArtistsUsed: seedArtistIdsTwo,
        coherentGenreSeeds,
        seedGenrePairs: [coherentGenreSeeds]
      },
      bridgeContext,
      currentTrack: {
        ...enrichedCurrentTrack,
        progressMs: currentProgressMs,
        remainingMs: currentRemainingMs
      },
      candidateSelection: {
        totalCandidates: poolForScoring.length,
        discoveryRecommendationCandidates: discoveryRecommendationCandidates.length,
        affinityCandidates: 0,
        libraryExpansionApplied,
        historyRecentCandidates: recentPlayedCandidates.length,
        librarySavedCandidates: savedLibraryCandidates.length,
        libraryPlaylistCandidates: playlistLibraryCandidates.length,
        queueCandidates: queueCandidates.length,
        topTrackCandidates: topTrackCandidates.length,
        candidatesExcludedBy4hWindow
      },
      logicLog,
      selectedCandidate: {
        ...selectedCandidate,
        scoreRaw: round1(selectedCandidate.score),
        score: toPublicVibeMatchPercent(selectedCandidate.score),
        vibeMatch: toPublicVibeMatchPercent(selectedCandidate.score),
        flowConfidence: toPublicVibeMatchPercent(selectedCandidate.flowConfidence)
      },
      topCandidates: scoredCandidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        scoreRaw: round1(candidate.score),
        score: toPublicVibeMatchPercent(candidate.score),
        vibeMatch: toPublicVibeMatchPercent(candidate.score),
        flowConfidence: toPublicVibeMatchPercent(candidate.flowConfidence)
      })),
      entryPoint,
      transitionPlan: {
        action: "queue_now_then_auto_seek",
        queueNow: true,
        estimatedSwitchInMs: Math.max(0, currentRemainingMs),
        estimatedSwitchInSeconds: Math.max(0, Math.round(currentRemainingMs / 1000)),
        autopilotTriggerWindowSeconds: {
          start: 20,
          end: 15
        },
        recommendedSeekDelayMs: currentRemainingMs <= 20000 ? 0 : 700,
        recommendedSeekDelaySeconds: currentRemainingMs <= 20000 ? 0 : 1,
        recommendedOffsetMs: entryPoint.recommendedOffsetMs,
        recommendedOffsetSeconds: entryPoint.recommendedOffsetSeconds,
        ...advancedPlan
      }
    };
  }

  async buildSmartQueue(accessToken, sessionId, userContextInput = {}, { queueLength = 5 } = {}) {
    const {
      session,
      userContext,
      currentProgressMs,
      currentRemainingMs,
      enrichedCurrentTrack,
      enrichedCandidates,
      recentUris,
      recentHistoryUriSet,
      recentSuggestedList,
      sourceWarnings
    } = await this._gatherRecommendationContext(accessToken, sessionId, userContextInput);

    const scoringContextBase = {
      currentTrack: enrichedCurrentTrack,
      recentUris,
      recentHistoryUriSet,
      recentSuggestedUrisSet: new Set(recentSuggestedList),
      sessionPenalty: {
        artistPenalty: session.artistPenalty ?? {},
        genrePenalty: session.genrePenalty ?? {},
        bpmRangePenalty: session.bpmRangePenalty ?? {},
        skippedTrackPenalty: session.skippedTrackPenalty ?? {}
      },
      sessionHistory: {
        recommendedTrackCount: session.recommendedTrackCount ?? {},
        recommendedArtistCount: session.recommendedArtistCount ?? {}
      },
      searchAffinity: session.searchAffinity ?? { termWeights: {}, artistTermWeights: {} },
      userContext
    };

    const safeQueueLength = clamp(Math.round(Number(queueLength) || 5), 2, 10);
    const shortlistSize = Math.max(safeQueueLength * 6, 24);

    const ranked = await rankCandidatesWithEmbeddings(
      accessToken,
      enrichedCurrentTrack,
      enrichedCandidates,
      scoringContextBase,
      { shortlistSize, attachEmbeddingVectors: true }
    );
    const shortlist = ranked.slice(0, shortlistSize);

    const picked = [];
    const usedArtistIds = new Set(
      (enrichedCurrentTrack.artists ?? []).map((artist) => artist.id).filter(Boolean)
    );
    const currentEmbedding = await getTrackEmbedding(accessToken, enrichedCurrentTrack.id);
    let anchor = { ...enrichedCurrentTrack, embedding: currentEmbedding };
    const pool = [...shortlist];

    while (picked.length < safeQueueLength && pool.length > 0) {
      let bestIndex = 0;
      let bestFlowScore = -Infinity;
      for (let idx = 0; idx < pool.length; idx += 1) {
        const flowScore = computeFlowScore(anchor, pool[idx], usedArtistIds);
        if (flowScore > bestFlowScore) {
          bestFlowScore = flowScore;
          bestIndex = idx;
        }
      }
      const [chosen] = pool.splice(bestIndex, 1);
      picked.push({ track: chosen, flowScoreRaw: bestFlowScore });
      for (const artist of chosen.artists ?? []) {
        if (artist.id) {
          usedArtistIds.add(artist.id);
        }
      }
      anchor = chosen;
    }

    let previousTrack = enrichedCurrentTrack;
    let previousRemainingMs = currentRemainingMs;
    const queue = picked.map(({ track, flowScoreRaw }, index) => {
      const entryPointBase = scoreEntryPoint(track, previousRemainingMs);
      const transitionPlan = buildAdvancedTransitionPlan({
        sessionId: `${sessionId}-smart-queue-${index}`,
        currentTrack: previousTrack,
        nextTrack: track,
        entryPointBase,
        remixModeEnabled: session.remixModeEnabled,
        nostalgiaSlider: userContext.nostalgiaSlider
      });

      previousTrack = track;
      previousRemainingMs = track.durationMs || 0;

      return {
        position: index + 1,
        track: {
          ...track,
          scoreRaw: round1(track.score),
          score: toPublicVibeMatchPercent(track.score),
          vibeMatch: toPublicVibeMatchPercent(track.score)
        },
        flowScoreRaw: round1(flowScoreRaw),
        transitionFromPrevious: transitionPlan
      };
    });

    const surfaceUris = queue.map((item) => item.track.uri).filter(Boolean);
    this.sessionStore.appendRecentSuggestedUris(sessionId, surfaceUris);

    return {
      generatedAt: new Date().toISOString(),
      mode: session.remixModeEnabled ? "dj_remix" : "standard_vibe",
      userContext,
      anchorTrack: {
        ...enrichedCurrentTrack,
        progressMs: currentProgressMs,
        remainingMs: currentRemainingMs
      },
      queueLength: queue.length,
      queue,
      sourceWarnings
    };
  }
}
