// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import { PipelineError } from '../shared/errors.js';

export function createAiPipelineTools(resolveVault: (args: Record<string, unknown>) => VaultContext): ToolHandler[] {
  return [
    {
      name: 'ai_ingest',
      description: 'Ingest and enrich a raw note with AI',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path: notePath } = args as { path: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.pipeline) throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
        const result = await ctx.pipeline.runIngest(notePath);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'ai_tag',
      description: 'Auto-tag a note using AI and ontology',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, ontology: { type: 'array', items: { type: 'string' } } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path: notePath, ontology } = args as { path: string; ontology?: string[] };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.pipeline) throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
        const result = await ctx.pipeline.runTag(notePath, ontology || []);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'ai_query',
      description: 'Answer a question using vault knowledge + AI',
      inputSchema: {
        type: 'object',
        properties: { question: { type: 'string' } },
        required: ['question'],
      },
      handler: async (args) => {
        const { question } = args as { question: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.pipeline) throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
        const result = await ctx.pipeline.runQuery(question);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'ai_compile',
      description: 'Compile recent changes into concepts and update MOCs',
      inputSchema: {
        type: 'object',
        properties: { sinceDays: { type: 'number' } },
      },
      handler: async (args) => {
        const { sinceDays } = args as { sinceDays?: number };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.pipeline) throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
        const result = await ctx.pipeline.runCompile(sinceDays);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'ai_link',
      description: 'Suggest and create links for a note',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path: notePath } = args as { path: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.pipeline) throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
        const result = await ctx.pipeline.runLink(notePath);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'ai_link_batch',
      description: 'Batch link orphaned notes using AI (limit prevents timeout)',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max notes to process (default 50)' },
          folder: { type: 'string', description: 'Optional folder to target (e.g. "Knowledge Base/compiled")' },
        },
      },
      handler: async (args) => {
        const { limit, folder } = args as { limit?: number; folder?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.pipeline) throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
        const result = await ctx.pipeline.runLinkBatch(limit, folder);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    // DEPRECATED: ai_lint removed — use dream_scan with kinds: ['prune'] instead
    {
      name: 'ai_enrich',
      description: 'Enrich a note with AI-generated metadata',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path: notePath } = args as { path: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        if (!ctx.pipeline) throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
        const result = await ctx.pipeline.runEnrich(notePath);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
  ];
}
