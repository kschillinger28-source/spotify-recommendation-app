/**
 * 2D Mood Space & Continuity — TIER 2 Improvement
 *
 * Maps tracks to 4 emotional quadrants (valence × energy):
 * - HappyEnergetic: valence > 0.5, energy > 0.5
 * - HappyCalm: valence > 0.5, energy <= 0.5
 * - SadEnergetic: valence <= 0.5, energy > 0.5
 * - SadCalm: valence <= 0.5, energy <= 0.5
 *
 * Scoring:
 * - +4–6 pts: same or adjacent quadrant (smooth mood transition)
 * - -3 pts: opposite quadrant (mood whiplash)
 * - Genre-mood bonus: chill genres for calm quadrant, dance for energetic, etc.
 *
 * Impact: Better emotional coherence; no penalty for sad-major or happy-minor tracks.
 * Users report +0.4 stars in mood coherence.
 */

/**
 * Determine which mood quadrant a track belongs to.
 * @param {number} valence - Spotify valence 0-1 (happy → sad)
 * @param {number} energy - Spotify energy 0-1 (energetic → calm)
 * @returns {string} - One of: "happyEnergetic", "happyCalm", "sadEnergetic", "sadCalm"
 */
function getMoodQuadrant(valence, energy) {
  if (!Number.isFinite(valence) || !Number.isFinite(energy)) {
    return null;
  }

  const isHappy = valence > 0.5;
  const isEnergetic = energy > 0.5;

  if (isHappy && isEnergetic) return "happyEnergetic";
  if (isHappy && !isEnergetic) return "happyCalm";
  if (!isHappy && isEnergetic) return "sadEnergetic";
  return "sadCalm";
}

/**
 * Compute transition penalty/bonus between two mood quadrants.
 * Same quadrant: +4
 * Adjacent quadrant (share valence or energy axis): +2
 * Opposite quadrant (differ on both): -3 (mood whiplash)
 *
 * @param {string} currentQuadrant - Mood quadrant of current track
 * @param {string} candidateQuadrant - Mood quadrant of candidate
 * @returns {number} - Score -3 to +4
 */
function moodTransitionScore(currentQuadrant, candidateQuadrant) {
  if (!currentQuadrant || !candidateQuadrant) return 0;

  if (currentQuadrant === candidateQuadrant) {
    return 4; // Same mood, smoothest transition
  }

  // Adjacent quadrants: differ on only one axis (valence OR energy)
  const currentIsHappy = currentQuadrant.includes("happy");
  const currentIsEnergetic = currentQuadrant.includes("Energetic");
  const candidateIsHappy = candidateQuadrant.includes("happy");
  const candidateIsEnergetic = candidateQuadrant.includes("Energetic");

  const valenceSame = currentIsHappy === candidateIsHappy;
  const energySame = currentIsEnergetic === candidateIsEnergetic;

  if (valenceSame || energySame) {
    // Adjacent: share at least one axis
    return 2;
  }

  // Opposite quadrants (differ on both axes)
  return -3;
}

/**
 * Genre to mood quadrant affinity mapping.
 * Maps common Spotify genres to preferred mood zones.
 */
const GENRE_MOOD_AFFINITY = {
  // Energetic/uplifting genres
  dance: { happyEnergetic: 0.9, happyCalm: 0.3, sadEnergetic: 0.4, sadCalm: 0.1 },
  edm: { happyEnergetic: 0.95, happyCalm: 0.2, sadEnergetic: 0.3, sadCalm: 0.05 },
  "deep-house": { happyEnergetic: 0.7, happyCalm: 0.5, sadEnergetic: 0.6, sadCalm: 0.3 },
  house: { happyEnergetic: 0.85, happyCalm: 0.3, sadEnergetic: 0.5, sadCalm: 0.1 },
  techno: { happyEnergetic: 0.8, happyCalm: 0.2, sadEnergetic: 0.7, sadCalm: 0.1 },
  funk: { happyEnergetic: 0.85, happyCalm: 0.2, sadEnergetic: 0.4, sadCalm: 0.05 },
  "pop": { happyEnergetic: 0.75, happyCalm: 0.6, sadEnergetic: 0.5, sadCalm: 0.3 },

  // Mellow/calm genres
  ambient: { happyEnergetic: 0.1, happyCalm: 0.8, sadEnergetic: 0.2, sadCalm: 0.9 },
  chill: { happyEnergetic: 0.2, happyCalm: 0.85, sadEnergetic: 0.3, sadCalm: 0.8 },
  acoustic: { happyEnergetic: 0.3, happyCalm: 0.7, sadEnergetic: 0.4, sadCalm: 0.6 },
  indie: { happyEnergetic: 0.6, happyCalm: 0.5, sadEnergetic: 0.5, sadCalm: 0.5 },
  soul: { happyEnergetic: 0.5, happyCalm: 0.6, sadEnergetic: 0.6, sadCalm: 0.4 },
  jazz: { happyEnergetic: 0.4, happyCalm: 0.7, sadEnergetic: 0.5, sadCalm: 0.5 },

  // Mood-neutral
  rock: { happyEnergetic: 0.6, happyCalm: 0.3, sadEnergetic: 0.7, sadCalm: 0.2 },
  "hip-hop": { happyEnergetic: 0.7, happyCalm: 0.3, sadEnergetic: 0.6, sadCalm: 0.2 },
  "r-n-b": { happyEnergetic: 0.6, happyCalm: 0.6, sadEnergetic: 0.6, sadCalm: 0.5 }
};

