// v0.2b:
import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from '../src/layers/L4-semantic/RRFusion.js';
import type { SearchResult } from '../src/shared/types.js';

describe('RRFusion', () => {
  it('fuses two result sets', () => {
    const keyword: SearchResult[] = [
      { path: 'a.md', score: 10, snippet: '', highlights: [] },
      { path: 'b.md', score: 8, snippet: '', highlights: [] },
    ];
    const semantic: SearchResult[] = [
      { path: 'b.md', score: 0.9, snippet: '', highlights: [] },
      { path: 'c.md', score: 0.8, snippet: '', highlights: [] },
    ];
    const fused = reciprocalRankFusion(keyword, semantic);
    expect(fused.length).toBe(3);
    // b appears in both, should be ranked highest
    expect(fused[0].path).toBe('b.md');
  });

  it('handles empty inputs', () => {
    const fused = reciprocalRankFusion([], []);
    expect(fused.length).toBe(0);
  });

  it('prioritizes docs present in both lists', () => {
    const keyword: SearchResult[] = [
      { path: 'x.md', score: 5, snippet: '', highlights: [] },
      { path: 'y.md', score: 4, snippet: '', highlights: [] },
      { path: 'z.md', score: 3, snippet: '', highlights: [] },
    ];
    const semantic: SearchResult[] = [
      { path: 'z.md', score: 0.95, snippet: '', highlights: [] },
      { path: 'y.md', score: 0.9, snippet: '', highlights: [] },
      { path: 'w.md', score: 0.8, snippet: '', highlights: [] },
    ];
    const fused = reciprocalRankFusion(keyword, semantic);
    // y and z appear in both, should be top 2 (order depends on exact RRF math)
    const topPaths = fused.slice(0, 2).map((r) => r.path);
    expect(topPaths).toContain('y.md');
    expect(topPaths).toContain('z.md');
  });
});
