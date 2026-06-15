// v0.2b:
import type { SearchResult } from '../../../shared/types.js';
import type { DreamTopic, MergeCandidate } from '../types.js';

export interface MergeGeneratorOptions {
  threshold?: number;
  maxCandidates?: number;
}

export function generateMergeCandidates(
  topics: DreamTopic[],
  search: (query: string, limit: number) => SearchResult[],
  opts: MergeGeneratorOptions = {},
): MergeCandidate[] {
  const threshold = opts.threshold ?? 0.85;
  const maxCandidates = opts.maxCandidates ?? 20;
  const seen = new Set<string>();
  const candidates: MergeCandidate[] = [];

  for (const source of topics) {
    const query = `${source.title} ${source.summary}`;
    const results = search(query, 5);
    for (const hit of results) {
      if (hit.path === source.path) continue;
      if (hit.score < threshold) continue;

      const target = topics.find((t) => t.path === hit.path);
      if (!target) continue;

      const pairKey = [source.path, target.path].sort().join('::');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      candidates.push({
        kind: 'merge',
        sourcePath: source.path,
        targetPath: target.path,
        score: hit.score,
        reason: `High similarity (FTS5 ${hit.score.toFixed(2)}) between "${source.title}" and "${target.title}"`,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxCandidates);
}
