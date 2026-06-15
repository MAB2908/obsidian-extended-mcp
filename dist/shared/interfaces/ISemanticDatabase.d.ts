import type { DbNode, DbEdge, DbChunk, DbEmbedding, FTSSearchResult } from '../../layers/L4-semantic/SemanticDatabase.js';
export interface ISemanticDatabase {
    initSchema(): Promise<void>;
    upsertNode(node: DbNode): void;
    deleteEdgesFrom(fromPath: string): void;
    upsertEdge(edge: DbEdge): void;
    updateFTSContent(path: string, content: string): void;
    deleteChunks(nodePath: string): void;
    upsertChunk(chunk: DbChunk): number;
    upsertEmbedding(emb: DbEmbedding): void;
    close(): void;
    searchFTS(query: string, limit?: number): FTSSearchResult[];
    getStats(): {
        nodes: number;
        edges: number;
        chunks: number;
        embeddings: number;
    };
    clearAll(): void;
    bulkIndex(nodes: DbNode[], edges: DbEdge[], chunks: Array<DbChunk & {
        id?: number;
    }>): number[];
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
//# sourceMappingURL=ISemanticDatabase.d.ts.map