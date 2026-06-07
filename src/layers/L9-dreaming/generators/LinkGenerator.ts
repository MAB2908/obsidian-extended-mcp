// v0.2b:
import type { IBM25Engine } from '../../../shared/interfaces/IBM25Engine.js';
import type { DreamTopic, LinkCandidate } from '../types.js';

export interface LinkGeneratorOptions {
  threshold?: number;
  maxCandidates?: number;
}

export function generateLinkCandidates(
  topics: DreamTopic[],
  bm25: IBM25Engine,
  opts: LinkGeneratorOptions = {},
): LinkCandidate[] {
  const threshold = opts.threshold ?? 0.5;
  const maxCandidates = opts.maxCandidates ?? 20;
  const seen = new Set<string>();
  const candidates: LinkCandidate[] = [];

  for (const source of topics) {
    const results = bm25.search(source.title, 10);
    for (const hit of results) {
      if (hit.path === source.path) continue;
      if (hit.score < threshold) continue;

      // skip already linked
      const target = topics.find((t) => t.path === hit.path);
      if (!target) continue;
      if (source.related.includes(target.path) || target.related.includes(source.path)) continue;

      // deduplicate symmetric pairs
      const pairKey = [source.path, target.path].sort().join('::');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      candidates.push({
        kind: 'link',
        sourcePath: source.path,
        targetPath: target.path,
        score: hit.score,
        reason: `BM25 score ${hit.score.toFixed(2)} on title "${source.title}"`,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxCandidates);
}
