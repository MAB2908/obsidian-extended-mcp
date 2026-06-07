// v0.2b:
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { SearchResult } from '../../shared/types.js';
import { tokenize } from '../../shared/utils.js';
import { semanticConfig } from '../../shared/config.js';

interface Doc {
  id: string;
  tokens: string[];
  termFreq: Map<string, number>;
  docLen: number;
}

export class BM25Engine implements IBM25Engine {
  private docs = new Map<string, Doc>();
  private inverted = new Map<string, Set<string>>();
  private avgDocLen = 0;
  private totalDocLen = 0;
  private k1 = semanticConfig.bm25K1;
  private b = semanticConfig.bm25B;

  addDoc(id: string, text: string): void {
    this.removeDoc(id);
    const tokens = tokenize(text);
    const termFreq = new Map<string, number>();
    for (const t of tokens) {
      termFreq.set(t, (termFreq.get(t) || 0) + 1);
    }
    const doc: Doc = { id, tokens, termFreq, docLen: tokens.length };
    this.docs.set(id, doc);
    this.totalDocLen += doc.docLen;
    this.avgDocLen = this.totalDocLen / this.docs.size;

    for (const t of new Set(tokens)) {
      if (!this.inverted.has(t)) this.inverted.set(t, new Set());
      this.inverted.get(t)!.add(id);
    }
  }

  removeDoc(id: string): void {
    const existing = this.docs.get(id);
    if (!existing) return;
    this.totalDocLen -= existing.docLen;
    for (const t of new Set(existing.tokens)) {
      this.inverted.get(t)?.delete(id);
    }
    this.docs.delete(id);
    this.avgDocLen = this.docs.size > 0 ? this.totalDocLen / this.docs.size : 0;
  }

  search(query: string, limit = semanticConfig.bm25DefaultLimit): SearchResult[] {
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];
    const scores = new Map<string, number>();

    for (const token of qTokens) {
      const postings = this.inverted.get(token);
      if (!postings) continue;
      const idf = this.computeIdf(token);
      for (const docId of postings) {
        const doc = this.docs.get(docId)!;
        const tf = doc.termFreq.get(token) || 0;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.docLen / (this.avgDocLen || 1)));
        const score = idf * (numerator / denominator);
        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }

    const results: SearchResult[] = [];
    for (const [docId, score] of scores) {
      results.push({ path: docId, score, snippet: '', highlights: qTokens });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private computeIdf(token: string): number {
    const n = this.inverted.get(token)?.size || 0;
    if (n === 0) return 0;
    return Math.log((this.docs.size - n + 0.5) / (n + 0.5) + 1);
  }

  getStats(): { totalDocs: number; avgDocLen: number; uniqueTerms: number } {
    return {
      totalDocs: this.docs.size,
      avgDocLen: this.avgDocLen,
      uniqueTerms: this.inverted.size,
    };
  }

  serialize(): unknown {
    const docs: Record<string, { id: string; tokens: string[]; termFreq: [string, number][]; docLen: number }> = {};
    for (const [k, v] of this.docs) {
      docs[k] = { id: v.id, tokens: v.tokens, termFreq: [...v.termFreq], docLen: v.docLen };
    }
    const inverted: Record<string, string[]> = {};
    for (const [k, v] of this.inverted) {
      inverted[k] = [...v];
    }
    return { docs, inverted, avgDocLen: this.avgDocLen, totalDocLen: this.totalDocLen, k1: this.k1, b: this.b };
  }

  load(data: {
    docs: Record<string, { id: string; tokens: string[]; termFreq: [string, number][]; docLen: number }>;
    inverted: Record<string, string[]>;
    avgDocLen: number;
    totalDocLen: number;
    k1: number;
    b: number;
  }): void {
    this.docs.clear();
    this.inverted.clear();
    for (const [k, v] of Object.entries(data.docs)) {
      this.docs.set(k, { id: v.id, tokens: v.tokens, termFreq: new Map(v.termFreq), docLen: v.docLen });
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
