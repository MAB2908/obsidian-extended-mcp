// v0.1b:
// ───────────────────────────────────────────
// Dreaming Topic Loader
// ───────────────────────────────────────────

import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { SignalStore } from './SignalStore.js';
import type { DreamTopic } from './types.js';
import { semanticConfig } from '../../shared/config.js';

export interface TopicLoaderOptions {
  scope?: string; // optional domain prefix filter
}

async function batchMap<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export class TopicLoader {
  constructor(
    private vault: IVaultManager,
    private signals: SignalStore,
  ) {}

  async load(opts?: TopicLoaderOptions): Promise<DreamTopic[]> {
    const allPaths = await this.vault.listNotes('');
    const filtered = opts?.scope
      ? allPaths.filter((p) => p.startsWith(opts.scope!))
      : allPaths;

    const signalMap = this.signals.list();

    const topics = await batchMap(filtered, semanticConfig.topicLoaderBatchSize, (relPath) =>
      this.loadOne(relPath, signalMap),
    );

    return topics.filter((t): t is DreamTopic => t !== null);
  }

  private async loadOne(
    relPath: string,
    signalMap: Map<string, import('./types.js').DreamSignals>,
  ): Promise<DreamTopic | null> {
    try {
      const note = await this.vault.readNote(relPath, {
        includeContent: true,
        includeFrontmatter: true,
      });

      const domain = relPath.split('/')[0] || 'root';
      const signals = signalMap.get(relPath) ?? {
        importance: 50,
        maturity: 'draft' as const,
        accessCount: 0,
      };

      // Derive summary: frontmatter.summary or first 200 chars of content
      const summary =
        (note.frontmatter.summary as string) ||
        note.content.replace(/[#*\-_\n\r]/g, ' ').slice(0, 200).trim();

      // related from frontmatter.related or outboundLinks
      const related: string[] = Array.isArray(note.frontmatter.related)
        ? note.frontmatter.related.map(String)
        : note.outboundLinks;

      // Derive mtimeMs from note.modified or current time
      const mtimeMs = note.modified?.getTime() ?? Date.now();

      return {
        path: relPath,
        title: note.title,
        summary,
        html: note.content,
        mtimeMs,
        related,
        signals,
        domain,
      };
    } catch {
      // best-effort: skip malformed/unreadable
      return null;
    }
  }
}
