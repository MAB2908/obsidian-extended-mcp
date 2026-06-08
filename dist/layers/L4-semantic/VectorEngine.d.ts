import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import type { SearchResult } from '../../shared/types.js';
import type { EmbeddingProvider } from './EmbeddingProvider.js';
export declare class VectorEngine implements IVectorEngine {
    private vectors;
    private provider;
    constructor(provider: EmbeddingProvider);
    indexDoc(id: string, text: string): Promise<void>;
    indexDocs(docs: Array<{
        id: string;
        text: string;
    }>): Promise<void>;
    removeDoc(id: string): void;
    search(query: string, limit?: number): Promise<SearchResult[]>;
    getVectors(): Map<string, number[]>;
    getStats(): {
        totalVectors: number;
        dimensions: number;
    };
    serialize(): Record<string, number[]>;
    load(data: Record<string, number[]>): void;
    getVector(id: string): number[] | undefined;
    get modelName(): string;
}
//# sourceMappingURL=VectorEngine.d.ts.map