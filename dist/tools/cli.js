import { CliBridge } from '../layers/L2-cli/CliBridge.js';
import { bridgeConfig, securityConfig } from '../shared/config.js';
export function createCliTools(resolveVault, sandbox) {
    return [
        {
            name: 'cli_backlinks',
            description: 'Get real backlinks via Obsidian CLI metadataCache',
            inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['path'],
            },
            handler: async (args) => {
                const { path } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable. Fallback: use L1 graph_neighbors.' }], isError: true };
                }
                const result = await vaultCli.backlinks(path);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
        {
            name: 'cli_orphans',
            description: 'List orphan notes via Obsidian CLI',
            inputSchema: {
                type: 'object',
                properties: { folder: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
            },
            handler: async (args) => {
                const { folder } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
                }
                const result = await vaultCli.orphans(folder);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
        {
            name: 'cli_deadends',
            description: 'List deadend notes via Obsidian CLI',
            inputSchema: {
                type: 'object',
                properties: { folder: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
            },
            handler: async (args) => {
                const { folder } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
                }
                const result = await vaultCli.deadends(folder);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
        {
            name: 'cli_unresolved',
            description: 'List unresolved links via Obsidian CLI',
            inputSchema: {
                type: 'object',
                properties: { folder: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
            },
            handler: async (args) => {
                const { folder } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
                }
                const result = await vaultCli.unresolved(folder);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
        {
            name: 'cli_search',
            description: 'Search vault via Obsidian CLI',
            inputSchema: {
                type: 'object',
                properties: { query: { type: 'string' }, context: { type: 'boolean' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['query'],
            },
            handler: async (args) => {
                const { query, context } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable. Fallback: use search_notes.' }], isError: true };
                }
                const result = await vaultCli.search(query, context);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
        {
            name: 'cli_eval',
            description: 'Evaluate JavaScript in a sandboxed vm.Context (node:vm). No access to Node.js APIs.',
            inputSchema: {
                type: 'object',
                properties: { code: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['code'],
            },
            handler: async (args) => {
                const { code } = args;
                try {
                    const result = await sandbox.execute(code);
                    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return { content: [{ type: 'text', text: `Sandbox error: ${message}` }], isError: true };
                }
            },
        },
        {
            name: 'cli_properties',
            description: 'Read, set, remove, or list properties of a note via CLI',
            inputSchema: {
                type: 'object',
                properties: {
                    file: { type: 'string' },
                    action: { type: 'string', enum: ['read', 'set', 'remove', 'list'] },
                    property: { type: 'string' },
                    value: { type: 'string' },
                    vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
                },
                required: ['file', 'action'],
            },
            handler: async (args) => {
                const { file, action, property, value } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
                }
                const result = await vaultCli.properties(file, action, property, value);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
        {
            name: 'cli_daily',
            description: 'Read or modify the daily note via CLI',
            inputSchema: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['read', 'append', 'prepend'] },
                    content: { type: 'string' },
                    vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
                },
                required: ['action'],
            },
            handler: async (args) => {
                const { action, content } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
                }
                const result = await vaultCli.daily(action, content);
                return { content: [{ type: 'text', text: result }] };
            },
        },
        {
            name: 'cli_command',
            description: 'Execute an Obsidian command by ID',
            inputSchema: {
                type: 'object',
                properties: { name: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
                required: ['name'],
            },
            handler: async (args) => {
                const { name } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
                }
                await vaultCli.command(name);
                return { content: [{ type: 'text', text: `Command ${name} executed` }] };
            },
        },
        {
            name: 'cli_plugin',
            description: 'Enable, disable, or list Obsidian plugins via CLI',
            inputSchema: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['enable', 'disable', 'list'] },
                    id: { type: 'string' },
                    vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
                },
                required: ['action'],
            },
            handler: async (args) => {
                const { action, id } = args;
                const ctx = resolveVault(args);
                const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
                if (!(await vaultCli.isAvailable())) {
                    return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
                }
                const result = await vaultCli.plugin(action, id);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
    ].filter((tool) => {
        if (tool.name === 'cli_eval' && !securityConfig.enableEval)
            return false;
        if ((tool.name === 'cli_command' || tool.name === 'cli_plugin') && !securityConfig.enableCommands)
            return false;
        return true;
    });
}
//# sourceMappingURL=cli.js.map