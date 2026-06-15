import { tokenize } from '../../shared/utils.js';
import { semanticConfig } from '../../shared/config.js';
export class BM25Engine {
    docs = new Map();
    inverted = new Map();
    avgDocLen = 0;
    totalDocLen = 0;
    k1 = semanticConfig.bm25K1;
    b = semanticConfig.bm25B;
    addDoc(id, text) {
        this.removeDoc(id);
        const tokens = tokenize(text);
        const termFreq = new Map();
        for (const t of tokens) {
            termFreq.set(t, (termFreq.get(t) || 0) + 1);
        }
        const doc = { id, tokens, termFreq, docLen: tokens.length };
        this.docs.set(id, doc);
        this.totalDocLen += doc.docLen;
        this.avgDocLen = this.totalDocLen / this.docs.size;
        for (const t of new Set(tokens)) {
            if (!this.inverted.has(t))
                this.inverted.set(t, new Set());
            this.inverted.get(t).add(id);
        }
    }
    removeDoc(id) {
        const existing = this.docs.get(id);
        if (!existing)
            return;
        this.totalDocLen -= existing.docLen;
        for (const t of new Set(existing.tokens)) {
            this.inverted.get(t)?.delete(id);
        }
        this.docs.delete(id);
        this.avgDocLen = this.docs.size > 0 ? this.totalDocLen / this.docs.size : 0;
    }
    search(query, limit = semanticConfig.bm25DefaultLimit) {
        const qTokens = tokenize(query);
        if (qTokens.length === 0)
            return [];
        const scores = new Map();
        for (const token of qTokens) {
            const postings = this.inverted.get(token);
            if (!postings)
                continue;
            const idf = this.computeIdf(token);
            for (const docId of postings) {
                const doc = this.docs.get(docId);
                const tf = doc.termFreq.get(token) || 0;
                const numerator = tf * (this.k1 + 1);
                const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.docLen / (this.avgDocLen || 1)));
                const score = idf * (numerator / denominator);
                scores.set(docId, (scores.get(docId) || 0) + score);
            }
        }
        const results = [];
        for (const [docId, score] of scores) {
            results.push({ path: docId, score, snippet: '', highlights: qTokens });
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }
    computeIdf(token) {
        const n = this.inverted.get(token)?.size || 0;
        if (n === 0)
            return 0;
        return Math.log((this.docs.size - n + 0.5) / (n + 0.5) + 1);
    }
    getStats() {
        return {
            totalDocs: this.docs.size,
            avgDocLen: this.avgDocLen,
            uniqueTerms: this.inverted.size,
        };
    }
    serialize() {
        const docs = {};
        for (const [k, v] of this.docs) {
            // Store only term frequencies, not the full token array, to keep cache small
            docs[k] = { id: v.id, termFreq: [...v.termFreq], docLen: v.docLen };
        }
        const inverted = {};
        for (const [k, v] of this.inverted) {
            inverted[k] = [...v];
        }
        return { docs, inverted, avgDocLen: this.avgDocLen, totalDocLen: this.totalDocLen, k1: this.k1, b: this.b };
    }
    load(data) {
        this.docs.clear();
        this.inverted.clear();
        for (const [k, v] of Object.entries(data.docs)) {
            const termFreq = new Map(v.termFreq);
            // Reconstruct token list from term frequencies so removeDoc can maintain the inverted index
            const tokens = [];
            for (const [term, count] of termFreq) {
                for (let i = 0; i < count; i++) {
                    tokens.push(term);
                }
            }
            this.docs.set(k, { id: v.id, tokens, termFreq, docLen: v.docLen });
        }
        for (const [k, v] of Object.entries(data.inverted)) {
            this.inverted.set(k, new Set(v));
        }
        this.avgDocLen = data.avgDocLen;
        this.totalDocLen = data.totalDocLen;
        this.k1 = data.k1 !== undefined ? data.k1 : 1.5;
        this.b = data.b !== undefined ? data.b : 0.75;
    }
}
//# sourceMappingURL=BM25Engine.js.map