export function generateSynthesizeCandidates(topics, opts = {}) {
    const minNotes = opts.minNotesPerDomain ?? 2;
    const maxCandidates = opts.maxCandidates ?? 10;
    // Group by domain
    const byDomain = new Map();
    for (const t of topics) {
        const list = byDomain.get(t.domain) ?? [];
        list.push(t);
        byDomain.set(t.domain, list);
    }
    const candidates = [];
    for (const [domain, notes] of byDomain) {
        if (notes.length < minNotes)
            continue;
        const score = notes.length;
        const title = domain.charAt(0).toUpperCase() + domain.slice(1);
        candidates.push({
            kind: 'synthesize',
            domain,
            paths: notes.map((n) => n.path),
            score,
            reason: `${notes.length} notes in domain "${domain}" — consider an overview MOC`,
            proposedTitle: `${title} Overview`,
        });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxCandidates);
}
//# sourceMappingURL=SynthesizeGenerator.js.map