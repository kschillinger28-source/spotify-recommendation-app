/**
 * Transition Compatibility Scoring
 *
 * Evaluates how well a candidate track follows the current track as an immediate next song.
 * This is different from general similarity — a song can be good for a user while being
 * a terrible immediate next song.
 *
 * Philosophy: DJ-style continuity, not discovery engine.
 */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Genre distance graph: maps genre relationships
 * Measures how many "hops" between genres on a connectivity graph
 * Examples:
 *   country -> country-rock: distance 1
 *   country -> rock: distance 2
 *   country -> hard-rock: distance 3
 *   country -> metal: distance 4+
 */
const GENRE_DISTANCE_GRAPH = {
  // Country cluster
  'country': {
    'country': 0,
    'country-rock': 1,
    'folk': 1,
    'americana': 1,
    'bluegrass': 1,
    'country-pop': 1,
    'outlaw-country': 1,
    'honky-tonk': 1,
    'modern-country': 0,
    'southern-rock': 2,
    'rock': 2,
    'classic-rock': 2,
    'alternative': 2,
    'indie': 2,
    'folk-rock': 2,
    'hard-rock': 4,
    'metal': 5,
    'heavy-metal': 5,
  },
  'country-rock': {
    'country': 1,
    'country-rock': 0,
    'rock': 1,
    'classic-rock': 1,
    'southern-rock': 1,
    'folk-rock': 1,
    'hard-rock': 3,
    'metal': 4,
  },
  'rock': {
    'rock': 0,
    'classic-rock': 1,
    'alternative': 1,
    'indie': 1,
    'hard-rock': 1,
    'rock-pop': 1,
    'country-rock': 1,
    'folk-rock': 1,
    'garage-rock': 1,
    'progressive-rock': 1,
    'metal': 2,
    'punk': 2,
    'pop': 2,
  },
  'classic-rock': {
    'classic-rock': 0,
    'rock': 1,
    'hard-rock': 1,
    'progressive-rock': 1,
    'alternative': 1,
    'country-rock': 2,
    'metal': 2,
  },
  'hard-rock': {
    'hard-rock': 0,
    'metal': 1,
    'heavy-metal': 1,
    'alternative-metal': 1,
    'classic-rock': 1,
    'rock': 2,
  },
  'metal': {
    'metal': 0,
    'heavy-metal': 0,
    'hard-rock': 1,
    'alternative-metal': 1,
    'punk': 2,
    'rock': 3,
  },
  'electronic': {
    'electronic': 0,
    'house': 1,
    'techno': 1,
    'edm': 1,
    'deep-house': 1,
    'ambient': 1,
    'synth-pop': 1,
    'industrial': 1,
    'dance': 1,
  },
  'house': {
    'house': 0,
    'deep-house': 1,
    'electronic': 1,
    'techno': 1,
    'edm': 1,
    'dance': 1,
    'progressive-house': 0,
  },
  'hip-hop': {
    'hip-hop': 0,
    'rap': 0,
    'trap': 1,
    'r-n-b': 1,
    'funk': 1,
    'soul': 2,
    'pop': 2,
  },
  'pop': {
    'pop': 0,
    'synth-pop': 1,
    'indie-pop': 1,
    'pop-rock': 1,
    'hip-hop': 2,
    'r-n-b': 1,
  },
  'jazz': {
    'jazz': 0,
    'funk': 1,
    'soul': 1,
    'blues': 1,
  },
  'ambient': {
    'ambient': 0,
    'electronic': 1,
    'chill': 1,
    'lo-fi': 1,
    'indie': 1,
  },
  'acoustic': {
    'acoustic': 0,
    'folk': 0,
    'singer-songwriter': 0,
    'country': 1,
    'indie': 1,
  },
};

/**
 * Calculate genre distance between two genres
 * Returns 0 if same, higher numbers for more distant genres
 * Returns 10 if completely unknown relationship (generic penalty)
 */
