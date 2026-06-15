import { semanticConfig } from '../shared/config.js';
import { reciprocalRankFusion } from '../layers/L4-semantic/RRFusion.js';
export function createSemanticTools(resolveVault) {
    return [
        {
            name: 'bm25_search',
            description: 'Full-text search over indexed notes via SQLite FTS5',
            inputSchema: {
                type: 'object',
                properties: { query: { type: 'string' }, limit: { type: 'number' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['query'],
            },
            handler: async (args) => {
                const { query, limit } = args;
                const ctx = resolveVault(args);
                const results = ctx.semanticDb.searchFTS(query, limit ?? 20).map((r) => ({
                    path: r.path,
                    score: r.score,
                    snippet: r.snippet ?? '',
                    highlights: [],
                }));
                return { content: [{ type: 'text', text: JSON.stringify(results) }] };
            },
        },
        {
            name: 'graph_neighbors',
            description: 'Get graph neighbors of a note',
            inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' }, direction: { type: 'string', enum: ['both', 'in', 'out'] }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['path'],
            },
            handler: async (args) => {
                const { path, direction } = args;
                const ctx = resolveVault(args);
                const neighbors = ctx.graph.getNeighbors(path, direction);
                return { content: [{ type: 'text', text: JSON.stringify(neighbors) }] };
            },
        },
        {
            name: 'graph_analyze_centrality',
            description: 'Calculate PageRank centrality for notes',
            inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
            },
            handler: async (args) => {
                const { path } = args;
                const ctx = resolveVault(args);
                const ranks = ctx.graph.computePageRank();
                if (path) {
                    const score = ranks.get(path) ?? 0;
                    return { content: [{ type: 'text', text: JSON.stringify({ path, score }) }] };
                }
                const sorted = [...ranks.entries()].sort((a, b) => b[1] - a[1]);
                return { content: [{ type: 'text', text: JSON.stringify(sorted.slice(0, 20)) }] };
            },
        },
        {
            name: 'graph_detect_communities',
            description: 'Detect communities in the vault graph using Louvain method',
            inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
            handler: async (args) => {
                const ctx = resolveVault(args);
                const communities = ctx.graph.detectCommunities();
                const grouped = new Map();
                for (const [node, comm] of communities) {
                    if (!grouped.has(comm))
                        grouped.set(comm, []);
                    grouped.get(comm).push(node);
                }
                const result = [...grouped.entries()].map(([id, nodes]) => ({ id, nodes }));
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            },
        },
        {
            name: 'build_index',
            description: 'Trigger a full vault reindex',
            inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
            handler: async (args) => {
                const ctx = resolveVault(args);
                ctx.indexer?.markAllDirty();
                return { content: [{ type: 'text', text: 'Reindex scheduled' }] };
            },
        },
        {
            name: 'semantic_search',
            description: 'Semantic search via vector embeddings (RRF with BM25)',
            inputSchema: {
                type: 'object',
                properties: { query: { type: 'string' }, limit: { type: 'number' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['query'],
            },
            handler: async (args) => {
                const { query, limit } = args;
                const ctx = resolveVault(args);
                const keywordResults = ctx.semanticDb.searchFTS(query, limit ?? semanticConfig.semanticSearchLimit).map((r) => ({
                    path: r.path,
                    score: r.score,
                    snippet: r.snippet ?? '',
                    highlights: [],
                }));
                if (!ctx.vector) {
                    return { content: [{ type: 'text', text: JSON.stringify(keywordResults) }] };
                }
                const semanticResults = await ctx.vector.search(query, limit ?? semanticConfig.semanticSearchLimit);
                const fused = reciprocalRankFusion(keywordResults, semanticResults);
                return { content: [{ type: 'text', text: JSON.stringify(fused) }] };
            },
        },
        {
            name: 'semantic_search_db',
            description: 'Semantic search via SQLite FTS5 + persisted embeddings',
            inputSchema: {
                type: 'object',
                properties: { query: { type: 'string' }, limit: { type: 'number' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['query'],
            },
            handler: async (args) => {
                const { query, limit } = args;
                const ctx = resolveVault(args);
                const results = ctx.semanticDb.searchFTS(query, limit ?? 20);
                return { content: [{ type: 'text', text: JSON.stringify(results) }] };
            },
        },
        {
            name: 'db_stats',
            description: 'Get SQLite semantic database statistics',
            inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
            handler: async (args) => {
                const ctx = resolveVault(args);
                const stats = ctx.semanticDb.getStats();
                return { content: [{ type: 'text', text: JSON.stringify(stats) }] };
            },
        },
        {
            name: 'semantic_rag',
            description: 'Retrieve contextual chunks for RAG via semantic search',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    top_k: { type: 'number', default: 5 },
                    vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
                },
                required: ['query'],
            },
            handler: async (args) => {
                const { query, top_k } = args;
                const ctx = resolveVault(args);
                let docs;
                let warning;
                if (!ctx.vector) {
                    warning = 'Vector engine not enabled. Falling back to FTS5 keyword search. To enable semantic RAG, set SEMANTIC_ENABLED=true and provide OPENAI_API_KEY or OLLAMA_BASE_URL.';
                    docs = ctx.semanticDb.searchFTS(query, top_k ?? semanticConfig.semanticRagTopK).map((r) => ({
                        path: r.path,
                        score: r.score,
                        snippet: r.snippet ?? '',
                        highlights: [],
                    }));
                }
                else {
                    docs = await ctx.vector.search(query, top_k ?? 5);
                }
                const chunks = docs.map((d) => ({ path: d.path, score: d.score, snippet: d.snippet?.slice(0, 500) }));
                const payload = warning ? { warning, chunks } : chunks;
                return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
            },
        },
    ];
}
//# sourceMappingURL=semantic.js.map