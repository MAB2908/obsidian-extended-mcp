import { PipelineError } from '../shared/errors.js';
export function createAiPipelineTools(resolveVault) {
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
                const { path: notePath } = args;
                const ctx = resolveVault(args);
                if (!ctx.pipeline)
                    throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
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
                const { path: notePath, ontology } = args;
                const ctx = resolveVault(args);
                if (!ctx.pipeline)
                    throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
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
                const { question } = args;
                const ctx = resolveVault(args);
                if (!ctx.pipeline)
                    throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
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
                const { sinceDays } = args;
                const ctx = resolveVault(args);
                if (!ctx.pipeline)
                    throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
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
                const { path: notePath } = args;
                const ctx = resolveVault(args);
                if (!ctx.pipeline)
                    throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
                const result = await ctx.pipeline.runLink(notePath);
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
                const { path: notePath } = args;
                const ctx = resolveVault(args);
                if (!ctx.pipeline)
                    throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
                const result = await ctx.pipeline.runEnrich(notePath);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
    ];
}
//# sourceMappingURL=ai-pipeline.js.map