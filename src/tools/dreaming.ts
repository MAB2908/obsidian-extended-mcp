// v0.1b:
import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import { DreamingEngine } from '../layers/L9-dreaming/DreamingEngine.js';
import type { IDreamingEngine } from '../shared/interfaces/IDreamingEngine.js';
import type { DreamKind } from '../layers/L9-dreaming/types.js';

export function createDreamingTools(
  resolveVault: (args: Record<string, unknown>) => VaultContext
): ToolHandler[] {
  /** Lazily initialize DreamingEngine on a vault entry */
  async function getEngine(ctx: VaultContext): Promise<IDreamingEngine> {
    if (ctx.dreaming) return ctx.dreaming;
    const engine = await DreamingEngine.create({
      vaultPath: ctx.vaultPath,
      vault: ctx.vault,
      bm25: ctx.bm25,
    });
    (ctx as any).dreaming = engine;
    return engine;
  }

  return [
    {
      name: 'dream_scan',
      description:
        'L9-Dreaming: Scan the vault for maintenance candidates (link gaps, merge opportunities, stale notes, missing MOCs). Returns a session ID and ranked candidates.',
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
        const a = args as Record<string, unknown>;
        const ctx = resolveVault(a);
        const engine = await getEngine(ctx);
        const kinds = (a.kinds as string[] | undefined)?.filter(
          (k): k is DreamKind => ['link', 'merge', 'prune', 'synthesize'].includes(k)
        );
        const result = await engine.scan({
          vaultPath: ctx.vaultPath,
          kinds,
          maxCandidates: (a.maxCandidates as number | undefined) ?? 20,
          scope: a.scope as string | undefined,
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
      description:
        'L9-Dreaming: Finalize a dreaming session by archiving selected paths. Requires the sessionId from dream_scan.',
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
        const a = args as Record<string, unknown>;
        const ctx = resolveVault(a);
        const engine = await getEngine(ctx);
        const result = await engine.finalize({
          sessionId: a.sessionId as string,
          vaultPath: ctx.vaultPath,
          archivePaths: a.archivePaths as string[],
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
      description:
        'L9-Dreaming: Undo a finalized session by restoring archived paths from the undo log.',
      inputSchema: {
        type: 'object',
        properties: {
          vaultPath: { type: 'string' },
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
      },
      handler: async (args) => {
        const a = args as Record<string, unknown>;
        const ctx = resolveVault(a);
        const engine = await getEngine(ctx);
        const result = await engine.undo(a.sessionId as string);
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
