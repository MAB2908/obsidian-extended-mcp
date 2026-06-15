import { DreamingEngine } from '../layers/L9-dreaming/DreamingEngine.js';
export function createDreamingTools(resolveVault) {
    /** Lazily initialize DreamingEngine on a vault entry */
    async function getEngine(ctx) {
        if (ctx.dreaming)
            return ctx.dreaming;
        const engine = await DreamingEngine.create({
            vaultPath: ctx.vaultPath,
            vault: ctx.vault,
            semanticDb: ctx.semanticDb,
        });
        ctx.dreaming = engine;
        return engine;
    }
    return [
        {
            name: 'dream_scan',
            description: 'L9-Dreaming: Scan the vault for maintenance candidates (link gaps, merge opportunities, stale notes, missing MOCs). Returns a session ID and ranked candidates.',
            inputSchema: {
                type: 'object',
                properties: {
                    vaultPath: { type: 'string' },
                    kinds: {
                        type: 'array',
                        items: { type: 'string', enum: ['link', 'merge', 'prune', 'synthesize'] },
                        description: 'Which analytics to run (default: all)',
                    },
                    maxCandidates: {
                        type: 'number',
                        description: 'Max candidates per kind (default: 20)',
                    },
                    scope: {
                        type: 'string',
                        description: 'Optional domain prefix filter',
                    },
                },
                required: [],
            },
            handler: async (args) => {
                const a = args;
                const ctx = resolveVault(a);
                const engine = await getEngine(ctx);
                const kinds = a.kinds?.filter((k) => ['link', 'merge', 'prune', 'synthesize'].includes(k));
                const result = await engine.scan({
                    vaultPath: ctx.vaultPath,
                    kinds,
                    maxCandidates: a.maxCandidates ?? 20,
                    scope: a.scope,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            },
        },
        {
            name: 'dream_finalize',
            description: 'L9-Dreaming: Finalize a dreaming session by archiving selected paths. Requires the sessionId from dream_scan.',
            inputSchema: {
                type: 'object',
                properties: {
                    vaultPath: { type: 'string' },
                    sessionId: { type: 'string' },
                    archivePaths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Relative paths to archive',
                    },
                },
                required: ['sessionId', 'archivePaths'],
            },
            handler: async (args) => {
                const a = args;
                const ctx = resolveVault(a);
                const engine = await getEngine(ctx);
                const result = await engine.finalize({
                    sessionId: a.sessionId,
                    vaultPath: ctx.vaultPath,
                    archivePaths: a.archivePaths,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Archived ${result.archived.length} path(s): ${result.archived.join(', ') || 'none'}`,
                        },
                    ],
                };
            },
        },
        {
            name: 'dream_undo',
            description: 'L9-Dreaming: Undo a finalized session by restoring archived paths from the undo log.',
            inputSchema: {
                type: 'object',
                properties: {
                    vaultPath: { type: 'string' },
                    sessionId: { type: 'string' },
                },
                required: ['sessionId'],
            },
            handler: async (args) => {
                const a = args;
                const ctx = resolveVault(a);
                const engine = await getEngine(ctx);
                const result = await engine.undo(a.sessionId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Restored ${result.restored.length} path(s): ${result.restored.join(', ') || 'none'}`,
                        },
                    ],
                };
            },
        },
    ];
}
//# sourceMappingURL=dreaming.js.map