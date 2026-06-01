// v0.1b:
import type { SearchResult } from '../types.js';

export interface IBM25Engine {
  addDoc(id: string, text: string): void;
  removeDoc(id: string): void;
  search(query: string, limit?: number): SearchResult[];
  serialize(): unknown;
  load(data: unknown): void;
}
