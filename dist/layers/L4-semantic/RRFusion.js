import { semanticConfig } from '../../shared/config.js';
export function reciprocalRankFusion(keywordResults, semanticResults) {
    const scores = new Map();
    const snippets = new Map();
    const highlights = new Map();
    for (let i = 0; i < keywordResults.length; i++) {
        const r = keywordResults[i];
        scores.set(r.path, (scores.get(r.path) || 0) + 1 / (semanticConfig.rrfK + i + 1));
        if (!snippets.has(r.path))
            snippets.set(r.path, r.snippet);
        if (!highlights.has(r.path))
            highlights.set(r.path, r.highlights);
    }
    for (let i = 0; i < semanticResults.length; i++) {
        const r = semanticResults[i];
        scores.set(r.path, (scores.get(r.path) || 0) + 1 / (semanticConfig.rrfK + i + 1));
        if (!snippets.has(r.path))
            snippets.set(r.path, r.snippet);
        if (!highlights.has(r.path))
            highlights.set(r.path, r.highlights);
    }
    const merged = [];
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
//# sourceMappingURL=RRFusion.js.map