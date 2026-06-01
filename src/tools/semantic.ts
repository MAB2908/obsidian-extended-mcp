// v0.1b:
import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import { semanticConfig } from '../shared/config.js';
import { reciprocalRankFusion } from '../layers/L4-semantic/RRFusion.js';

export function createSemanticTools(resolveVault: (args: Record<string, unknown>) => VaultContext): ToolHandler[] {
  return [
    {
      name: 'bm25_search',
      description: 'BM25 full-text search over indexed notes',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['query'],
      },
      handler: async (args) => {
        const { query, limit } = args as { query: string; limit?: number };
        const ctx = resolveVault(args as Record<string, unknown>);
        const results = ctx.bm25.search(query, limit);
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
        const { path, direction } = args as { path: string; direction?: 'both' | 'in' | 'out' };
        const ctx = resolveVault(args as Record<string, unknown>);
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
        const { path } = args as { path?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
        const ctx = resolveVault(args as Record<string, unknown>);
        const communities = ctx.graph.detectCommunities();
        const grouped = new Map<number, string[]>();
        for (const [node, comm] of communities) {
          if (!grouped.has(comm)) grouped.set(comm, []);
          grouped.get(comm)!.push(node);
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
        const ctx = resolveVault(args as Record<string, unknown>);
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
        const { query, limit } = args as { query: string; limit?: number };
        const ctx = resolveVault(args as Record<string, unknown>);
        const keywordResults = ctx.bm25.search(query, limit ?? semanticConfig.semanticSearchLimit);
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
        const { query, limit } = args as { query: string; limit?: number };
        const ctx = resolveVault(args as Record<string, unknown>);
        const results = ctx.semanticDb.searchFTS(query, limit ?? 20);
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      },
    },
    {
      name: 'db_stats',
      description: 'Get SQLite semantic database statistics',
      inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
      handler: async (args) => {
        const ctx = resolveVault(args as Record<string, unknown>);
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
        const { query, top_k } = args as { query: string; top_k?: number };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.vector) {
          return { content: [{ type: 'text', text: 'Vector engine not enabled.' }], isError: true };
        }
        const docs = await ctx.vector.search(query, top_k ?? 5);
        const chunks = docs.map((d) => ({ path: d.path, score: d.score, snippet: d.snippet?.slice(0, 500) }));
        return { content: [{ type: 'text', text: JSON.stringify(chunks, null, 2) }] };
      },
    },

  ];
}
