import { describe, it, expect } from '@jest/globals';
import {
  computeTransitionCompatibility,
  genreDistance,
  genreTransitionScore,
  featureSimilarity,
  abruptTransitionPenalty,
} from '../transitionCompatibility.js';

describe('Transition Compatibility Scoring', () => {
  describe('Genre Distance', () => {
    it('should have zero distance for same genre', () => {
      expect(genreDistance('country', 'country')).toBe(0);
      expect(genreDistance('rock', 'rock')).toBe(0);
    });

    it('should measure short distances for adjacent genres', () => {
      expect(genreDistance('country', 'country-rock')).toBe(1);
      expect(genreDistance('rock', 'classic-rock')).toBe(1);
      expect(genreDistance('house', 'deep-house')).toBe(1);
    });

    it('should measure medium distances for related genres', () => {
      expect(genreDistance('country', 'southern-rock')).toBe(2);
      expect(genreDistance('country', 'rock')).toBe(2);
    });

    it('should measure large distances for unrelated genres', () => {
      const countryToMetal = genreDistance('country', 'metal');
      expect(countryToMetal).toBeGreaterThan(3);
    });

    it('should return high penalty for unknown genres', () => {
      const unknownDistance = genreDistance('country', 'unknown-genre-xyz');
      expect(unknownDistance).toBe(10);
    });

    it('should handle null/undefined gracefully', () => {
      expect(genreDistance(null, 'rock')).toBe(10);
      expect(genreDistance('rock', undefined)).toBe(10);
    });
  });

  describe('Genre Transition Score', () => {
    it('should give 1.0 for same genre', () => {
      const score = genreTransitionScore(['country'], ['country']);
      expect(score).toBe(1.0);
    });

    it('should give high score for adjacent genres', () => {
      const score = genreTransitionScore(['country'], ['country-rock']);
      expect(score).toBeGreaterThan(0.8);
    });

    it('should give medium score for moderate genre jumps', () => {
      const score = genreTransitionScore(['country'], ['southern-rock']);
      expect(score).toBeGreaterThan(0.6);
      expect(score).toBeLessThan(0.8);
    });

    it('should heavily penalize large genre jumps', () => {
      const countryToMetal = genreTransitionScore(['country'], ['metal']);
      const countryToHardRock = genreTransitionScore(['country'], ['hard-rock']);

      expect(countryToMetal).toBeLessThan(0.2);
      expect(countryToHardRock).toBeLessThan(0.3);
    });

    it('should handle multiple genres and pick best match', () => {
      // If candidate has both 'metal' and 'country-rock', should pick country-rock
      const score = genreTransitionScore(['country'], ['metal', 'country-rock']);
      expect(score).toBeGreaterThan(0.7);
    });

    it('should return neutral score for missing data', () => {
      const score = genreTransitionScore([], []);
      expect(score).toBe(0.5);
    });
  });

  describe('Feature Similarity', () => {
    it('should return 1.0 for identical values', () => {
      expect(featureSimilarity(100, 100, 20)).toBe(1.0);
      expect(featureSimilarity(0.5, 0.5, 0.2)).toBe(1.0);
    });

    it('should decay smoothly with larger deltas', () => {
      const score1 = featureSimilarity(100, 105, 20);  // Small delta
      const score2 = featureSimilarity(100, 115, 20);  // Larger delta
      const score3 = featureSimilarity(100, 150, 20);  // Very large delta

      expect(score1).toBeGreaterThan(score2);
      expect(score2).toBeGreaterThan(score3);
      expect(score3).toBeGreaterThan(0);
    });

    it('should handle missing data appropriately', () => {
      expect(featureSimilarity(null, 100, 20, false)).toBe(0.5);   // Required feature
      expect(featureSimilarity(null, 100, 20, true)).toBe(1.0);    // Optional feature
    });
  });

  describe('Abrupt Transition Penalty', () => {
    it('should return 1.0 for small simultaneous changes', () => {
      const current = {
        tempo: 100,
        energy: 0.5,
        loudness: -5,
        acousticness: 0.4,
      };
      const candidate = {
        tempo: 105,
        energy: 0.52,
        loudness: -5.5,
        acousticness: 0.39,
      };

      const penalty = abruptTransitionPenalty(current, candidate);
      expect(penalty).toBeCloseTo(1.0, 2);
    });

    it('should penalize multiple simultaneous large jumps', () => {
      const current = {
        tempo: 100,
        energy: 0.3,
        loudness: -8,
        acousticness: 0.8,
      };
      const candidate = {
        tempo: 150,  // +50% BPM jump
        energy: 0.9,  // +0.6 energy jump
        loudness: -3, // +5dB loudness jump
        acousticness: 0.2, // -0.6 acousticness jump
      };

      const penalty = abruptTransitionPenalty(current, candidate);
      expect(penalty).toBeLessThan(0.5);
    });

    it('should allow one significant jump with minimal penalty', () => {
      const current = {
        tempo: 100,
        energy: 0.5,
        loudness: -5,
        acousticness: 0.5,
      };
      const candidate = {
        tempo: 140,   // Significant BPM jump
        energy: 0.51, // Minimal energy change
        loudness: -5.1,
        acousticness: 0.49,
      };

      const penalty = abruptTransitionPenalty(current, candidate);
      expect(penalty).toBeCloseTo(1.0, 1); // Minimal penalty for single jump
    });
  });

  describe('Full Transition Compatibility', () => {
    const mellowCountry = {
      genreTags: ['country', 'acoustic'],
      tempo: 92,
      energy: 0.4,
      acousticness: 0.75,
      valence: 0.5,
      loudness: -7,
      danceability: 0.45,
      key: 0,
      mode: 1,
    };

    const acdc = {
      genreTags: ['rock', 'hard-rock', 'metal'],
      tempo: 135,
      energy: 0.95,
      acousticness: 0.05,
      valence: 0.7,
      loudness: -3,
      danceability: 0.8,
      key: 7,
      mode: 1,
    };

    const countryRock = {
      genreTags: ['country-rock', 'rock'],
      tempo: 105,
      energy: 0.65,
      acousticness: 0.45,
      valence: 0.55,
      loudness: -5.5,
      danceability: 0.6,
      key: 2,
      mode: 1,
    };

    const southernRock = {
      genreTags: ['southern-rock', 'classic-rock'],
      tempo: 112,
      energy: 0.72,
      acousticness: 0.25,
      valence: 0.6,
      loudness: -5,
      danceability: 0.65,
      key: 5,
      mode: 1,
    };

    it('should give HIGH score to mellow country -> country-rock', () => {
      const result = computeTransitionCompatibility(mellowCountry, countryRock);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should give LOW score to mellow country -> AC/DC-style hard rock', () => {
      const result = computeTransitionCompatibility(mellowCountry, acdc);
      expect(result.score).toBeLessThan(0.25);
    });

    it('should give MEDIUM-HIGH score to mellow country -> southern rock', () => {
      const result = computeTransitionCompatibility(mellowCountry, southernRock);
      const score = result.score;
      expect(score).toBeGreaterThan(0.4);
      expect(score).toBeLessThan(0.7);
    });

    it('should explain why country -> AC/DC fails', () => {
      const result = computeTransitionCompatibility(mellowCountry, acdc);

      // All of these should be low:
      expect(result.breakdown.genre).toBeLessThan(0.2);      // Massive genre jump
      expect(result.breakdown.energy).toBeLessThan(0.3);    // Energy nearly doubles
      expect(result.breakdown.tempo).toBeLessThan(0.5);     // 47% BPM jump
      expect(result.breakdown.acoustic).toBeLessThan(0.1);  // Acoustic -> electric
      expect(result.breakdown.abruptPenalty).toBeLessThan(0.7); // Multiple large jumps
    });

    it('should explain why country -> country-rock works', () => {
      const result = computeTransitionCompatibility(mellowCountry, countryRock);

      // Most should be high:
      expect(result.breakdown.genre).toBeGreaterThan(0.7);       // Adjacent genres
      expect(result.breakdown.tempo).toBeGreaterThan(0.7);       // ±14% is acceptable
      expect(result.breakdown.energy).toBeGreaterThan(0.6);      // Moderate increase
      expect(result.breakdown.abruptPenalty).toBeGreaterThan(0.8); // No massive jumps
    });
  });

  describe('Edge Cases', () => {
    it('should handle tracks with minimal metadata', () => {
      const current = {
        genreTags: [],
        // No audio features
      };
      const candidate = {
        genreTags: ['pop'],
        energy: 0.6,
      };

      const result = computeTransitionCompatibility(current, candidate);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle same track gracefully', () => {
      const track = {
        genreTags: ['pop'],
        tempo: 120,
        energy: 0.7,
        acousticness: 0.3,
        valence: 0.6,
        loudness: -4,
        danceability: 0.75,
        key: 0,
        mode: 1,
      };

      const result = computeTransitionCompatibility(track, track);
      expect(result.score).toBe(1.0);
    });

    it('should clamp results to [0, 1]', () => {
      const current = { genreTags: [], tempo: 100, energy: 0.5 };
      const candidate = { genreTags: [], tempo: 200, energy: 0.99 };

      const result = computeTransitionCompatibility(current, candidate);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });
});
