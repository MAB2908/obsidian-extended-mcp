import { createHash } from 'crypto';
import { semanticConfig } from '../../shared/config.js';
export class BackgroundIndexer {
    vault;
    graph;
    bm25;
    vector;
    persistence;
    semanticDb;
    dirtyFiles = new Set();
    batchTimer = null;
    isShuttingDown = false;
    currentBatch;
    debounceMs = semanticConfig.indexerDebounceMs;
    maxDirtySize = 100;
    busyRetries = new Map();
    maxBusyRetries = 5;
    constructor(vault, graph, bm25, vector, persistence, semanticDb) {
        this.vault = vault;
        this.graph = graph;
        this.bm25 = bm25;
        this.vector = vector;
        this.persistence = persistence;
        this.semanticDb = semanticDb;
    }
    async initialize() {
        if (this.persistence) {
            const loaded = await this.persistence.load(this.graph, this.bm25, this.vector);
            if (!loaded) {
                this.markAllDirty();
            }
        }
    }
    markDirty(relPath) {
        this.dirtyFiles.add(relPath);
        if (this.dirtyFiles.size >= this.maxDirtySize) {
            if (this.batchTimer)
                clearTimeout(this.batchTimer);
            this.batchTimer = null;
            this.runBatch().catch((err) => console.error('[BackgroundIndexer] Batch failed:', err));
            return;
        }
        this.scheduleBatch();
    }
    markAllDirty() {
        this.dirtyFiles.clear();
        this.dirtyFiles.add('*');
        this.scheduleBatch();
    }
    scheduleBatch() {
        if (this.batchTimer)
            clearTimeout(this.batchTimer);
        this.batchTimer = setTimeout(() => {
            this.runBatch().catch((err) => console.error('[BackgroundIndexer] Batch failed:', err));
        }, this.debounceMs);
    }
    stop() {
        this.isShuttingDown = true;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    }
    async stopGraceful() {
        this.isShuttingDown = true;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        if (this.currentBatch) {
            await this.currentBatch;
        }
        this.dirtyFiles.clear();
    }
    async runBatch() {
        if (this.isShuttingDown)
            return;
        if (this.currentBatch) {
            this.scheduleBatch();
            return;
        }
        this.currentBatch = this.runBatchInternal();
        try {
            await this.currentBatch;
        }
        finally {
            this.currentBatch = undefined;
        }
    }
    async yieldEventLoop() {
        return new Promise((resolve) => setImmediate(resolve));
    }
    async runBatchInternal() {
        const toProcess = this.dirtyFiles;
        this.dirtyFiles = new Set();
        this.batchTimer = null;
        let files = [];
        try {
            if (toProcess.has('*')) {
                files = await this.collectAllMarkdownFiles();
            }
            else {
                files = [...toProcess];
            }
            // Build wikilink resolution map: basename/alias -> full path
            const linkMap = new Map();
            for (let i = 0; i < files.length; i++) {
                const relPath = files[i];
                if (i % 50 === 0)
                    await this.yieldEventLoop();
                try {
                    const note = await this.vault.readNote(relPath, { includeFrontmatter: false, includeContent: false });
                    const base = relPath.replace(/\.md$/, '');
                    const basename = base.split('/').pop() || base;
                    linkMap.set(basename, relPath);
                    linkMap.set(base, relPath);
                    for (const alias of note.frontmatter.aliases || []) {
                        linkMap.set(alias, relPath);
                    }
                }
                catch (err) {
                    console.error('[BackgroundIndexer] Skipping unreadable file:', relPath, err);
                }
            }
            const noteData = [];
            const vectorDocs = [];
            const chunkVectorDocs = [];
            for (let i = 0; i < files.length; i++) {
                const relPath = files[i];
                if (i % 50 === 0)
                    await this.yieldEventLoop();
                try {
                    const note = await this.vault.readNote(relPath, { includeFrontmatter: true, includeContent: true });
                    // Resolve outbound links to actual paths
                    const resolvedOutbound = note.outboundLinks.map((target) => {
                        if (linkMap.has(target))
                            return linkMap.get(target);
                        const basename = target.split('/').pop() || target;
                        return linkMap.get(basename) || target;
                    });
                    const contentHash = await this.hashContent(note.content);
                    noteData.push({
                        relPath,
                        title: note.title,
                        content: note.content,
                        tags: note.tags,
                        frontmatter: note.frontmatter,
                        outboundLinks: note.outboundLinks,
                        resolvedOutbound,
                        contentHash,
                    });
                    this.busyRetries.delete(relPath);
                }
                catch (err) {
                    if (err && typeof err === 'object' && 'code' in err && err.code === 'EBUSY') {
                        const retries = (this.busyRetries.get(relPath) ?? 0) + 1;
                        if (retries <= this.maxBusyRetries) {
                            this.busyRetries.set(relPath, retries);
                            this.dirtyFiles.add(relPath);
                            console.error('[BackgroundIndexer] File busy, re-queued:', relPath, `(retry ${retries})`);
                            this.scheduleBatch();
                        }
                        else {
                            console.error('[BackgroundIndexer] File permanently busy, giving up:', relPath);
                            this.busyRetries.delete(relPath);
                        }
                    }
                    // skip other unreadable files
                }
            }
            // Phase 2: Atomically update all in-memory indexes (synchronous, no interleaving)
            for (let i = 0; i < noteData.length; i++) {
                const data = noteData[i];
                if (i % 50 === 0)
                    await this.yieldEventLoop();
                this.bm25.addDoc(data.relPath, `${data.title} ${data.content}`);
                this.graph.addNode({
                    path: data.relPath,
                    title: data.title,
                    aliases: data.frontmatter.aliases || [],
                    tags: data.tags,
                    frontmatter: data.frontmatter,
                    outbound: data.resolvedOutbound,
                    inbound: [],
                    isOrphan: data.resolvedOutbound.length === 0,
                    isDeadend: false,
                    hasUnresolvedLinks: data.outboundLinks.some((t) => !linkMap.has(t) && !linkMap.has(t.split('/').pop() || t)),
                });
                for (const target of data.resolvedOutbound) {
                    this.graph.addEdge(data.relPath, target, 'wikilink');
                }
                if (this.semanticDb) {
                    this.semanticDb.upsertNode({
                        path: data.relPath,
                        title: data.title,
                        contentHash: data.contentHash,
                        wordCount: data.content.split(/\s+/).length,
                    });
                    this.semanticDb.deleteEdgesFrom(data.relPath);
                    for (const target of data.outboundLinks) {
                        this.semanticDb.upsertEdge({ fromPath: data.relPath, toPath: target, type: 'wikilink' });
                    }
                    this.semanticDb.updateFTSContent(data.relPath, `${data.title}\n${data.content}`);
                }
                if (this.vector && this.semanticDb) {
                    const chunks = this.chunkNote(`${data.title}\n${data.content}`);
                    this.semanticDb.deleteChunks(data.relPath);
                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const chunkId = this.semanticDb.upsertChunk({
                            nodePath: data.relPath,
                            chunkIndex: i,
                            heading: chunk.heading,
                            content: chunk.content,
                            tokenCount: chunk.content.split(/\s+/).length,
                        });
                        chunkVectorDocs.push({ id: `${data.relPath}#${i}`, text: chunk.content, chunkId });
                    }
                }
                else if (this.vector) {
                    vectorDocs.push({ id: data.relPath, text: `${data.title}\n${data.content}` });
                }
            }
            if (this.vector && chunkVectorDocs.length > 0) {
                try {
                    const semanticDb = this.semanticDb;
                    await this.vector.indexDocs(chunkVectorDocs.map((c) => ({ id: c.id, text: c.text })));
                    for (const chunk of chunkVectorDocs) {
                        const vec = this.vector.getVector(chunk.id);
                        if (vec && semanticDb) {
                            semanticDb.upsertEmbedding({
                                chunkId: chunk.chunkId,
                                model: this.vector.modelName,
                                vector: new Float32Array(vec),
                                dimensions: vec.length,
                            });
                        }
                    }
                }
                catch (err) {
                    console.error('[BackgroundIndexer] Vector embedding failed:', err);
                }
            }
            else if (this.vector && vectorDocs.length > 0) {
                try {
                    await this.vector.indexDocs(vectorDocs);
                }
                catch (err) {
                    console.error('[BackgroundIndexer] Vector indexDocs failed:', err);
                }
            }
            if (this.persistence) {
                await this.persistence.save(this.graph, this.bm25, this.vector);
            }
        }
        catch (err) {
            // Re-queue all files from this batch for retry (BI-001)
            for (const f of files) {
                this.dirtyFiles.add(f);
            }
            if (toProcess.has('*')) {
                this.dirtyFiles.add('*');
            }
            throw err;
        }
        finally {
            // cleanup done via currentBatch = undefined in runBatch
        }
    }
    chunkNote(content) {
        const lines = content.split('\n');
        const chunks = [];
        let currentHeading;
        let currentLines = [];
        for (const line of lines) {
            const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
            if (headingMatch) {
                if (currentLines.length > 0) {
                    chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
                }
                currentHeading = headingMatch[2].trim();
                currentLines = [];
            }
            else {
                currentLines.push(line);
            }
        }
        if (currentLines.length > 0 || chunks.length === 0 || currentHeading !== undefined) {
            chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
        }
        return chunks;
    }
    async hashContent(content) {
        return createHash('sha256').update(content).digest('hex');
    }
    async collectAllMarkdownFiles() {
        const results = [];
        const walk = async (dir) => {
            const entries = await this.vault.listDirectory(dir);
            for (const e of entries) {
                const rel = dir ? `${dir}/${e.name}` : e.name;
                if (e.isDirectory) {
                    await walk(rel);
                }
                else if (e.name.endsWith('.md')) {
                    results.push(rel);
                }
            }
        };
        await walk('');
        return results;
    }
}
//# sourceMappingURL=BackgroundIndexer.js.map