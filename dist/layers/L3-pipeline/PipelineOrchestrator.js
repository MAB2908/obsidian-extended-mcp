// v0.2b:
import { promises as fs } from 'fs';
import { pipelineConfig } from '../../shared/config.js';
import { PipelineMetrics } from './PipelineMetrics.js';
import { IngestAgent, QueryAgent, TagAgent, CompileAgent, LinkAgent, LintAgent, EnrichAgent, } from '../L6-ai-core/agents/index.js';
export class PipelineOrchestrator {
    vault;
    graph;
    bm25;
    indexer;
    ingestAgent;
    queryAgent;
    tagAgent;
    compileAgent;
    linkAgent;
    lintAgent;
    enrichAgent;
    metrics;
    constructor(vault, graph, bm25, indexer, adapter, metrics) {
        this.vault = vault;
        this.graph = graph;
        this.bm25 = bm25;
        this.indexer = indexer;
        this.ingestAgent = new IngestAgent(adapter);
        this.queryAgent = new QueryAgent(adapter);
        this.tagAgent = new TagAgent(adapter);
        this.compileAgent = new CompileAgent(adapter);
        this.linkAgent = new LinkAgent(adapter);
        this.lintAgent = new LintAgent(adapter);
        this.enrichAgent = new EnrichAgent(adapter);
        this.metrics = metrics ?? new PipelineMetrics();
    }
    async runIngest(relPath) {
        return this.metrics.measure('ingest', async () => {
            const note = await this.vault.readNote(relPath);
            const result = await this.ingestAgent.execute({ note });
            const newFront = {
                ...note.frontmatter,
                summary: result.data.summary,
                keyIdeas: result.data.keyIdeas,
                tags: [...new Set([...note.tags, ...result.data.suggestedTags])],
                entities: result.data.entities,
            };
            await this.vault.writeNote(relPath, note.content, { frontmatter: newFront, overwrite: true });
            this.indexer.markDirty(relPath);
            return result;
        }, { itemsIn: 1, itemsOut: 1 });
    }
    async runTag(relPath, ontology) {
        return this.metrics.measure('tag', async () => {
            const note = await this.vault.readNote(relPath);
            const result = await this.tagAgent.execute({
                title: note.title,
                content: note.content,
                existingTags: note.tags,
                ontology,
            });
            const merged = [...new Set([...note.tags, ...result.data.tags])];
            const newFront = { ...note.frontmatter, tags: merged };
            await this.vault.writeNote(relPath, note.content, { frontmatter: newFront, overwrite: true });
            this.indexer.markDirty(relPath);
            return result;
        }, { itemsIn: 1, itemsOut: 1 });
    }
    async runQuery(question) {
        return this.metrics.measure('query', async () => {
            const results = this.bm25.search(question, 10);
            const contextNotes = await Promise.all(results.map(async (r) => {
                const note = await this.vault.readNote(r.path, { includeContent: true });
                return { path: r.path, title: note.title, snippet: r.snippet || note.content.slice(0, 500) };
            }));
            const result = await this.queryAgent.execute({ question, contextNotes });
            return result;
        }, { itemsIn: 1, itemsOut: 1 });
    }
    async runCompile(sinceDays = pipelineConfig.compileSinceDays) {
        return this.metrics.measure('compile', async () => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - sinceDays);
            const sources = [];
            const concepts = [];
            for await (const n of this.iterateAllNotes()) {
                if (n.path.startsWith('concepts/')) {
                    concepts.push(n);
                }
                const created = n.frontmatter.created ? new Date(n.frontmatter.created) : n.created;
                if (created && created >= cutoff) {
                    sources.push(n);
                }
            }
            const graphSnapshot = JSON.stringify(this.graph.getGraph().nodes, null, 0);
            const ontology = await this.vault.listAllTags();
            // Batch compilation to avoid blocking the event loop and exceeding LLM context limits
            const BATCH_SIZE = 20;
            const allNewConcepts = [];
            const allUpdatedConcepts = [];
            const allUpdatedMocs = [];
            const allOrphanedSources = [];
            if (sources.length === 0) {
                return { data: { newConcepts: [], updatedConcepts: [], updatedMocs: [], orphanedSources: [] } };
            }
            const totalBatches = Math.ceil(sources.length / BATCH_SIZE);
            for (let i = 0; i < sources.length; i += BATCH_SIZE) {
                const batch = sources.slice(i, i + BATCH_SIZE);
                console.error(`[PipelineOrchestrator] Compile batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches} (${batch.length} sources)`);
                const result = await this.compileAgent.execute({
                    sources: batch,
                    existingConcepts: concepts.map((c) => c.title),
                    graphSnapshot,
                    ontology: Object.keys(ontology),
                });
                allNewConcepts.push(...result.data.newConcepts);
                allUpdatedConcepts.push(...result.data.updatedConcepts);
                allUpdatedMocs.push(...result.data.updatedMocs);
                allOrphanedSources.push(...result.data.orphanedSources);
                // Yield to event loop so other requests can be processed
                await new Promise((r) => setTimeout(r, 0));
            }
            const aggregatedResult = {
                data: {
                    newConcepts: allNewConcepts,
                    updatedConcepts: allUpdatedConcepts,
                    updatedMocs: allUpdatedMocs,
                    orphanedSources: allOrphanedSources,
                },
            };
            // Write new concepts with transaction rollback (C3)
            const writtenConcepts = [];
            const backups = [];
            try {
                for (const c of aggregatedResult.data.newConcepts) {
                    // Backup existing content before overwrite (HIGH-007)
                    try {
                        const existing = await this.vault.readNote(c.file, { includeContent: true });
                        backups.push({ path: c.file, content: existing.content, frontmatter: existing.frontmatter });
                    }
                    catch {
                        backups.push({ path: c.file });
                    }
                    await this.vault.writeNote(c.file, c.content, { frontmatter: { title: c.title, tags: ['concept', c.domain], status: 'seedling' } });
                    writtenConcepts.push(c.file);
                }
                // Only mark dirty after all writes succeed (PO-002)
                for (const writtenPath of writtenConcepts) {
                    this.indexer.markDirty(writtenPath);
                }
            }
            catch (writeErr) {
                // Rollback: restore original content or delete newly created files
                for (let i = 0; i < writtenConcepts.length; i++) {
                    const writtenPath = writtenConcepts[i];
                    const backup = backups[i];
                    try {
                        if (backup.content !== undefined) {
                            await this.vault.writeNote(writtenPath, backup.content, { frontmatter: backup.frontmatter, overwrite: true });
                        }
                        else {
                            await this.vault.deleteNote(writtenPath);
                        }
                    }
                    catch {
                        // best-effort cleanup
                    }
                }
                throw new Error(`Pipeline compile failed after writing ${writtenConcepts.length} concepts: ${writeErr.message}`);
            }
            // Update existing concepts
            for (const u of aggregatedResult.data.updatedConcepts) {
                try {
                    const note = await this.vault.readNote(u.file);
                    let section;
                    const idx = note.content.indexOf(u.appendTo);
                    if (idx !== -1) {
                        const before = note.content.slice(0, idx + u.appendTo.length);
                        const after = note.content.slice(idx + u.appendTo.length);
                        section = before + '\n' + u.content + '\n' + after;
                    }
                    else {
                        section = note.content + '\n\n' + u.appendTo + '\n' + u.content;
                    }
                    await this.vault.writeNote(u.file, section, { overwrite: true });
                    this.indexer.markDirty(u.file);
                }
                catch (err) {
                    console.error(`[PipelineOrchestrator] Failed to append to ${u.file}:`, err);
                }
            }
            return aggregatedResult;
        }, { itemsIn: sinceDays, itemsOut: 0 });
    }
    async runLink(relPath) {
        return this.metrics.measure('link', async () => {
            const note = await this.vault.readNote(relPath);
            const concepts = [];
            for await (const n of this.iterateAllNotes()) {
                if (n.path.startsWith('concepts/')) {
                    concepts.push(n);
                }
            }
            const result = await this.linkAgent.execute({
                content: note.content,
                title: note.title,
                availableConcepts: concepts.map((c) => c.title),
            });
            let updated = note.content;
            for (const s of result.data.suggestions) {
                if (s.confidence >= pipelineConfig.minConfidence) {
                    updated = updated.replace(s.phrase, `[[${s.target}|${s.phrase}]]`);
                }
            }
            if (updated !== note.content) {
                await this.vault.writeNote(relPath, updated, { overwrite: true });
                this.indexer.markDirty(relPath);
            }
            return result;
        }, { itemsIn: 1, itemsOut: 1 });
    }
    async runLint() {
        return this.metrics.measure('lint', async () => {
            const graph = this.graph.getGraph();
            const allTags = await this.vault.listAllTags();
            // Find old seedlings (status: seedling > 90 days)
            const oldSeedlings = [];
            const invalidTags = [];
            const staleMocs = [];
            const titleMap = new Map();
            const ontologyTags = new Set(Object.keys(allTags));
            const mocAgeDays = pipelineConfig.mocAgeDays;
            for await (const n of this.iterateAllNotes()) {
                if (n.frontmatter.status === 'seedling' && n.created) {
                    const days = (Date.now() - n.created.getTime()) / (1000 * 60 * 60 * 24);
                    if (days > pipelineConfig.seedlingMaxAgeDays)
                        oldSeedlings.push(n.path);
                }
                for (const t of n.tags) {
                    if (!ontologyTags.has(t))
                        invalidTags.push({ tag: t, file: n.path });
                }
                const isMoc = n.path.startsWith('index/') || n.path.startsWith('moc/') || n.tags.includes('moc');
                if (isMoc) {
                    try {
                        const fullPath = await this.vault.resolvePath(n.path);
                        const stat = await fs.stat(fullPath);
                        const daysSinceMod = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
                        if (daysSinceMod > mocAgeDays)
                            staleMocs.push(n.path);
                    }
                    catch (err) {
                        console.error(`[PipelineOrchestrator] Failed to stat MOC ${n.path}:`, err);
                    }
                }
                const list = titleMap.get(n.title) || [];
                list.push(n.path);
                titleMap.set(n.title, list);
            }
            const duplicateTitles = Array.from(titleMap.entries())
                .filter(([, paths]) => paths.length > 1)
                .map(([title, paths]) => ({ title, paths }));
            const result = await this.lintAgent.execute({
                orphans: graph.orphans,
                deadends: graph.deadends,
                unresolved: graph.unresolved,
                staleMocs,
                oldSeedlings,
                duplicateTitles,
                invalidTags,
                ontology: Object.keys(allTags),
            });
            return result;
        }, { itemsIn: 1, itemsOut: 1 });
    }
    async runEnrich(relPath) {
        return this.metrics.measure('enrich', async () => {
            const note = await this.vault.readNote(relPath);
            const neighbors = this.graph.getNeighbors(relPath, 'both');
            const result = await this.enrichAgent.execute({
                title: note.title,
                content: note.content,
                existingFrontmatter: note.frontmatter,
                relatedConcepts: neighbors,
            });
            const newFront = {
                ...note.frontmatter,
                summary: result.data.summary,
                keyPoints: result.data.keyPoints,
                tags: [...new Set([...note.tags, ...result.data.suggestedTags])],
            };
            await this.vault.writeNote(relPath, note.content, { frontmatter: newFront, overwrite: true });
            this.indexer.markDirty(relPath);
            return result;
        }, { itemsIn: 1, itemsOut: 1 });
    }
    async *iterateAllNotes() {
        const walk = async function* (vault, dir) {
            const entries = await vault.listDirectory(dir);
            for (const e of entries) {
                const rel = dir ? `${dir}/${e.name}` : e.name;
                if (e.isDirectory) {
                    yield* walk(vault, rel);
                }
                else if (e.name.endsWith('.md')) {
                    try {
                        const note = await vault.readNote(rel, { includeContent: true });
                        yield {
                            path: rel,
                            title: note.title,
                            content: note.content,
                            tags: note.tags,
                            frontmatter: note.frontmatter,
                            created: note.created,
                        };
                    }
                    catch {
                        // skip unreadable
                    }
                }
            }
        };
        yield* walk(this.vault, '');
    }
}
//# sourceMappingURL=PipelineOrchestrator.js.map