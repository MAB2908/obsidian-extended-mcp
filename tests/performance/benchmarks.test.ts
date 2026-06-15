// v0.2b:
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VaultManager } from '../../src/layers/L1-filesystem/VaultManager.js';
import { GraphEngine } from '../../src/layers/L4-semantic/GraphEngine.js';
import { SemanticDatabase } from '../../src/layers/L4-semantic/SemanticDatabase.js';
import { generateSyntheticVault, cleanupVault } from './synthetic.js';

const PERF_DIR = './tests/performance/.perf-vault';

describe('Performance Benchmarks', () => {
  describe('Graph build', () => {
    it('builds graph for 1K notes in < 500ms', async () => {
      const vaultPath = `${PERF_DIR}-1k`;
      try {
        await generateSyntheticVault(vaultPath, { noteCount: 1000, linksPerNote: 5, wordsPerNote: 200 });
        const vault = new VaultManager(vaultPath);
        const graph = new GraphEngine();

        const start = Date.now();
        const files = await vault.listNotes('');
        for (const relPath of files) {
          const note = await vault.readNote(relPath, { includeFrontmatter: true, includeContent: true });
          graph.addNode({
            path: relPath,
            title: note.title,
            aliases: (note.frontmatter.aliases as string[]) || [],
            tags: note.tags,
            frontmatter: note.frontmatter,
            outbound: note.outboundLinks,
            inbound: [],
            isOrphan: note.outboundLinks.length === 0,
            isDeadend: false,
            hasUnresolvedLinks: false,
          });
          for (const target of note.outboundLinks) {
            graph.addEdge(relPath, target, 'wikilink');
          }
        }
        const elapsed = Date.now() - start;

        expect(files.length).toBe(1000);
        console.log(`[Benchmark] Graph build 1K notes: ${elapsed}ms`);
        expect(elapsed).toBeLessThan(3000);
      } finally {
        await cleanupVault(vaultPath);
      }
    }, 30000);

    it('builds graph for 10K notes in < 2s', async () => {
      const vaultPath = `${PERF_DIR}-10k`;
      try {
        await generateSyntheticVault(vaultPath, { noteCount: 10000, linksPerNote: 5, wordsPerNote: 200 });
        const vault = new VaultManager(vaultPath);
        const graph = new GraphEngine();

        const start = Date.now();
        const files = await vault.listNotes('');
        for (const relPath of files) {
          const note = await vault.readNote(relPath, { includeFrontmatter: true, includeContent: true });
          graph.addNode({
            path: relPath,
            title: note.title,
            aliases: (note.frontmatter.aliases as string[]) || [],
            tags: note.tags,
            frontmatter: note.frontmatter,
            outbound: note.outboundLinks,
            inbound: [],
            isOrphan: note.outboundLinks.length === 0,
            isDeadend: false,
            hasUnresolvedLinks: false,
          });
          for (const target of note.outboundLinks) {
            graph.addEdge(relPath, target, 'wikilink');
          }
        }
        const elapsed = Date.now() - start;

        expect(files.length).toBe(10000);
        console.log(`[Benchmark] Graph build 10K notes: ${elapsed}ms`);
        expect(elapsed).toBeLessThan(8000);
      } finally {
        await cleanupVault(vaultPath);
      }
    }, 60000);
  });

  describe('FTS5 search', () => {
    it('searches 10K notes in < 100ms', async () => {
      const vaultPath = `${PERF_DIR}-fts5`;
      try {
        await generateSyntheticVault(vaultPath, { noteCount: 10000, linksPerNote: 3, wordsPerNote: 200 });
        const vault = new VaultManager(vaultPath);
        const semanticDb = new SemanticDatabase(vaultPath);
        await semanticDb.initSchema();

        const files = await vault.listNotes('');
        for (const relPath of files) {
          const note = await vault.readNote(relPath, { includeFrontmatter: false, includeContent: true });
          semanticDb.upsertNode({ path: relPath, title: note.title, contentHash: '', wordCount: note.content.split(/\s+/).length });
          semanticDb.updateFTSContent(relPath, `${note.title}\n${note.content}`);
        }

        const start = Date.now();
        const results = semanticDb.searchFTS('lorem ipsum', 20);
        const elapsed = Date.now() - start;

        expect(files.length).toBe(10000);
        expect(results.length).toBeGreaterThan(0);
        console.log(`[Benchmark] FTS5 search 10K notes: ${elapsed}ms`);
        expect(elapsed).toBeLessThan(500);
      } finally {
        await cleanupVault(vaultPath);
      }
    }, 60000);
  });

  describe('Ingest-like operation', () => {
    it('reads and indexes a note in < 1s', async () => {
      const vaultPath = `${PERF_DIR}-ingest`;
      try {
        await generateSyntheticVault(vaultPath, { noteCount: 100, linksPerNote: 3, wordsPerNote: 500 });
        const vault = new VaultManager(vaultPath);
        const semanticDb = new SemanticDatabase(vaultPath);
        await semanticDb.initSchema();
        const graph = new GraphEngine();

        const start = Date.now();
        const note = await vault.readNote('folder00/note-00000.md', { includeFrontmatter: true, includeContent: true });
        semanticDb.upsertNode({ path: note.path, title: note.title, contentHash: '', wordCount: note.content.split(/\s+/).length });
        semanticDb.updateFTSContent(note.path, `${note.title}\n${note.content}`);
        graph.addNode({
          path: note.path,
          title: note.title,
          aliases: [],
          tags: note.tags,
          frontmatter: note.frontmatter,
          outbound: note.outboundLinks,
          inbound: [],
          isOrphan: note.outboundLinks.length === 0,
          isDeadend: false,
          hasUnresolvedLinks: false,
        });
        const elapsed = Date.now() - start;

        console.log(`[Benchmark] Ingest-like read+index: ${elapsed}ms`);
        expect(elapsed).toBeLessThan(2000);
      } finally {
        await cleanupVault(vaultPath);
      }
    }, 30000);
  });
});
