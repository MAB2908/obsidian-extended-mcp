// v0.1b:
import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import { CliBridge } from '../layers/L2-cli/CliBridge.js';
import { bridgeConfig, securityConfig } from '../shared/config.js';
import type { Sandbox } from '../security/Sandbox.js';

export function createCliTools(resolveVault: (args: Record<string, unknown>) => VaultContext, sandbox: Sandbox): ToolHandler[] {
  return [
    {
      name: 'cli_backlinks',
      description: 'Get real backlinks via Obsidian CLI metadataCache',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path'],
      },
      handler: async (args: unknown) => {
        const { path } = args as { path: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { folder } = args as { folder?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { folder } = args as { folder?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { folder } = args as { folder?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { query, context } = args as { query: string; context?: boolean };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { code } = args as { code: string };
        try {
          const result = await sandbox.execute<unknown>(code);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (err) {
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
      handler: async (args: unknown) => {
        const { file, action, property, value } = args as { file: string; action: 'read' | 'set' | 'remove' | 'list'; property?: string; value?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { action, content } = args as { action: 'read' | 'append' | 'prepend'; content?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { name } = args as { name: string };
        const ctx = resolveVault(args as Record<string, unknown>);
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
      handler: async (args: unknown) => {
        const { action, id } = args as { action: 'enable' | 'disable' | 'list'; id?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
        if (!(await vaultCli.isAvailable())) {
          return { content: [{ type: 'text', text: 'CLI unavailable.' }], isError: true };
        }
        const result = await vaultCli.plugin(action, id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
  ].filter((tool) => {
    if (tool.name === 'cli_eval' && !securityConfig.enableEval) return false;
    if ((tool.name === 'cli_command' || tool.name === 'cli_plugin') && !securityConfig.enableCommands) return false;
    return true;
  });
}
