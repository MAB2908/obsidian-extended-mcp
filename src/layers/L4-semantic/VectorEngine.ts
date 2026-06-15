// v0.2b:
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import type { SearchResult } from '../../shared/types.js';
import type { EmbeddingProvider } from './EmbeddingProvider.js';

export class VectorEngine implements IVectorEngine {
  private vectors = new Map<string, Float32Array | number[]>();
  private provider: EmbeddingProvider;

  constructor(provider: EmbeddingProvider) {
    this.provider = provider;
  }

  async indexDoc(id: string, text: string): Promise<void> {
    const embeddings = await this.provider.embed([text]);
    if (!embeddings || embeddings.length === 0 || embeddings[0] === undefined) {
      throw new Error('Embedding provider returned empty result for single document');
    }
    this.vectors.set(id, embeddings[0]);
  }

  async indexDocs(docs: Array<{ id: string; text: string }>): Promise<void> {
    if (docs.length === 0) return;
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

  removeDoc(id: string): void {
    this.vectors.delete(id);
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const queryVec = (await this.provider.embed([query]))[0];
    const scores: Array<{ path: string; score: number }> = [];

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

  getVectors(): Map<string, Float32Array | number[]> {
    return new Map(this.vectors);
  }

  getStats(): { totalVectors: number; dimensions: number } {
    const first = this.vectors.values().next().value as Float32Array | number[] | undefined;
    return {
      totalVectors: this.vectors.size,
      dimensions: first?.length ?? 0,
    };
  }

  serialize(): Record<string, number[]> {
    const obj: Record<string, number[]> = {};
    for (const [k, v] of this.vectors) {
      obj[k] = Array.from(v);
    }
    return obj;
  }

  load(data: Record<string, number[]>): void {
    this.vectors.clear();
    for (const [k, v] of Object.entries(data)) {
      this.vectors.set(k, v);
    }
  }

  getVector(id: string): Float32Array | number[] | undefined {
    return this.vectors.get(id);
  }

  setVector(id: string, vector: Float32Array | number[]): void {
    this.vectors.set(id, vector);
  }

  get modelName(): string {
    return this.provider.name;
  }
}

function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
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
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
