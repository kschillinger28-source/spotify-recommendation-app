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
  getUserTopTracks,
  searchSpotifyTracks
} from "../../utils/spotify.js";

const DISCOVERY_FRESH_WINDOW_MS = 4 * 60 * 60 * 1000;

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

function toBpmBucket(tempo) {
  const value = Number(tempo);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const start = Math.floor(value / 10) * 10;
  return `${start}-${start + 9}`;
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

function pickSeedGenrePairs(artistGenreList, sessionId, countryCode) {
  const allowed = new Set(SPOTIFY_SEED_GENRE_POOL);
  const fromArtists = [];
  for (const g of artistGenreList ?? []) {
    const t = normalizeGenreToSeedToken(g);
    if (t && allowed.has(t)) {
      fromArtists.push(t);
    }
  }
  const region = countryCode && REGION_GENRE_HINTS[countryCode];
  const regionSeeds = (region ?? [])
    .map((g) => normalizeGenreToSeedToken(g))
    .filter((t) => t && allowed.has(t));

  const pool = shuffleWithSessionSeed(
    [...new Set([...fromArtists, ...regionSeeds, ...SPOTIFY_SEED_GENRE_POOL])],
    sessionId,
    "genre-pool"
  );

  const a = pool[0] ?? "pop";
  const b = pool[1] ?? "rock";
  const c = pool[2] ?? "dance";
  const d = pool[Math.max(0, Math.min(pool.length - 1, 3))] ?? "house";
  return [
    [a, b],
    [c, d]
  ];
}

async function fetchDiscoveryRecommendationGrid(
  accessToken,
  {
    seedTrackIds,
    seedArtistIds,
    genrePairs,
    sessionId,
    discoveryRandomnessFactor,
    currentTempo,
    currentReleaseYear,
    nostalgiaSlider
  }
) {
  const rf = clamp(Number(discoveryRandomnessFactor) || 0.5, 0, 1);
  const e1 = 0.32 + rf * 0.28;
  const e2 = 0.55 + rf * 0.2;
  const p2 = 45 + rf * 35;

  const tempoSync =
    Number.isFinite(currentTempo) && currentTempo > 0 && Number(nostalgiaSlider) >= 40;
  const tempoExtra = tempoSync
    ? {
        min_tempo: Math.max(40, Math.round((currentTempo - 5) * 10) / 10),
        max_tempo: Math.min(220, Math.round((currentTempo + 5) * 10) / 10)
      }
    : {};

  const artists = seedArtistIds.filter(Boolean).slice(0, 2);
  const poolExtra = shuffleWithSessionSeed([...SPOTIFY_SEED_GENRE_POOL], sessionId, "g3");
  let gA = [...genrePairs[0]];
  let gB = [...genrePairs[1]];
  if (artists.length === 1) {
    gA = [gA[0], gA[1], poolExtra[0] ?? "ambient"];
    gB = [gB[0], gB[1], poolExtra[2] ?? "soul"];
  } else if (artists.length === 0) {
    const pool = shuffleWithSessionSeed([...SPOTIFY_SEED_GENRE_POOL], sessionId, "no-artist");
    gA = [pool[0] ?? "pop", pool[1] ?? "rock", pool[2] ?? "dance", pool[3] ?? "house"];
    gB = [pool[4] ?? "techno", pool[5] ?? "indie", pool[6] ?? "ambient", pool[7] ?? "soul"];
  }

  const results = await Promise.allSettled([
    getSpotifyRecommendations(accessToken, {
      seedTrackIds,
      seedArtistIds: artists,
      seedGenres: gA,
      limit: 50,
      extraQueryParams: { target_energy: round1(e1), ...tempoExtra }
    }),
    getSpotifyRecommendations(accessToken, {
      seedTrackIds,
      seedArtistIds: artists,
      seedGenres: gB,
      limit: 50,
      extraQueryParams: {
        target_energy: round1(e2),
        target_popularity: round1(p2),
        ...tempoExtra
      }
    })
  ]);

  const merged = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      merged.push(...r.value);
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

  const strategy = `${transitionKind.replace(/_/g, " ")} · ${Math.round(
    transitionWindowMs / 1000
  )}s window${
    bpmDelta !== null ? ` · Δ${Math.round(bpmDelta)} BPM` : ""
  }${
    volumeNormalizationPercentDelta !== 0
      ? ` · loudness Δ ${volumeNormalizationPercentDelta > 0 ? "+" : ""}${volumeNormalizationPercentDelta}%`
      : ""
  } · mock EQ via duck${eraRemixNote ? ` · ${eraRemixNote}` : ""}`;

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

const CHILL_GENRE_HINTS = ["acoustic", "chill", "lofi", "indie", "folk", "ambient"];
const HEAT_GENRE_HINTS = ["dance", "house", "edm", "summer", "latin", "reggaeton", "party"];

function sourceBonus(source) {
  if (source === "discovery_recommendation") {
    return 12;
  }
  if (source === "recommendation") {
    return 10;
  }
  if (source === "affinity_search") {
    return 5;
  }
  if (source === "library_saved") {
    return 9;
  }
  if (source === "library_playlist") {
    return 9;
  }
  if (source === "history_recent") {
    return 8;
  }
  if (source === "queue") {
    return 4;
  }
  if (source === "top_track") {
    return 6;
  }
  return 3;
}

function computeTempoDistanceBpm(currentTempo, candidateTempo) {
  if (
    !Number.isFinite(currentTempo) ||
    !Number.isFinite(candidateTempo) ||
    currentTempo <= 0 ||
    candidateTempo <= 0
  ) {
    return null;
  }

  const direct = Math.abs(currentTempo - candidateTempo);
  const halfDoubleA = Math.abs(currentTempo * 2 - candidateTempo);
  const halfDoubleB = Math.abs(currentTempo - candidateTempo * 2);
  return Math.min(direct, halfDoubleA, halfDoubleB);
}

function computeTempoDiffPercent(currentTempo, candidateTempo) {
  const distance = computeTempoDistanceBpm(currentTempo, candidateTempo);
  if (distance === null || !Number.isFinite(currentTempo) || currentTempo <= 0) {
    return null;
  }
  return (distance / currentTempo) * 100;
}

function includesAnyGenre(genreTags, hints) {
  const genres = Array.isArray(genreTags) ? genreTags : [];
  return genres.some((genre) =>
    hints.some((hint) => String(genre).toLowerCase().includes(hint))
  );
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
  const tempC = Number(rawContext.tempC);
  const localHourRaw = Number(rawContext.localHour);
  const localHour = Number.isFinite(localHourRaw)
    ? clamp(Math.round(localHourRaw), 0, 23)
    : new Date().getHours();

  const nostalgiaSlider = clamp(Number(rawContext.nostalgiaSlider ?? 50), 0, 100);

  return {
    timezone: timezone || null,
    countryCode: countryCode || null,
    weather: weather || "clear",
    gender,
    moodLevel,
    nostalgiaSlider,
    accountAgeYears: Number.isFinite(accountAgeYears) ? accountAgeYears : 0,
    tempC: Number.isFinite(tempC) ? tempC : null,
    localHour
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

  if (userContext.weather.includes("rain") && Number(candidate.valence) <= 0.45) {
    const rainyBoost = Math.min(8, musicalScore * 0.1);
    adjustments.weatherRainValenceBoost += rainyBoost;
    logicLog.push(`Boosted ${candidate.name} by ${Math.round(rainyBoost)} due to rainy low-valence match.`);
  }

  if (Number.isFinite(userContext.tempC)) {
    if (userContext.tempC < 15) {
      if ((Number(candidate.energy) || 0) < 0.55 || includesAnyGenre(candidate.genreTags, CHILL_GENRE_HINTS)) {
        adjustments.temperatureMoodBoost += 2.4;
        logicLog.push(`Boosted ${candidate.name} for cool weather chill fit (${Math.round(userContext.tempC)}C).`);
      }
    } else if (userContext.tempC > 25) {
      if ((Number(candidate.energy) || 0) > 0.72 || includesAnyGenre(candidate.genreTags, HEAT_GENRE_HINTS)) {
        adjustments.temperatureMoodBoost += 2.6;
        logicLog.push(`Boosted ${candidate.name} for warm weather energy fit (${Math.round(userContext.tempC)}C).`);
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

  // Gender is captured as context but not used for direct musical filtering due metadata limits.
  if (userContext.gender && userContext.gender !== "unspecified") {
    logicLog.push(`Captured gender context (${userContext.gender}) for future personalization.`);
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
  const popularityFit = Math.max(0, 10 - Math.abs(candidatePopularity - currentPopularity) * 0.16);
  const durationFit = Math.max(0, 9 - durationGapSeconds * 0.12);

  let bpmFit = 4;
  if (tempoDiffPercent !== null) {
    if (tempoDiffPercent <= 5) {
      bpmFit = Math.max(12, 30 - tempoDiffPercent * 3.1);
    } else {
      bpmFit = Math.max(-14, 8 - (tempoDiffPercent - 5) * 2.4);
    }
  }

  const energyFit = energyGap === null ? 2 : Math.max(-6, 12 - energyGap * 24);
  const artistContinuity =
    primaryArtistId(candidate) && primaryArtistId(candidate) === primaryArtistId(currentTrack)
      ? 12
      : 0;
  const explicitFit = candidate.explicit === currentTrack.explicit ? 4 : -1.5;
  const sourceFit = sourceBonus(candidate.source);
  const repeatPenalty = context.recentUris.has(candidate.uri) ? -18 : 0;

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
  const affinityBoost = getAffinityBoost(candidate, context.searchAffinity);
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
    16,
    historicalTrackCount * 4 + historicalArtistCount * 2.6
  );

  const discoveryNovelty =
    context.recentHistoryUriSet === undefined
      ? 0
      : context.recentHistoryUriSet.has(candidate.uri)
        ? -4.5
        : 2.2;

  const musicalScore = clamp(
    round1(
      22 +
        bpmFit +
        energyFit +
        artistContinuity +
        durationFit +
        popularityFit +
        explicitFit +
        sourceFit +
        affinityBoost +
        discoveryNovelty -
        repeatPenalty * -1 -
        trackPenalty -
        artistPenalty -
        genrePenalty -
        bpmBucketPenalty -
        repetitionHistoryPenalty +
        journeyBoost
    ),
    0,
    100
  );

  const contextSignals = getContextSignalAdjustment(candidate, context, musicalScore);
  let total = clamp(
    round1(musicalScore + contextSignals.contextualAdjustment),
    0,
    100
  );

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
    eraMatchBoostApplied = true;
  }

  return {
    score: total,
    musicalScore,
    temporalVibe: {
      currentReleaseYear: Number.isFinite(cy) ? cy : null,
      candidateReleaseYear: Number.isFinite(y) ? y : null,
      eraAlignmentPercent,
      eraMatchBoostApplied,
      eraLabel: Number.isFinite(y) ? formatEraBadgeLabel(y) : null
    },
    scoreBreakdown: {
      bpmFit: round1(bpmFit),
      energyFit: round1(energyFit),
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
      discoveryNovelty: round1(discoveryNovelty),
      contextualAdjustment: round1(contextSignals.contextualAdjustment),
      contextSignalBreakdown: contextSignals.contextSignalBreakdown
    },
    logicLog: contextSignals.logicLog,
    flowConfidence: total
  };
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
      getArtistsByIds(accessToken, artistIds).catch(() => ({})),
      getAudioFeaturesByTrackIds(accessToken, trackIds).catch(() => ({}))
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

      return {
        ...track,
        tempo: Number.isFinite(features.tempo) ? features.tempo : null,
        energy: Number.isFinite(features.energy) ? features.energy : null,
        danceability: Number.isFinite(features.danceability)
          ? features.danceability
          : null,
        valence: Number.isFinite(features.valence) ? features.valence : null,
        loudness: Number.isFinite(features.loudness) ? features.loudness : null,
        genreTags
      };
    };

    return {
      currentTrack: currentTrack ? enrich(currentTrack) : null,
      candidates: tracks.map((track) => enrich(track))
    };
  }

  async buildNextSongRecommendation(accessToken, sessionId, userContextInput = {}) {
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
    const affinityQuery = session.searchAffinity?.latestQuery ?? "";

    const seedTrackIds = currentTrack.id ? [currentTrack.id] : [];
    const seedArtistIdsTwo = (currentTrack.artists ?? [])
      .slice(0, 2)
      .map((artist) => artist.id)
      .filter(Boolean);

    const discoveryRandomnessFactor = stableSessionRandom01(sessionId, "discovery-rf");

    const [
      artistsByIdResult,
      recentEventsResult,
      queueResult,
      topTracksResult,
      affinitySearchResult,
      currentAudioFeaturesResult
    ] = await Promise.allSettled([
      getArtistsByIds(accessToken, seedArtistIdsTwo).catch(() => ({})),
      getRecentlyPlayedTrackEvents(accessToken, { limit: 50 }),
      getPlaybackQueue(accessToken),
      this.loadSourceWithCache(
        accessToken,
        "top_short_term",
        1000 * 60 * 2,
        () => getUserTopTracks(accessToken, { limit: 12, timeRange: "short_term" })
      ),
      affinityQuery
        ? this.loadSourceWithCache(
            accessToken,
            `affinity_${affinityQuery}`,
            1000 * 45,
            () => searchSpotifyTracks(accessToken, affinityQuery, 20)
          )
        : Promise.resolve([]),
      getAudioFeaturesByTrackIds(accessToken, [currentTrack.id]).catch(() => ({}))
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

    const genrePairs = pickSeedGenrePairs(
      artistGenreList,
      sessionId,
      userContext.countryCode
    );

    let discoveryRecommendationCandidates = [];
    try {
      discoveryRecommendationCandidates = await fetchDiscoveryRecommendationGrid(accessToken, {
        seedTrackIds,
        seedArtistIds: seedArtistIdsTwo,
        genrePairs,
        sessionId,
        discoveryRandomnessFactor,
        currentTempo: currentTempoForDiscovery,
        currentReleaseYear: currentTrack.releaseYear,
        nostalgiaSlider: userContext.nostalgiaSlider
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
    const affinityCandidates =
      affinitySearchResult.status === "fulfilled"
        ? affinitySearchResult.value.map((track) => ({ ...track, source: "affinity_search" }))
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

    let candidatePool = dedupeByUri([
      ...discoveryRecommendationCandidates,
      ...queueCandidates.slice(0, 6),
      ...topTrackCandidates,
      ...affinityCandidates
    ]).filter((track) => track.uri && track.uri !== currentTrack.uri);

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

    const scoredCandidates = enrichedCandidates
      .map((candidate) => {
        const scored = scoreCandidate(candidate, scoringContextBase);
        return {
          ...candidate,
          ...scored
        };
      })
      .sort((a, b) => b.score - a.score);

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
          "Spotify Web API has no randomness_factor; session-seeded shuffle + dual recommendation pulls approximate it.",
        temporalYearNote:
          "GET /recommendations does not support min_year/max_year; release years are enforced by filtering recommendation results (and tempo via min_tempo/max_tempo when Nostalgia ≥ 40%).",
        eraYearBounds: computeEraYearBounds(
          enrichedCurrentTrack.releaseYear ?? currentTrack.releaseYear,
          userContext.nostalgiaSlider
        ),
        nostalgiaSlider: userContext.nostalgiaSlider,
        seedArtistsUsed: seedArtistIdsTwo,
        seedGenrePairs: genrePairs
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
        affinityCandidates: affinityCandidates.length,
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
        vibeMatch: selectedCandidate.score,
        flowConfidence: selectedCandidate.flowConfidence
      },
      topCandidates: scoredCandidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        vibeMatch: candidate.score,
        flowConfidence: candidate.flowConfidence
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
}
