import type { ISemanticDatabase } from '../../shared/interfaces/ISemanticDatabase.js';
export interface DbNode {
    path: string;
    title: string;
    contentHash: string;
    wordCount: number;
}
export interface DbEdge {
    fromPath: string;
    toPath: string;
    type: 'wikilink' | 'backlink' | 'implicit' | 'alias';
    context?: string;
}
export interface DbChunk {
    nodePath: string;
    chunkIndex: number;
    heading?: string;
    content: string;
    tokenCount?: number;
}
export interface DbEmbedding {
    chunkId: number;
    model: string;
    vector: Float32Array;
    dimensions: number;
}
export interface FTSSearchResult {
    path: string;
    score: number;
    snippet?: string;
}
export declare class SemanticDatabase implements ISemanticDatabase {
    private db;
    private dbPath;
    constructor(vaultPath: string);
    initSchema(): Promise<void>;
    private createFTSTable;
    upsertNode(node: DbNode): void;
    deleteNode(path: string): void;
    getNode(path: string): DbNode | undefined;
    upsertEdge(edge: DbEdge): void;
    deleteEdgesFrom(fromPath: string): void;
    getEdges(fromPath: string): DbEdge[];
    upsertChunk(chunk: DbChunk): number;
    private getChunkId;
    deleteChunks(nodePath: string): void;
    getChunks(nodePath: string): Array<DbChunk & {
        id: number;
    }>;
    upsertEmbedding(emb: DbEmbedding): void;
    deleteEmbeddingsForNode(nodePath: string): void;
    searchFTS(query: string, limit?: number): FTSSearchResult[];
    searchSimilar(queryVector: Float32Array, model: string, topK?: number): FTSSearchResult[];
    updateFTSContent(path: string, content: string): void;
    getStats(): {
        nodes: number;
        edges: number;
        chunks: number;
        embeddings: number;
    };
    close(): void;
    bulkIndex(nodes: DbNode[], edges: DbEdge[], chunks: Array<DbChunk & {
        id?: number;
    }>): number[];
    clearAll(): void;
    bulkUpdateFTS(ftsContents: Array<{
        path: string;
        title?: string;
        content: string;
    }>): void;
    getAllEmbeddings(model: string): Array<{
        chunkId: number;
        nodePath: string;
        chunkIndex: number;
        vector: Float32Array;
        dimensions: number;
    }>;
}
//# sourceMappingURL=SemanticDatabase.d.ts.map