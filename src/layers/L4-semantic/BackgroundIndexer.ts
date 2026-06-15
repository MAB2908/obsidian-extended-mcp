// v0.2b:
import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import type { ISemanticDatabase } from '../../shared/interfaces/ISemanticDatabase.js';
import type { IBackgroundIndexer } from '../../shared/interfaces/IBackgroundIndexer.js';
import { IndexPersistence } from './IndexPersistence.js';
import { createHash } from 'crypto';
import { semanticConfig } from '../../shared/config.js';

export class BackgroundIndexer implements IBackgroundIndexer {
  private dirtyFiles = new Set<string>();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;
  private currentBatch?: Promise<void>;
  private readonly debounceMs = semanticConfig.indexerDebounceMs;
  private readonly maxDirtySize = 100;
  private readonly busyRetries = new Map<string, number>();
  private readonly maxBusyRetries = 5;

  constructor(
    private vault: IVaultManager,
    private graph: IGraphEngine,
    private bm25: IBM25Engine,
    private vector?: IVectorEngine,
    private persistence?: IndexPersistence,
    private semanticDb?: ISemanticDatabase
  ) {}

  async initialize(): Promise<void> {
    if (this.persistence) {
      const loaded = await this.persistence.load(this.graph, this.bm25, this.vector);
      if (!loaded) {
        this.markAllDirty();
      } else if (this.vector && this.semanticDb && this.vector.getStats().totalVectors === 0) {
        // Vector cache was skipped; load embeddings from SQLite
        console.error('[BackgroundIndexer] Loading embeddings from SQLite into vector engine...');
        const embs = this.semanticDb.getAllEmbeddings(this.vector.modelName);
        for (const emb of embs) {
          this.vector.setVector(`${emb.nodePath}#${emb.chunkIndex}`, emb.vector);
        }
        console.error(`[BackgroundIndexer] Loaded ${embs.length} embeddings from SQLite`);
      }
    }
  }

  markDirty(relPath: string): void {
    this.dirtyFiles.add(relPath);
    if (this.dirtyFiles.size >= this.maxDirtySize) {
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this.batchTimer = null;
      this.runBatch().catch((err) => console.error('[BackgroundIndexer] Batch failed:', err));
      return;
    }
    this.scheduleBatch();
  }

  markAllDirty(): void {
    this.dirtyFiles.clear();
    this.dirtyFiles.add('*');
    this.scheduleBatch();
  }

