// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import { CliBridge } from '../layers/L2-cli/CliBridge.js';
import { bridgeConfig, securityConfig } from '../shared/config.js';
import type { Sandbox } from '../security/Sandbox.js';

export function createCliTools(resolveVault: (args: Record<string, unknown>) => VaultContext, sandbox: Sandbox): ToolHandler[] {
  return [
    {
      name: 'cli_backlinks',
      description: 'Get real backlinks via Obsidian CLI metadataCache (falls back to graph on Windows)',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path'],
      },
      handler: async (args: unknown) => {
        const { path } = args as { path: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.backlinks(path);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch {
            // Fallback to graph
          }
        }
        const inbound = ctx.graph.getNeighbors(path, 'in');
        const result = inbound.map((source) => ({ source, line: 0, context: '' }));
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'cli_orphans',
      description: 'List orphan notes via Obsidian CLI (falls back to graph on Windows)',
      inputSchema: {
        type: 'object',
        properties: { folder: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
      },
      handler: async (args: unknown) => {
        const { folder } = args as { folder?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.orphans(folder);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch {
            // Fallback to graph
          }
        }
        const graphData = ctx.graph.getGraph();
        let result = graphData.orphans;
        if (folder) {
          result = result.filter((p) => p.startsWith(folder));
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'cli_deadends',
      description: 'List deadend notes via Obsidian CLI (falls back to graph on Windows)',
      inputSchema: {
        type: 'object',
        properties: { folder: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
      },
      handler: async (args: unknown) => {
        const { folder } = args as { folder?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.deadends(folder);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch {
            // Fallback to graph
          }
        }
        const graphData = ctx.graph.getGraph();
        let result = graphData.deadends;
        if (folder) {
          result = result.filter((p) => p.startsWith(folder));
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'cli_unresolved',
      description: 'List unresolved links via Obsidian CLI (falls back to filesystem scan on Windows)',
      inputSchema: {
        type: 'object',
        properties: { folder: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
      },
      handler: async (args: unknown) => {
        const { folder } = args as { folder?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.unresolved(folder);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch {
            // Fallback to filesystem scan
          }
        }
        const graphData = ctx.graph.getGraph();
        let result = graphData.unresolved;
        if (folder) {
          result = result.filter((u) => u.source.startsWith(folder));
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'cli_search',
      description: 'Search vault via Obsidian CLI (falls back to vault search on Windows)',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, context: { type: 'boolean' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['query'],
      },
      handler: async (args: unknown) => {
        const { query, context } = args as { query: string; context?: boolean };
        const ctx = resolveVault(args as Record<string, unknown>);
        const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.search(query, context);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch {
            // Fallback to vault search
          }
        }
        // Prefer BM25 index if populated (fast O(1) per token)
        const bm25Stats = ctx.bm25.getStats();
        if (bm25Stats.totalDocs > 0) {
          const result = ctx.bm25.search(query, 50);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        const result = await ctx.vault.searchNotes(query, { limit: 50 });
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
      description: 'Read, set, remove, or list properties of a note via CLI (falls back to filesystem on Windows)',
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
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.properties(file, action, property, value);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch {
            // Fallback to filesystem
          }
        }
        const note = await ctx.vault.readNote(file, { includeContent: true });
        const frontmatter = note.frontmatter || {};
        switch (action) {
          case 'read':
            return { content: [{ type: 'text', text: JSON.stringify(frontmatter) }] };
          case 'list':
            return { content: [{ type: 'text', text: JSON.stringify(Object.keys(frontmatter)) }] };
          case 'set': {
            if (!property) return { content: [{ type: 'text', text: 'Property name required for set' }], isError: true };
            const updated = { ...frontmatter, [property]: value };
            await ctx.vault.writeNote(file, note.content, { frontmatter: updated, overwrite: true });
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }
          case 'remove': {
            if (!property) return { content: [{ type: 'text', text: 'Property name required for remove' }], isError: true };
            const updated = { ...frontmatter };
            delete updated[property];
            await ctx.vault.writeNote(file, note.content, { frontmatter: updated, overwrite: true });
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }
          default:
            return { content: [{ type: 'text', text: `Unknown action: ${action}` }], isError: true };
        }
      },
    },
    {
      name: 'cli_daily',
      description: 'Read or modify the daily note via CLI (falls back to filesystem on Windows)',
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
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.daily(action, content);
            return { content: [{ type: 'text', text: result }] };
          } catch {
            // Fallback to filesystem
          }
        }
        const today = new Date().toISOString().slice(0, 10);
        const candidates = [
          `${today}.md`,
          `Daily/${today}.md`,
          `daily/${today}.md`,
          `Journal/${today}.md`,
          `journal/${today}.md`,
          `Journals/${today}.md`,
          `journals/${today}.md`,
          `Dailies/${today}.md`,
          `dailies/${today}.md`,
        ];
        let file: string | null = null;
        for (const c of candidates) {
          try {
            await ctx.vault.readNote(c, { includeContent: false });
            file = c;
            break;
          } catch {
            // try next
          }
        }
        if (!file) {
          return { content: [{ type: 'text', text: 'Daily note not found' }], isError: true };
        }
        if (action === 'read') {
          const note = await ctx.vault.readNote(file, { includeContent: true });
          return { content: [{ type: 'text', text: JSON.stringify({ content: note.content }) }] };
        }
        const note = await ctx.vault.readNote(file, { includeContent: true });
        const updated = action === 'prepend'
          ? (content || '') + '\n' + note.content
          : note.content + '\n' + (content || '');
        await ctx.vault.writeNote(file, updated, { overwrite: true });
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
      },
    },
    {
      name: 'cli_command',
      description: 'Execute an Obsidian command by ID (no fallback available)',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['name'],
      },
      handler: async (args: unknown) => {
        const { name } = args as { name: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const vaultCli = new CliBridge(ctx.vaultPath, bridgeConfig.obsidianCliPath);
        if (await vaultCli.isAvailable()) {
          try {
            await vaultCli.command(name);
            return { content: [{ type: 'text', text: `Command ${name} executed` }] };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text', text: `CLI error: ${message}` }], isError: true };
          }
        }
        return { content: [{ type: 'text', text: 'CLI unavailable. Command execution requires Obsidian CLI.' }], isError: true };
      },
    },
    {
      name: 'cli_plugin',
      description: 'Enable, disable, or list Obsidian plugins via CLI (no fallback available)',
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
        if (await vaultCli.isAvailable()) {
          try {
            const result = await vaultCli.plugin(action, id);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text', text: `CLI error: ${message}` }], isError: true };
          }
        }
        return { content: [{ type: 'text', text: 'CLI unavailable. Plugin management requires Obsidian CLI.' }], isError: true };
      },
    },
  ].filter((tool) => {
    if (tool.name === 'cli_eval' && !securityConfig.enableEval) return false;
    if ((tool.name === 'cli_command' || tool.name === 'cli_plugin') && !securityConfig.enableCommands) return false;
    return true;
  });
}
