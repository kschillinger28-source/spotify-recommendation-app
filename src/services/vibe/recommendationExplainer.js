/**
 * Recommendation Explainability
 *
 * Generates human-readable debugging output explaining why a track was recommended.
 * Used for development/debugging only — not shown in production UI.
 */

function round2(val) {
  return Math.round(val * 100) / 100;
}

/**
 * Generate a score breakdown for a recommended track
 * Shows all the factors that contributed to the score
 */
function generateRecommendationExplanation(candidate, currentTrack, context = {}) {
  const explanation = {
    candidateTrack: {
      id: candidate.id,
      name: candidate.name,
      artist: candidate.artists?.[0]?.name,
      genres: candidate.genreTags || [],
      uri: candidate.uri,
    },
    currentTrack: {
      id: currentTrack.id,
      name: currentTrack.name,
      artist: currentTrack.artists?.[0]?.name,
      genres: currentTrack.genreTags || [],
    },
    scores: {},
    reasoning: [],
  };

  // Transition compatibility breakdown (if available)
  if (candidate._transitionDebug) {
    const trans = candidate._transitionDebug;
    explanation.scores.transitionCompatibility = {
      overall: round2(Object.values(trans)
        .filter(v => v !== 1 && v !== 0) // Filter multipliers
        .reduce((a, b) => a + b, 0) / 8),
      genre: round2(trans.genre),
      tempo: round2(trans.tempo),
      energy: round2(trans.energy),
      acoustic: round2(trans.acoustic),
      valence: round2(trans.valence),
      loudness: round2(trans.loudness),
      danceability: round2(trans.danceability),
      key: round2(trans.key),
      abruptPenalty: round2(trans.abruptPenalty),
    };

    // Add reasoning based on transition score
    if (trans.genre < 0.5) {
      explanation.reasoning.push(
        `⚠️ Genre jump: ${currentTrack.genreTags?.[0]} → ${candidate.genreTags?.[0]}`
      );
    }

    if (trans.tempo < 0.5) {
      const tempoDelta = Math.abs(currentTrack.tempo - candidate.tempo);
      explanation.reasoning.push(
        `⚠️ BPM jump: ${currentTrack.tempo} → ${candidate.tempo} BPM (Δ${tempoDelta})`
      );
    }

    if (trans.energy < 0.4) {
      explanation.reasoning.push(
        `⚠️ Energy drop: ${round2(currentTrack.energy)} → ${round2(candidate.energy)}`
      );
    }

    if (trans.abruptPenalty < 0.7) {
      explanation.reasoning.push(
        '⚠️ Abrupt transition: Multiple large feature changes simultaneously'
      );
    }

    if (trans.genre > 0.7 && trans.tempo > 0.7 && trans.energy > 0.6) {
      explanation.reasoning.push(
        '✅ Strong musical continuity across genre, tempo, and energy'
      );
    }
  }

  return explanation;
}

/**
 * Compare two candidates by their transition compatibility
 * Useful for debugging why one track beat another
 */
function compareRecommendations(current, candidate1, candidate2) {
  return {
    comparison: {
      current: {
        name: current.name,
        artist: current.artists?.[0]?.name,
      },
      candidateA: {
        name: candidate1.name,
        artist: candidate1.artists?.[0]?.name,
        transitionScore: candidate1._transitionDebug ?
          round2(Object.values(candidate1._transitionDebug)
            .filter(v => typeof v === 'number')
            .reduce((a, b) => a + b, 0) / 8) : null,
      },
      candidateB: {
        name: candidate2.name,
        artist: candidate2.artists?.[0]?.name,
        transitionScore: candidate2._transitionDebug ?
          round2(Object.values(candidate2._transitionDebug)
            .filter(v => typeof v === 'number')
            .reduce((a, b) => a + b, 0) / 8) : null,
      },
    },
    reasoning: {
      genreDistance: {
        A: candidate1._transitionDebug?.genre,
        B: candidate2._transitionDebug?.genre,
        winner: candidate1._transitionDebug?.genre > candidate2._transitionDebug?.genre ? 'A' : 'B',
      },
      tempoMatch: {
        A: candidate1._transitionDebug?.tempo,
        B: candidate2._transitionDebug?.tempo,
        winner: candidate1._transitionDebug?.tempo > candidate2._transitionDebug?.tempo ? 'A' : 'B',
      },
      energyMatch: {
        A: candidate1._transitionDebug?.energy,
        B: candidate2._transitionDebug?.energy,
        winner: candidate1._transitionDebug?.energy > candidate2._transitionDebug?.energy ? 'A' : 'B',
      },
    },
  };
}

/**
 * Generate a diagnostic report for the entire recommendation
 * Shows the top N candidates and their scores
 */
function generateRecommendationReport(currentTrack, candidates, topN = 5) {
  // Sort by final score (estimated from _transitionDebug if available)
  const sorted = [...candidates].sort((a, b) => {
    const scoreA = a._transitionDebug ?
      Object.values(a._transitionDebug).reduce((s, v) => s + v, 0) / 9 : 0;
    const scoreB = b._transitionDebug ?
      Object.values(b._transitionDebug).reduce((s, v) => s + v, 0) / 9 : 0;
    return scoreB - scoreA;
  });

  return {
    currentTrack: {
      name: currentTrack.name,
      artist: currentTrack.artists?.[0]?.name,
      genres: currentTrack.genreTags,
      tempo: currentTrack.tempo,
      energy: currentTrack.energy,
    },
    topRecommendations: sorted.slice(0, topN).map((c, idx) => ({
      rank: idx + 1,
      name: c.name,
      artist: c.artists?.[0]?.name,
      genres: c.genreTags,
      tempo: c.tempo,
      energy: c.energy,
      transitionScore: c._transitionDebug ? round2(
        Object.values(c._transitionDebug).reduce((s, v) => s + v, 0) / 9
      ) : null,
      breakdown: c._transitionDebug ? {
        genre: round2(c._transitionDebug.genre),
        tempo: round2(c._transitionDebug.tempo),
        energy: round2(c._transitionDebug.energy),
        acoustic: round2(c._transitionDebug.acoustic),
        key: round2(c._transitionDebug.key),
      } : null,
    })),
    developerNotes: [
      'Transition scores based on DJ-style continuity: genre distance, BPM compatibility, energy progression',
      'Scores > 0.7 are strong continuations; scores < 0.4 indicate jarring transitions',
      'Abrupt penalty flags simultaneous large jumps (e.g., genre + BPM + energy all jumping)',
    ],
  };
}

export {
  generateRecommendationExplanation,
  compareRecommendations,
  generateRecommendationReport,
};