  private scheduleBatch(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      this.runBatch().catch((err) => console.error('[BackgroundIndexer] Batch failed:', err));
    }, this.debounceMs);
  }

  stop(): void {
    this.isShuttingDown = true;
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  async stopGraceful(): Promise<void> {
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

  private async runBatch(): Promise<void> {
    if (this.isShuttingDown) return;
    if (this.currentBatch) {
      this.scheduleBatch();
      return;
    }
    this.currentBatch = this.runBatchInternal();
    try {
      await this.currentBatch;
    } finally {
      this.currentBatch = undefined;
    }
  }

  private async yieldEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  private async runBatchInternal(): Promise<void> {
    const toProcess = this.dirtyFiles;
    this.dirtyFiles = new Set();
    this.batchTimer = null;
    let files: string[] = [];
    try {
    if (toProcess.has('*')) {
      files = await this.collectAllMarkdownFiles();
    } else {
      files = [...toProcess];
    }

    // Build wikilink resolution map: basename/alias -> full path
    const linkMap = new Map<string, string>();
    for (let i = 0; i < files.length; i++) {
      const relPath = files[i];
      if (i % 50 === 0) await this.yieldEventLoop();
      try {
        const note = await this.vault.readNote(relPath, { includeFrontmatter: false, includeContent: false });
        const base = relPath.replace(/\.md$/, '');
        const basename = base.split('/').pop() || base;
        linkMap.set(basename, relPath);
        linkMap.set(base, relPath);
        for (const alias of (note.frontmatter.aliases as string[]) || []) {
          linkMap.set(alias, relPath);
        }
      } catch (err) {
        console.error('[BackgroundIndexer] Skipping unreadable file:', relPath, err);
      }
    }

    // Phase 1: Collect all note data asynchronously (no shared state mutations)
    interface NoteData {
      relPath: string;
      title: string;
      content: string;
      tags: string[];
      frontmatter: Record<string, unknown>;
      outboundLinks: string[];
      resolvedOutbound: string[];
      contentHash: string;
    }
    const noteData: NoteData[] = [];
    const vectorDocs: Array<{ id: string; text: string }> = [];
    const chunkVectorDocs: Array<{ id: string; text: string; chunkId: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const relPath = files[i];
      if (i % 50 === 0) await this.yieldEventLoop();
      try {
        const note = await this.vault.readNote(relPath, { includeFrontmatter: true, includeContent: true });
        // Resolve outbound links to actual paths
        const resolvedOutbound = note.outboundLinks.map((target) => {
          if (linkMap.has(target)) return linkMap.get(target)!;
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
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'EBUSY') {
          const retries = (this.busyRetries.get(relPath) ?? 0) + 1;
          if (retries <= this.maxBusyRetries) {
            this.busyRetries.set(relPath, retries);
            this.dirtyFiles.add(relPath);
            console.error('[BackgroundIndexer] File busy, re-queued:', relPath, `(retry ${retries})`);
            this.scheduleBatch();
          } else {
            console.error('[BackgroundIndexer] File permanently busy, giving up:', relPath);
            this.busyRetries.delete(relPath);
          }
        }
        // skip other unreadable files
      }
    }

    // Phase 2: Update in-memory indexes and collect DB payloads
    const dbNodes: Array<{ path: string; title: string; contentHash: string; wordCount: number }> = [];
    const dbEdges: Array<{ fromPath: string; toPath: string; type: 'wikilink' | 'backlink' | 'implicit' | 'alias' }> = [];
    const dbChunks: Array<{ nodePath: string; chunkIndex: number; heading?: string; content: string; tokenCount?: number; id?: number }> = [];
    const dbFts: Array<{ path: string; content: string }> = [];
    for (let i = 0; i < noteData.length; i++) {
      const data = noteData[i];
      if (i % 50 === 0) await this.yieldEventLoop();
      this.bm25.addDoc(data.relPath, `${data.title} ${data.content}`);
      this.graph.addNode({
        path: data.relPath,
        title: data.title,
        aliases: (data.frontmatter.aliases as string[]) || [],
        tags: data.tags,
        frontmatter: data.frontmatter,
        outbound: data.resolvedOutbound,
        inbound: [],
        isOrphan: data.resolvedOutbound.length === 0,
        isDeadend: false,
        hasUnresolvedLinks: data.outboundLinks.some((t) => !linkMap.has(t) && !linkMap.has(t.split('/').pop() || t)),
        unresolvedLinks: data.outboundLinks.filter((t) => !linkMap.has(t) && !linkMap.has(t.split('/').pop() || t)),
      });
      for (const target of data.resolvedOutbound) {
        this.graph.addEdge(data.relPath, target, 'wikilink');
      }
      if (this.semanticDb) {
        dbNodes.push({
          path: data.relPath,
          title: data.title,
          contentHash: data.contentHash,
          wordCount: data.content.split(/\s+/).length,
        });
        for (const target of data.outboundLinks) {
          dbEdges.push({ fromPath: data.relPath, toPath: target, type: 'wikilink' });
        }
        dbFts.push({ path: data.relPath, content: `${data.title}\n${data.content}` });
      }
      if (this.vector && this.semanticDb) {
        const chunks = this.chunkNote(`${data.title}\n${data.content}`);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          dbChunks.push({
            nodePath: data.relPath,
            chunkIndex: i,
            heading: chunk.heading,
            content: chunk.content,
            tokenCount: chunk.content.split(/\s+/).length,
          });
        }
      } else if (this.vector) {
        vectorDocs.push({ id: data.relPath, text: `${data.title}\n${data.content}` });
      }
    }

    if (this.semanticDb && dbNodes.length > 0) {
      console.error(`[BackgroundIndexer] Bulk writing ${dbNodes.length} nodes, ${dbEdges.length} edges, ${dbChunks.length} chunks...`);
      if (toProcess.has('*')) {
        this.semanticDb.clearAll();
      } else {
        for (const node of dbNodes) {
          this.semanticDb.deleteEdgesFrom(node.path);
          this.semanticDb.deleteChunks(node.path);
        }
      }
      const chunkIds = this.semanticDb.bulkIndex(dbNodes, dbEdges, dbChunks);
      for (let i = 0; i < dbChunks.length; i++) {
        const chunk = dbChunks[i];
        chunkVectorDocs.push({ id: `${chunk.nodePath}#${chunk.chunkIndex}`, text: chunk.content, chunkId: chunkIds[i] });
      }
      console.error(`[BackgroundIndexer] Bulk write done, updating FTS for ${dbFts.length} notes...`);
      this.semanticDb.bulkUpdateFTS(dbFts);
      console.error('[BackgroundIndexer] FTS update done');
    }

    if (this.vector && chunkVectorDocs.length > 0) {
      try {
        const semanticDb = this.semanticDb;
        console.error(`[Indexing] Embedding ${chunkVectorDocs.length} chunks...`);
        await this.vector.indexDocs(chunkVectorDocs.map((c) => ({ id: c.id, text: c.text })));
        let embedded = 0;
        for (const chunk of chunkVectorDocs) {
          const vec = this.vector.getVector(chunk.id);
          if (vec && semanticDb) {
            semanticDb.upsertEmbedding({
              chunkId: chunk.chunkId,
              model: this.vector.modelName,
              vector: new Float32Array(vec),
              dimensions: vec.length,
            });
            embedded++;
          }
        }
        console.error(`[Indexing] Embedded ${embedded}/${chunkVectorDocs.length} chunks`);
      } catch (err) {
        console.error('[BackgroundIndexer] Vector embedding failed:', err);
      }
    } else if (this.vector && vectorDocs.length > 0) {
      try {
        await this.vector.indexDocs(vectorDocs);
      } catch (err) {
        console.error('[BackgroundIndexer] Vector indexDocs failed:', err);
      }
    }

    if (this.persistence) {
      await this.persistence.save(this.graph, this.bm25, this.vector);
    }
    } catch (err) {
      // Re-queue all files from this batch for retry (BI-001)
      for (const f of files) {
        this.dirtyFiles.add(f);
      }
      if (toProcess.has('*')) {
        this.dirtyFiles.add('*');
      }
      throw err;
    } finally {
      // cleanup done via currentBatch = undefined in runBatch
    }
  }

  private chunkNote(content: string): Array<{ heading?: string; content: string }> {
    const lines = content.split('\n');
    const chunks: Array<{ heading?: string; content: string }> = [];
    let currentHeading: string | undefined;
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
        }
        currentHeading = headingMatch[2].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0 || chunks.length === 0 || currentHeading !== undefined) {
      chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
    }
    return chunks;
  }

  private async hashContent(content: string): Promise<string> {
    return createHash('sha256').update(content).digest('hex');
  }

  private async collectAllMarkdownFiles(): Promise<string[]> {
    const results: string[] = [];
    const walk = async (dir: string) => {
      const entries = await this.vault.listDirectory(dir);
      for (const e of entries) {
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.isDirectory) {
          await walk(rel);
        } else if (e.name.endsWith('.md')) {
          results.push(rel);
        }
      }
    };
    await walk('');
    return results;
  }
}
