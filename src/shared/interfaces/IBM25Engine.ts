// v0.2b:
import type { SearchResult } from '../types.js';

export interface IBM25Engine {
  addDoc(id: string, text: string): void;
  removeDoc(id: string): void;
  search(query: string, limit?: number): SearchResult[];
  getStats(): { totalDocs: number; avgDocLen: number; uniqueTerms: number };
  serialize(): unknown;
  load(data: unknown): void;
}
