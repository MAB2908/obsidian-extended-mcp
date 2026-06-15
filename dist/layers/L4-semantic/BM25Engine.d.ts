import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { SearchResult } from '../../shared/types.js';
export declare class BM25Engine implements IBM25Engine {
    private docs;
    private inverted;
    private avgDocLen;
    private totalDocLen;
    private k1;
    private b;
    addDoc(id: string, text: string): void;
    removeDoc(id: string): void;
    search(query: string, limit?: number): SearchResult[];
    private computeIdf;
    getStats(): {
        totalDocs: number;
        avgDocLen: number;
        uniqueTerms: number;
    };
    serialize(): unknown;
    load(data: {
        docs: Record<string, {
            id: string;
            termFreq: [string, number][];
            docLen: number;
        }>;
        inverted: Record<string, string[]>;
        avgDocLen: number;
        totalDocLen: number;
        k1: number;
        b: number;
    }): void;
}
//# sourceMappingURL=BM25Engine.d.ts.map