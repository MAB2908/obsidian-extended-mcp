import { BatchEditGuard } from '../security/BatchEditGuard.js';
import { securityConfig } from '../shared/config.js';
export function createSecurityTools(resolveVault, audit, security) {
    return [
        {
            name: 'audit_log',
            description: 'Get recent audit log entries',
            inputSchema: {
                type: 'object',
                properties: {
                    event: { type: 'string' },
                    tool: { type: 'string' },
                    limit: { type: 'number' },
                },
            },
            handler: async (args) => {
                const { event, tool, limit } = args;
                const entries = await audit.query({ event, tool, limit });
                return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
            },
        },
        {
            name: 'list_backups',
            description: 'List available backups of vault notes',
            inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
            handler: async (args) => {
                const ctx = resolveVault(args);
                const backups = await ctx.vault.listBackups();
                return { content: [{ type: 'text', text: JSON.stringify(backups, null, 2) }] };
            },
        },
        {
            name: 'rollback',
            description: 'Rollback a note to a previous backup',
            inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' }, timestamp: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['path'],
            },
            handler: async (args) => {
                const { path, timestamp } = args;
                const ctx = resolveVault(args);
                await ctx.vault.rollback(path, timestamp);
                return { content: [{ type: 'text', text: `Rolled back ${path}` }] };
            },
        },
        {
            name: 'batch_edit',
            description: 'Apply a transformation to multiple notes matching criteria. Set preview=true to see changes without applying.',
            inputSchema: {
                type: 'object',
                properties: {
                    filter: { type: 'object', properties: { folder: { type: 'string' }, glob: { type: 'string' }, tag: { type: 'string' } } },
                    operation: { type: 'string', enum: ['replace', 'prepend', 'append', 'rename_tag'] },
                    target: { type: 'string' },
                    replacement: { type: 'string' },
                    preview: { type: 'boolean' },
                },
                required: ['filter', 'operation', 'target'],
            },
            handler: async (args) => {
                if (!securityConfig.enableBatchEdit) {
                    return { content: [{ type: 'text', text: 'batch_edit is disabled. Set ENABLE_BATCH_EDIT=true to enable.' }], isError: true };
                }
                const { filter, operation, target, replacement, preview } = args;
                if (!filter || typeof filter !== 'object') {
                    return { content: [{ type: 'text', text: 'batch_edit requires a filter object with folder, glob, or tag properties.' }], isError: true };
                }
                const ctx = resolveVault(args);
                const auth = security.authorize('batch_edit', args);
                if (!auth.allowed) {
                    audit.log({ event: 'security', tool: 'batch_edit', reason: auth.reason, blocked: true, vaultPath: ctx.vaultPath });
                    return { content: [{ type: 'text', text: `Security blocked: ${auth.reason}` }], isError: true };
                }
                const vaultBatchEditGuard = new BatchEditGuard(ctx.vaultPath, ctx.vault);
                if (preview) {
                    const result = await vaultBatchEditGuard.preview(filter, operation, target, replacement);
                    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
                }
                const result = await vaultBatchEditGuard.apply(filter, operation, target, replacement);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
    ];
}
//# sourceMappingURL=security.js.map