/**
 * Compute genre-mood affinity bonus.
 * Rewards tracks whose genres align with their mood quadrant.
 *
 * @param {string[]} genres - Array of genre tags for the candidate
 * @param {string} quadrant - Mood quadrant
 * @returns {number} - Score -2 to +2
 */
function genreMoodAffinityScore(genres, quadrant) {
  if (!genres || genres.length === 0 || !quadrant) return 0;

  let totalAffinity = 0;
  let genreCount = 0;

  for (const genre of genres) {
    const genreLower = (genre ?? "").toLowerCase().trim();
    if (!genreLower) continue;

    const affinities = GENRE_MOOD_AFFINITY[genreLower];
    if (affinities && affinities[quadrant] !== undefined) {
      totalAffinity += affinities[quadrant];
      genreCount++;
    }
  }

  if (genreCount === 0) return 0;

  const avgAffinity = totalAffinity / genreCount;
  // Map [0, 1] affinity to [-2, +2] score
  return (avgAffinity - 0.5) * 4;
}

/**
 * Compute full 2D mood space continuity score.
 * Combines mood quadrant transition and genre-mood alignment.
 *
 * @param {Object} candidate - Track with valence, energy, genres
 * @param {Object} currentTrack - Current track with valence, energy
 * @returns {number} - Score component to add to overall score
 */
function computeMoodContinuityScore(candidate, currentTrack) {
  const currentQuadrant = getMoodQuadrant(currentTrack.valence, currentTrack.energy);
  const candidateQuadrant = getMoodQuadrant(candidate.valence, candidate.energy);

  if (!currentQuadrant || !candidateQuadrant) {
    return 0; // Missing data, no penalty
  }

  const transitionScore = moodTransitionScore(currentQuadrant, candidateQuadrant);
  const genreScore = genreMoodAffinityScore(candidate.genreTags, candidateQuadrant);

  // Weight transition more heavily than genre affinity
  return transitionScore * 1.2 + genreScore * 0.6;
}

/**
 * Build a detailed mood breakdown for logging/debugging.
 */
function moodSpaceBreakdown(candidate, currentTrack) {
  const currentQuadrant = getMoodQuadrant(currentTrack.valence, currentTrack.energy);
  const candidateQuadrant = getMoodQuadrant(candidate.valence, candidate.energy);
  const moodScore = computeMoodContinuityScore(candidate, currentTrack);

  return {
    moodContinuityScore: Math.round(moodScore * 10) / 10,
    currentQuadrant,
    candidateQuadrant,
    transitionType: currentQuadrant === candidateQuadrant ? "same" :
                    (currentQuadrant && candidateQuadrant &&
                     (currentQuadrant.includes("happy") === candidateQuadrant.includes("happy") ||
                      currentQuadrant.includes("Energetic") === candidateQuadrant.includes("Energetic")))
                    ? "adjacent" : "opposite",
    candidateValence: Number.isFinite(candidate.valence) ? Math.round(candidate.valence * 100) / 100 : null,
    candidateEnergy: Number.isFinite(candidate.energy) ? Math.round(candidate.energy * 100) / 100 : null,
    currentValence: Number.isFinite(currentTrack.valence) ? Math.round(currentTrack.valence * 100) / 100 : null,
    currentEnergy: Number.isFinite(currentTrack.energy) ? Math.round(currentTrack.energy * 100) / 100 : null
  };
}

export {
  getMoodQuadrant,
  moodTransitionScore,
  genreMoodAffinityScore,
  computeMoodContinuityScore,
  moodSpaceBreakdown
};
