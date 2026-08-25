/**
 * Tests for TIER 2 Frontend Improvements
 * Feature 1: Recommendation Transparency & Metadata Cards
 * Feature 2: Search Pagination + Smart Filters
 */

describe('Feature 1: Metadata Cards', () => {
  describe('BPM Match Calculation', () => {
    test('should calculate BPM match percentage correctly', () => {
      const result = window.computeBpmMatch(120, 120);
      expect(result.matchPercent).toBe(100);
      expect(result.quality).toBe('high');
    });

    test('should handle half/double tempo correctly', () => {
      const result = window.computeBpmMatch(120, 60);
      expect(result.quality).toBe('medium');
    });

    test('should return null for invalid tempos', () => {
      const result = window.computeBpmMatch(null, 120);
      expect(result).toBeNull();
    });
  });

  describe('Energy Level Calculation', () => {
    test('should convert Spotify energy (0-1) to 1-5 scale', () => {
      const result = window.computeEnergyLevel(1.0);
      expect(result.level).toBe(5);
      expect(result.raw).toBe(100);
    });

    test('should clamp energy level to 1-5 range', () => {
      const resultLow = window.computeEnergyLevel(0.0);
      expect(resultLow.level).toBe(1);

      const resultHigh = window.computeEnergyLevel(1.0);
      expect(resultHigh.level).toBe(5);
    });
  });
});

describe('Feature 2: Search Pagination & Filters', () => {
  describe('Search Caching', () => {
    test('should cache search results with correct key', () => {
      const query = 'test';
      const filters = { minPopularity: 50 };
      const results = [{ id: '1', name: 'Track 1' }];

      window.cacheSearchResults(query, filters, results);
      const cached = window.getSearchResultsFromCache(query, filters);
      expect(cached).toEqual(results);
    });
  });

  describe('Filter Application', () => {
    test('should filter results by popularity', () => {
      const results = [
        { id: '1', name: 'Track 1', popularity: 30 },
        { id: '2', name: 'Track 2', popularity: 70 },
        { id: '3', name: 'Track 3', popularity: 90 }
      ];

      const filtered = window.getFilteredResults(results, { minPopularity: 50 });
      expect(filtered).toHaveLength(2);
      expect(filtered.map(t => t.id)).toEqual(['2', '3']);
    });
  });

  describe('Pagination', () => {
    test('should paginate results correctly', () => {
      const results = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        name: `Track ${i}`
      }));

      const page1 = window.getPaginatedResults(results, 1);
      expect(page1.results).toHaveLength(20);
      expect(page1.totalPages).toBe(3);
      expect(page1.currentPage).toBe(1);
    });
  });
});
