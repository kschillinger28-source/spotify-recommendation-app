/**
 * Tests for TIER 2 Scoring Improvements
 * - Energy Arc Planning
 * - 2D Mood Space Continuity
 */

import {
  determineEnergyPhase,
  energyPhaseScore,
  computeEnergyArcScore,
  energyArcBreakdown
} from "./energyArcPlanning.js";

import {
  getMoodQuadrant,
  moodTransitionScore,
  genreMoodAffinityScore,
  computeMoodContinuityScore,
  moodSpaceBreakdown
} from "./moodSpaceContinuity.js";

describe("Energy Arc Planning", () => {
  describe("determineEnergyPhase", () => {
    test("early tracks should be warmup phase", () => {
      expect(determineEnergyPhase(0, 10)).toBe("warmup");
      expect(determineEnergyPhase(2, 10)).toBe("warmup");
      expect(determineEnergyPhase(3, 10)).toBe("climax");
    });

    test("middle tracks should be climax phase", () => {
      expect(determineEnergyPhase(3, 10)).toBe("climax");
      expect(determineEnergyPhase(5, 10)).toBe("climax");
      expect(determineEnergyPhase(6, 10)).toBe("climax");
    });

    test("late tracks should be winddown phase", () => {
      expect(determineEnergyPhase(7, 10)).toBe("winddown");
      expect(determineEnergyPhase(9, 10)).toBe("winddown");
    });
  });

  describe("energyPhaseScore", () => {
    test("should reward energies in target range", () => {
      // Warmup target: 0.25-0.65
      expect(energyPhaseScore(0.45, "warmup")).toBeGreaterThan(0);
      
      // Climax target: 0.60-0.95
      expect(energyPhaseScore(0.80, "climax")).toBeGreaterThan(0);
      
      // Winddown target: 0.15-0.55
      expect(energyPhaseScore(0.35, "winddown")).toBeGreaterThan(0);
    });

    test("should penalize energies outside target range", () => {
      // Warmup: penalize high energy
      expect(energyPhaseScore(0.95, "warmup")).toBeLessThan(0);
      
      // Climax: penalize low energy
      expect(energyPhaseScore(0.30, "climax")).toBeLessThan(0);
      
      // Winddown: penalize high energy
      expect(energyPhaseScore(0.85, "winddown")).toBeLessThan(0);
    });

    test("should return 0 for missing data", () => {
      expect(energyPhaseScore(null, "warmup")).toBe(0);
      expect(energyPhaseScore(undefined, "climax")).toBe(0);
    });
  });

  describe("computeEnergyArcScore", () => {
    test("should compute positive score for well-positioned tracks", () => {
      const candidate = { energy: 0.45 };
      const currentTrack = { energy: 0.50 };
      
      const score = computeEnergyArcScore(candidate, currentTrack, 2); // warmup phase
      expect(score).toBeGreaterThan(0);
    });

    test("should return 0 for missing energy data", () => {
      const candidate = { energy: null };
      const currentTrack = { energy: 0.50 };
      
      expect(computeEnergyArcScore(candidate, currentTrack, 0)).toBe(0);
    });
  });
});

describe("2D Mood Space Continuity", () => {
  describe("getMoodQuadrant", () => {
    test("should classify happy & energetic tracks", () => {
      expect(getMoodQuadrant(0.8, 0.8)).toBe("happyEnergetic");
    });

    test("should classify happy & calm tracks", () => {
      expect(getMoodQuadrant(0.8, 0.3)).toBe("happyCalm");
    });

    test("should classify sad & energetic tracks", () => {
      expect(getMoodQuadrant(0.2, 0.8)).toBe("sadEnergetic");
    });

    test("should classify sad & calm tracks", () => {
      expect(getMoodQuadrant(0.2, 0.3)).toBe("sadCalm");
    });

    test("should return null for missing data", () => {
      expect(getMoodQuadrant(null, 0.5)).toBe(null);
      expect(getMoodQuadrant(0.5, null)).toBe(null);
      expect(getMoodQuadrant(undefined, undefined)).toBe(null);
    });
  });

  describe("moodTransitionScore", () => {
    test("should reward same quadrant transitions", () => {
      const score = moodTransitionScore("happyEnergetic", "happyEnergetic");
      expect(score).toBe(4);
    });

    test("should reward adjacent quadrant transitions", () => {
      // Same valence (happy), different energy
      const score1 = moodTransitionScore("happyEnergetic", "happyCalm");
      expect(score1).toBe(2);
      
      // Same energy (energetic), different valence
      const score2 = moodTransitionScore("happyEnergetic", "sadEnergetic");
      expect(score2).toBe(2);
    });

    test("should penalize opposite quadrant transitions (mood whiplash)", () => {
      const score = moodTransitionScore("happyEnergetic", "sadCalm");
      expect(score).toBe(-3);
    });

    test("should return 0 for missing quadrants", () => {
      expect(moodTransitionScore(null, "happyEnergetic")).toBe(0);
      expect(moodTransitionScore("happyEnergetic", null)).toBe(0);
    });
  });

  describe("genreMoodAffinityScore", () => {
    test("should reward genre-mood alignment", () => {
      // 'chill' is a calm genre, should score well in calm quadrant
      const score = genreMoodAffinityScore(["chill"], "happyCalm");
      expect(score).toBeGreaterThan(0);
    });

    test("should penalize genre-mood mismatch", () => {
      // 'dance' is an energetic genre, should score poorly in calm quadrant
      const score = genreMoodAffinityScore(["dance"], "sadCalm");
      expect(score).toBeLessThan(0);
    });

    test("should return 0 for missing genres", () => {
      expect(genreMoodAffinityScore([], "happyEnergetic")).toBe(0);
      expect(genreMoodAffinityScore(null, "happyEnergetic")).toBe(0);
    });
  });

  describe("computeMoodContinuityScore", () => {
    test("should compute positive score for same-quadrant tracks", () => {
      const candidate = { valence: 0.8, energy: 0.8, genreTags: ["pop"] };
      const currentTrack = { valence: 0.75, energy: 0.75 };
      
      const score = computeMoodContinuityScore(candidate, currentTrack);
      expect(score).toBeGreaterThan(0);
    });

    test("should compute negative score for opposite-quadrant tracks", () => {
      const candidate = { valence: 0.2, energy: 0.2, genreTags: [] };
      const currentTrack = { valence: 0.8, energy: 0.8 };
      
      const score = computeMoodContinuityScore(candidate, currentTrack);
      expect(score).toBeLessThan(0);
    });

    test("should return 0 for missing mood data", () => {
      const candidate = { valence: null, energy: null, genreTags: [] };
      const currentTrack = { valence: 0.5, energy: 0.5 };
      
      expect(computeMoodContinuityScore(candidate, currentTrack)).toBe(0);
    });
  });

  describe("moodSpaceBreakdown", () => {
    test("should provide detailed breakdown", () => {
      const candidate = { valence: 0.8, energy: 0.8, genreTags: [] };
      const currentTrack = { valence: 0.75, energy: 0.75 };
      
      const breakdown = moodSpaceBreakdown(candidate, currentTrack);
      
      expect(breakdown).toHaveProperty("moodContinuityScore");
      expect(breakdown).toHaveProperty("currentQuadrant");
      expect(breakdown).toHaveProperty("candidateQuadrant");
      expect(breakdown).toHaveProperty("transitionType");
      expect(breakdown.transitionType).toBe("same");
    });
  });
});

export { /* tests export for CI/CD */ };
