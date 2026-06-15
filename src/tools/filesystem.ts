// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import type { FileTypeRouter } from '../shared/FileTypeRouter.js';
import { promises as fs } from 'fs';
import path from 'path';

export function createFilesystemTools(
  resolveVault: (args: Record<string, unknown>) => VaultContext,
  fileRouter: FileTypeRouter
): ToolHandler[] {
  return [
    {
      name: 'read_note',
      description: 'Read a markdown note from the vault',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to note' },
          includeFrontmatter: { type: 'boolean' },
          includeContent: { type: 'boolean' },
          vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
        },
        required: ['path'],
      },
      handler: async (args) => {
        const { path, includeFrontmatter, includeContent } = args as {
          path: string; includeFrontmatter?: boolean; includeContent?: boolean;
        };
        const ctx = resolveVault(args as Record<string, unknown>);
        const note = await ctx.vault.readNote(path, { includeFrontmatter, includeContent });
        // Enrich with inbound links from graph if available
        if (note.inboundLinks.length === 0) {
          try {
            note.inboundLinks = ctx.graph.getNeighbors(path, 'in');
          } catch {
            // graph may not have this node yet
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
      },
    },
    {
      name: 'write_note',
      description: 'Write a markdown note to the vault',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          frontmatter: { type: 'object' },
          overwrite: { type: 'boolean' },
          vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
        },
        required: ['path', 'content'],
      },
      handler: async (args) => {
        const { path, content, frontmatter, overwrite } = args as {
          path: string; content: string; frontmatter?: Record<string, unknown>; overwrite?: boolean;
        };
        const ctx = resolveVault(args as Record<string, unknown>);
        await ctx.vault.writeNote(path, content, { frontmatter, overwrite });
        ctx.indexer?.markDirty(path);
        return { content: [{ type: 'text', text: `Wrote ${path}` }] };
      },
    },
    {
      name: 'append_note',
      description: 'Append content to a note',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path', 'content'],
      },
      handler: async (args) => {
        const { path, content } = args as { path: string; content: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        await ctx.vault.appendNote(path, content);
        ctx.indexer?.markDirty(path);
        return { content: [{ type: 'text', text: `Appended to ${path}` }] };
      },
    },
    {
      name: 'patch_note',
      description: 'Patch a note with replace/append/prepend/delete',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          target: { type: 'string' },
          operation: { type: 'string', enum: ['replace', 'append', 'prepend', 'delete'] },
          replacement: { type: 'string' },
          vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
        },
        required: ['path', 'target', 'operation'],
      },
      handler: async (args) => {
        const { path, target, operation, replacement } = args as {
          path: string; target: string; operation: 'replace' | 'append' | 'prepend' | 'delete'; replacement?: string;
        };
        const ctx = resolveVault(args as Record<string, unknown>);
        await ctx.vault.patchNote(path, target, operation, replacement);
        ctx.indexer?.markDirty(path);
        return { content: [{ type: 'text', text: `Patched ${path}` }] };
      },
    },
    {
      name: 'delete_note',
      description: 'Delete a note (optionally soft-delete)',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, soft: { type: 'boolean' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path, soft } = args as { path: string; soft?: boolean };
        const ctx = resolveVault(args as Record<string, unknown>);
        await ctx.vault.deleteNote(path, { soft });
        return { content: [{ type: 'text', text: `Deleted ${path}` }] };
      },
    },
    {
      name: 'move_note',
      description: 'Move or rename a note',
      inputSchema: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['from', 'to'],
      },
      handler: async (args) => {
        const { from, to } = args as { from: string; to: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const { updatedFiles } = await ctx.vault.moveNote(from, to);
        ctx.indexer?.markDirty(to);
        const summary = updatedFiles.length > 0
          ? `Moved ${from} → ${to}\nUpdated backlinks in ${updatedFiles.length} file(s): ${updatedFiles.join(', ')}`
          : `Moved ${from} → ${to}`;
        return { content: [{ type: 'text', text: summary }] };
      },
    },
    {
      name: 'list_directory',
      description: 'List files and folders in a directory',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
      },
      handler: async (args) => {
        const dir = (args as { path?: string }).path || '';
        const ctx = resolveVault(args as Record<string, unknown>);
        const entries = await ctx.vault.listDirectory(dir);
        return { content: [{ type: 'text', text: JSON.stringify(entries) }] };
      },
    },
    {
      name: 'search_notes',
      description: 'Search notes by text query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          folder: { type: 'string' },
          limit: { type: 'number' },
          vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { query, folder, limit } = args as { query: string; folder?: string; limit?: number };
        const ctx = resolveVault(args as Record<string, unknown>);
        const results = await ctx.vault.searchNotes(query, { folder, limit });
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      },
    },
    {
      name: 'get_vault_stats',
      description: 'Get vault statistics',
      inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
      handler: async (args) => {
        const ctx = resolveVault(args as Record<string, unknown>);
        const stats = await ctx.vault.getVaultStats();
        return { content: [{ type: 'text', text: JSON.stringify(stats) }] };
      },
    },
    {
      name: 'list_all_tags',
      description: 'List all tags and their counts',
      inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
      handler: async (args) => {
        const ctx = resolveVault(args as Record<string, unknown>);
        const tags = await ctx.vault.listAllTags();
        return { content: [{ type: 'text', text: JSON.stringify(tags) }] };
      },
    },
    {
      name: 'read_file',
      description: 'Read any file from the vault (markdown, canvas, json, images as base64)',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path } = args as { path: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const fullPath = await ctx.vault.resolvePath(path);
        const result = await fileRouter.read(fullPath);
        if (typeof result === 'string') {
          return { content: [{ type: 'text', text: result }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'write_file',
      description: 'Write any file to the vault (text, canvas, json, base64 binary)',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path', 'content'],
      },
      handler: async (args) => {
        const { path: notePath, content } = args as { path: string; content: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        await ctx.vault.writeNote(notePath, content, { overwrite: true });
        return { content: [{ type: 'text', text: `Wrote ${notePath}` }] };
      },
    },
    {
      name: 'manage_tags',
      description: 'Add, remove, or set tags on a note',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['add', 'remove', 'set'] },
          tags: { type: 'array', items: { type: 'string' } },
          vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
        },
        required: ['path', 'action', 'tags'],
      },
      handler: async (args) => {
        const { path, action, tags } = args as { path: string; action: 'add' | 'remove' | 'set'; tags: string[] };
        const ctx = resolveVault(args as Record<string, unknown>);
        await ctx.vault.manageTags(path, action, tags);
        return { content: [{ type: 'text', text: `Tags ${action}ed on ${path}` }] };
      },
    },
    {
      name: 'validate_note',
      description: 'Validate note frontmatter, tags, and ontology compliance',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path } = args as { path: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const result = await ctx.vault.validateNote(path);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    },
    {
      name: 'fs_list_notes',
      description: 'List markdown notes with optional tag, date, or pattern filters',
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Subfolder to search' },
          tag: { type: 'string', description: 'Filter by frontmatter tag' },
          pattern: { type: 'string', description: 'Glob pattern' },
          vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
        },
      },
      handler: async (args) => {
        const { folder, tag, pattern } = args as { folder?: string; tag?: string; pattern?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        let files = await ctx.vault.listNotes(folder ?? '');
        if (tag) {
          const tagged: string[] = [];
          const batchSize = 100;
          for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const tagsBatch = await Promise.all(batch.map((f) => ctx.vault.readNoteTags(f)));
            for (let j = 0; j < batch.length; j++) {
              if (tagsBatch[j].includes(tag)) tagged.push(batch[j]);
            }
            // Yield event loop to prevent MCP transport starvation on large vaults.
            await new Promise((resolve) => setImmediate(resolve));
          }
          files = tagged;
        }
        if (pattern) {
          const escaped = pattern
            .replace(/[.+^${}()|[\]\\\-]/g, '\\$&')
            .replace(/\*\*/g, '|||')
            .replace(/\*/g, '[^/]*')
            .replace(/\|\|\|/g, '.*')
            .replace(/\?/g, '.');
          const regex = new RegExp('^' + escaped + '$');
          files = files.filter((f) => regex.test(f));
        }
        return { content: [{ type: 'text', text: JSON.stringify(files) }] };
      },
    },
    {
      name: 'fs_get_graph',
      description: 'Export full vault graph as adjacency list',
      inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
      handler: async (args) => {
        const ctx = resolveVault(args as Record<string, unknown>);
        const data = ctx.graph.getGraph();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'fs_graph_find_path',
      description: 'Shortest path between two notes via BFS',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' },
        },
        required: ['from', 'to'],
      },
      handler: async (args) => {
        const { from, to } = args as { from: string; to: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        const pathResult = ctx.graph.getPath(from, to);
        return { content: [{ type: 'text', text: JSON.stringify(pathResult, null, 2) }] };
      },
    },
    {
      name: 'get_vault_rules',
      description: 'Return ontology, folder rules, and protocol context',
      inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
      handler: async (args) => {
        const ctx = resolveVault(args as Record<string, unknown>);
        const readFile = async (relativePath: string) => {
          try {
            return await fs.readFile(path.join(ctx.vaultPath, relativePath), 'utf8');
          } catch {
            return null;
          }
        };
        const ontology = (ctx.vault as any)['tagEngine']?.getOntology?.() ?? (await readFile('meta/ontology.md')) ?? '(No ontology defined)';
        const protocol = (await readFile('meta/protocol.md')) ?? '(No protocol defined)';
        const linkRules = (await readFile('meta/link-rules.md')) ?? '(No link rules defined)';
        return { content: [{ type: 'text', text: JSON.stringify({ ontology, protocol, linkRules }, null, 2) }] };
      },
    },
  ];
}
