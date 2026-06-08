// v0.2b:
// ───────────────────────────────────────────
// Dreaming Topic Loader
// ───────────────────────────────────────────
import { semanticConfig } from '../../shared/config.js';
async function batchMap(items, batchSize, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
        // Yield event loop every 10 batches to prevent MCP timeouts on large vaults
        if (i > 0 && i % (batchSize * 10) === 0) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
    return results;
}
export class TopicLoader {
    vault;
    signals;
    constructor(vault, signals) {
        this.vault = vault;
        this.signals = signals;
    }
    async load(opts) {
        const allPaths = await this.vault.listNotes('');
        const filtered = opts?.scope
            ? allPaths.filter((p) => p.startsWith(opts.scope))
            : allPaths;
        const signalMap = this.signals.list();
        const topics = await batchMap(filtered, semanticConfig.topicLoaderBatchSize, (relPath) => this.loadOne(relPath, signalMap));
        return topics.filter((t) => t !== null);
    }
    async loadOne(relPath, signalMap) {
        try {
            const note = await this.vault.readNote(relPath, {
                includeContent: true,
                includeFrontmatter: true,
            });
            const domain = relPath.split('/')[0] || 'root';
            const signals = signalMap.get(relPath) ?? {
                importance: 50,
                maturity: 'draft',
                accessCount: 0,
            };
            // Derive summary: frontmatter.summary or first 200 chars of content
            const summary = note.frontmatter.summary ||
                note.content.replace(/[#*\-_\n\r]/g, ' ').slice(0, 200).trim();
            // related from frontmatter.related or outboundLinks
            const related = Array.isArray(note.frontmatter.related)
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
        }
        catch {
            // best-effort: skip malformed/unreadable
            return null;
        }
    }
}
//# sourceMappingURL=TopicLoader.js.map