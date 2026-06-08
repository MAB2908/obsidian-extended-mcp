export class VectorEngine {
    vectors = new Map();
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async indexDoc(id, text) {
        const embeddings = await this.provider.embed([text]);
        if (!embeddings || embeddings.length === 0 || embeddings[0] === undefined) {
            throw new Error('Embedding provider returned empty result for single document');
        }
        this.vectors.set(id, embeddings[0]);
    }
    async indexDocs(docs) {
        if (docs.length === 0)
            return;
        const texts = docs.map((d) => d.text);
        const embeddings = await this.provider.embed(texts);
        if (!embeddings || embeddings.length < docs.length) {
            throw new Error(`Embedding provider returned ${embeddings?.length ?? 0} vectors for ${docs.length} documents`);
        }
        for (let i = 0; i < docs.length; i++) {
            if (embeddings[i] === undefined) {
                throw new Error(`Embedding provider returned undefined for document ${docs[i].id}`);
            }
            this.vectors.set(docs[i].id, embeddings[i]);
        }
    }
    removeDoc(id) {
        this.vectors.delete(id);
    }
    async search(query, limit = 10) {
        const queryVec = (await this.provider.embed([query]))[0];
        const scores = [];
        for (const [id, vec] of this.vectors) {
            const sim = cosineSimilarity(queryVec, vec);
            scores.push({ path: id, score: sim });
        }
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, limit).map((s) => ({
            path: s.path,
            score: s.score,
            snippet: '',
            highlights: [query],
        }));
    }
    getVectors() {
        return new Map(this.vectors);
    }
    getStats() {
        const first = this.vectors.values().next().value;
        return {
            totalVectors: this.vectors.size,
            dimensions: first?.length ?? 0,
        };
    }
    serialize() {
        const obj = {};
        for (const [k, v] of this.vectors) {
            obj[k] = v;
        }
        return obj;
    }
    load(data) {
        this.vectors.clear();
        for (const [k, v] of Object.entries(data)) {
            this.vectors.set(k, v);
        }
    }
    getVector(id) {
        return this.vectors.get(id);
    }
    get modelName() {
        return this.provider.name;
    }
}
function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
//# sourceMappingURL=VectorEngine.js.map