function genreDistance(genre1, genre2) {
  if (!genre1 || !genre2) return 10;

  const g1 = String(genre1).toLowerCase().trim();
  const g2 = String(genre2).toLowerCase().trim();

  if (g1 === g2) return 0;

  // Try direct lookup
  const distances = GENRE_DISTANCE_GRAPH[g1];
  if (distances && typeof distances[g2] === 'number') {
    return distances[g2];
  }

  // Try reverse lookup
  const reverseDistances = GENRE_DISTANCE_GRAPH[g2];
  if (reverseDistances && typeof reverseDistances[g1] === 'number') {
    return reverseDistances[g1];
  }

  // Unknown relationship — apply generic distance penalty
  return 10;
}

/**
 * Minimum genre distance between any pair of genres from two tracks
 */
function minGenreDistance(currentGenres = [], candidateGenres = []) {
  if (currentGenres.length === 0 || candidateGenres.length === 0) {
    return null; // Missing data
  }

  let minDist = Infinity;
  for (const cg of currentGenres) {
    for (const hg of candidateGenres) {
      const dist = genreDistance(cg, hg);
      minDist = Math.min(minDist, dist);
    }
  }

  return minDist === Infinity ? null : minDist;
}

/**
 * Compute normalized genre transition compatibility [0, 1]
 * 0 = very bad transition
 * 1 = same genre
 * Penalizes large genre jumps exponentially
 */
function genreTransitionScore(currentGenres = [], candidateGenres = []) {
  const dist = minGenreDistance(currentGenres, candidateGenres);

  if (dist === null) {
    return 0.5; // Unknown relationship = neutral fallback
  }

  if (dist === 0) return 1.0;
  if (dist === 1) return 0.85;
  if (dist === 2) return 0.65;
  if (dist === 3) return 0.35;
  if (dist === 4) return 0.15;
  return 0.05; // Distant genre jump
}

/**
 * Compute normalized similarity for a continuous feature
 * Returns [0, 1] where 1 = identical, 0 = maximum allowable difference
 */
function featureSimilarity(current, candidate, maxAcceptableDelta, isOptional = false) {
  if (!Number.isFinite(current) || !Number.isFinite(candidate)) {
    return isOptional ? 1.0 : 0.5; // Missing data — neutral or penalize
  }

  const delta = Math.abs(current - candidate);
  if (delta === 0) return 1.0;

  // Smooth penalty curve: 1.0 at delta=0, decays exponentially toward 0
  // At maxAcceptableDelta, score = 0.37 (moderately acceptable, not ideal)
  // This gives more leeway for reasonable transitions while still penalizing large jumps
  const score = Math.exp(-1.0 * (delta / maxAcceptableDelta));
  return clamp(score, 0, 1);
}

/**
 * Abrupt transition penalty
 * Penalizes large simultaneous jumps across multiple dimensions
 * Example: if BOTH BPM and energy jump significantly, apply a multiplier penalty
 */
function abruptTransitionPenalty(current, candidate) {
  let jumpCount = 0;
  let severity = 1.0;

  // BPM: ±20% is reasonable, >20% starts getting harsh
  const tempoDiffPercent = current.tempo && candidate.tempo
    ? Math.abs(current.tempo - candidate.tempo) / current.tempo * 100
    : 0;
  if (tempoDiffPercent > 20) jumpCount++;

  // Energy: >0.3 delta is a significant jump
  const energyDelta = current.energy && candidate.energy
    ? Math.abs(current.energy - candidate.energy)
    : 0;
  if (energyDelta > 0.3) jumpCount++;

  // Loudness: >3dB is noticeable
  const loudnessDelta = current.loudness && candidate.loudness
    ? Math.abs(current.loudness - candidate.loudness)
    : 0;
  if (loudnessDelta > 3) jumpCount++;

  // Acousticness: significant character change
  const acusticDelta = current.acousticness && candidate.acousticness
    ? Math.abs(current.acousticness - candidate.acousticness)
    : 0;
  if (acusticDelta > 0.4) jumpCount++;

  // Apply exponential penalty for multiple simultaneous jumps
  // 1 jump: no penalty (multiplier = 1.0)
  // 2 jumps: 15% penalty (multiplier = 0.85)
  // 3 jumps: 35% penalty (multiplier = 0.65)
  // 4+ jumps: 60% penalty (multiplier = 0.40)
  if (jumpCount >= 2) {
    severity = Math.pow(0.85, jumpCount - 1);
  }

  return severity; // Return as multiplier, not subtracted
}

