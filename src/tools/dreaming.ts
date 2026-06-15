// v0.2b:
import type { ToolHandler, LintReport } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import { DreamingEngine } from '../layers/L9-dreaming/DreamingEngine.js';
import type { IDreamingEngine } from '../shared/interfaces/IDreamingEngine.js';
import type { DreamKind } from '../layers/L9-dreaming/types.js';
import { PipelineError } from '../shared/errors.js';

export function createDreamingTools(
  resolveVault: (args: Record<string, unknown>) => VaultContext
): ToolHandler[] {
  /** Lazily initialize DreamingEngine on a vault entry */
  async function getEngine(ctx: VaultContext): Promise<IDreamingEngine> {
    if (ctx.dreaming) return ctx.dreaming;
    const engine = await DreamingEngine.create({
      vaultPath: ctx.vaultPath,
      vault: ctx.vault,
      semanticDb: ctx.semanticDb,
    });
    (ctx as any).dreaming = engine;
    return engine;
  }

  async function applySafeFixes(vault: VaultContext['vault'], report: LintReport): Promise<Array<{ file: string; type: string; details?: string; error?: string }>> {
    const fixes: Array<{ file: string; type: string; details?: string; error?: string }> = [];

    // Remove tags that are not present in the vault ontology
    const invalidByFile = new Map<string, Set<string>>();
    for (const { tag, file } of report.invalidTags ?? []) {
      const set = invalidByFile.get(file) ?? new Set<string>();
      set.add(tag);
      invalidByFile.set(file, set);
    }

    for (const [file, tags] of invalidByFile) {
      try {
        const note = await vault.readNote(file);
        const newTags = note.tags.filter((t) => !tags.has(t));
        if (newTags.length !== note.tags.length) {
          await vault.writeNote(file, note.content, {
            frontmatter: { ...note.frontmatter, tags: newTags },
            overwrite: true,
          });
          fixes.push({ file, type: 'removed-invalid-tags', details: Array.from(tags).join(', ') });
        }
      } catch (err) {
        fixes.push({ file, type: 'removed-invalid-tags', error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Promote old seedlings to evergreen so they stop being flagged
    for (const file of report.oldSeedlings ?? []) {
      try {
        const note = await vault.readNote(file);
        if (note.frontmatter.status === 'seedling') {
          await vault.writeNote(file, note.content, {
            frontmatter: { ...note.frontmatter, status: 'evergreen' },
            overwrite: true,
          });
          fixes.push({ file, type: 'promoted-seedling', details: 'status: seedling → evergreen' });
        }
      } catch (err) {
        fixes.push({ file, type: 'promoted-seedling', error: err instanceof Error ? err.message : String(err) });
      }
    }

    return fixes;
  }

  return [
    {
      name: 'dream_scan',
      description:
        'L9-Dreaming: Scan the vault for maintenance candidates (link gaps, merge opportunities, stale notes, missing MOCs). Optionally fix invalid tags and old seedlings. Returns a session ID, ranked candidates, and any applied fixes.',
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
          fix: {
            type: 'boolean',
            description: 'Apply safe fixes after scan (invalid tags, old seedlings)',
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
        const scanResult = await engine.scan({
          vaultPath: ctx.vaultPath,
          kinds,
          maxCandidates: (a.maxCandidates as number | undefined) ?? 20,
          scope: a.scope as string | undefined,
        });

        let fixes: Array<{ file: string; type: string; details?: string; error?: string }> = [];
        if (a.fix === true) {
          if (!ctx.pipeline) {
            throw new PipelineError('PIPELINE_NOT_INITIALIZED', 'Pipeline not initialized');
          }
          const lintResult = (await ctx.pipeline.runLint()) as { data: LintReport };
          fixes = await applySafeFixes(ctx.vault, lintResult.data);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ...scanResult, fixes }, null, 2),
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
