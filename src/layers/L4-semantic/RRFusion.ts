// v0.1b:
import type { SearchResult } from '../../shared/types.js';
import { semanticConfig } from '../../shared/config.js';

export function reciprocalRankFusion(
  keywordResults: SearchResult[],
  semanticResults: SearchResult[]
): SearchResult[] {
  const scores = new Map<string, number>();
  const snippets = new Map<string, string>();
  const highlights = new Map<string, string[]>();

  for (let i = 0; i < keywordResults.length; i++) {
    const r = keywordResults[i];
    scores.set(r.path, (scores.get(r.path) || 0) + 1 / (semanticConfig.rrfK + i + 1));
    if (!snippets.has(r.path)) snippets.set(r.path, r.snippet);
    if (!highlights.has(r.path)) highlights.set(r.path, r.highlights);
  }

  for (let i = 0; i < semanticResults.length; i++) {
    const r = semanticResults[i];
    scores.set(r.path, (scores.get(r.path) || 0) + 1 / (semanticConfig.rrfK + i + 1));
    if (!snippets.has(r.path)) snippets.set(r.path, r.snippet);
    if (!highlights.has(r.path)) highlights.set(r.path, r.highlights);
  }

  const merged: SearchResult[] = [];
  for (const [path, score] of scores) {
    merged.push({
      path,
      score,
      snippet: snippets.get(path) || '',
      highlights: highlights.get(path) || [],
    });
  }

  merged.sort((a, b) => b.score - a.score);
  return merged;
}