/**
 * Compute comprehensive transition compatibility score
 * Combines genre, audio, and temporal continuity
 * Returns a score that can be multiplied against other ranking signals
 * Range: typically [0.1, 1.0], where:
 *   1.0 = seamless continuation
 *   0.5 = acceptable adjacent genre jump
 *   0.1 = poor/jarring transition
 */
function computeTransitionCompatibility(current, candidate) {
  // Core feature similarities (normalized to [0,1])
  const genreScore = genreTransitionScore(current.genreTags, candidate.genreTags);
  const tempoScore = featureSimilarity(current.tempo, candidate.tempo, 30, false); // ±30 BPM envelope
  const energyScore = featureSimilarity(current.energy, candidate.energy, 0.3, true);
  const acousticScore = featureSimilarity(current.acousticness, candidate.acousticness, 0.4, true);
  const valenceScore = featureSimilarity(current.valence, candidate.valence, 0.3, true);
  const loudnessScore = featureSimilarity(current.loudness, candidate.loudness, 4, true); // ±4 dB
  const danceabilityScore = featureSimilarity(current.danceability, candidate.danceability, 0.3, true);

  // Key compatibility (prefer compatible or at least not clashing)
  const keyScore = computeKeyCompatibility(current.key, current.mode, candidate.key, candidate.mode);

  // Weighted average of features
  // Genre and tempo are highest priority for next-song continuity
  const weightedScore =
    0.25 * genreScore +      // Genre very important
    0.20 * tempoScore +      // Tempo very important
    0.15 * energyScore +     // Energy important
    0.10 * acousticScore +   // Acoustic character
    0.10 * valenceScore +    // Mood continuation
    0.08 * loudnessScore +   // Production level
    0.07 * danceabilityScore + // Groove
    0.05 * keyScore;         // Harmonic compatibility

  // Apply abrupt transition multiplier
  const abruptPenalty = abruptTransitionPenalty(current, candidate);

  const finalScore = weightedScore * abruptPenalty;

  return {
    score: clamp(finalScore, 0, 1),
    breakdown: {
      genre: round1(genreScore),
      tempo: round1(tempoScore),
      energy: round1(energyScore),
      acoustic: round1(acousticScore),
      valence: round1(valenceScore),
      loudness: round1(loudnessScore),
      danceability: round1(danceabilityScore),
      key: round1(keyScore),
      abruptPenalty: round1(abruptPenalty),
    }
  };
}

/**
 * Harmonic/key compatibility using Camelot wheel
 */
function computeKeyCompatibility(key1, mode1, key2, mode2) {
  if (!Number.isFinite(key1) || !Number.isFinite(key2)) return 0.5;

  const camelotMap = {
    'major': [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1],
    'minor': [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10]
  };

  const modeStr1 = mode1 === 1 ? 'major' : 'minor';
  const modeStr2 = mode2 === 1 ? 'major' : 'minor';

  const camelot1 = camelotMap[modeStr1][key1] || 0;
  const camelot2 = camelotMap[modeStr2][key2] || 0;

  // Compatible keys: 0, 1, 7 steps away on the wheel (1.0, 0.9, 0.7 respectively)
  const dist = Math.abs(camelot1 - camelot2);
  const normalizedDist = Math.min(dist, 12 - dist); // Wrap around

  if (normalizedDist === 0) return 1.0;
  if (normalizedDist === 1) return 0.9;
  if (normalizedDist === 7) return 0.7;

  // Other distances decay smoothly
  return Math.pow(0.95, normalizedDist);
}

export {
  computeTransitionCompatibility,
  genreDistance,
  genreTransitionScore,
  featureSimilarity,
  abruptTransitionPenalty,
};
