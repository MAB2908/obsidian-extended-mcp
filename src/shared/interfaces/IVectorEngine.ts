// v0.1b:
import type { SearchResult } from '../types.js';

export interface IVectorEngine {
  indexDoc(id: string, text: string): Promise<void>;
  indexDocs(docs: Array<{ id: string; text: string }>): Promise<void>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  removeDoc(id: string): void;
  serialize(): unknown;
  load(data: unknown): void;
  getStats(): { totalVectors: number; dimensions: number };
  getVector(id: string): number[] | undefined;
  readonly modelName: string;
}
