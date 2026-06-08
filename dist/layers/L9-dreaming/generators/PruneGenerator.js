const DAY_MS = 24 * 60 * 60 * 1000;
export function generatePruneCandidates(topics, opts = {}) {
    const maxCandidates = opts.maxCandidates ?? 20;
    const staleDaysDraft = opts.staleDaysDraft ?? 60;
    const staleDaysValidated = opts.staleDaysValidated ?? 120;
    const importanceThreshold = opts.importanceThreshold ?? 35;
    const now = Date.now();
    const candidates = [];
    for (const topic of topics) {
        // Core immunity: never prune core objects
        if (topic.signals.maturity === 'core')
            continue;
        const ageMs = now - topic.mtimeMs;
        const staleMs = topic.signals.maturity === 'draft' ? staleDaysDraft * DAY_MS : staleDaysValidated * DAY_MS;
        let score = 0;
        const reasons = [];
        if (topic.signals.importance < importanceThreshold) {
            score += (importanceThreshold - topic.signals.importance) / importanceThreshold;
            reasons.push(`importance ${topic.signals.importance} < ${importanceThreshold}`);
        }
        if (ageMs > staleMs) {
            score += ageMs / staleMs - 1;
            reasons.push(`stale ${Math.round(ageMs / DAY_MS)}d > ${Math.round(staleMs / DAY_MS)}d`);
        }
        if (topic.signals.accessCount === 0 && ageMs > staleDaysDraft * DAY_MS) {
            score += 0.5;
            reasons.push('zero access');
        }
        if (score > 0) {
            candidates.push({
                kind: 'prune',
                path: topic.path,
                score: Math.min(score, 10),
                reason: reasons.join('; '),
                signals: topic.signals,
            });
        }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxCandidates);
}
//# sourceMappingURL=PruneGenerator.js.map