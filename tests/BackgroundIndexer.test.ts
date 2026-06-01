// v0.1b:
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { VaultManager } from '../src/layers/L1-filesystem/VaultManager.js';
import { GraphEngine } from '../src/layers/L4-semantic/GraphEngine.js';
import { BM25Engine } from '../src/layers/L4-semantic/BM25Engine.js';
import { BackgroundIndexer } from '../src/layers/L4-semantic/BackgroundIndexer.js';
import { SemanticDatabase } from '../src/layers/L4-semantic/SemanticDatabase.js';

describe('BackgroundIndexer', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-indexer-test-'));
    vaultPath = path.join(tmpDir, 'vault');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'notes'), { recursive: true });
    await fs.writeFile(path.join(vaultPath, 'notes', 'a.md'), '---\ntitle: A\n---\n# A\n\n[[b]]', 'utf-8');
    await fs.writeFile(path.join(vaultPath, 'notes', 'b.md'), '---\ntitle: B\n---\n# B\n\n[[a]]', 'utf-8');
  });

  async function cleanup(dir: string): Promise<void> {
    for (let i = 0; i < 5; i++) {
      try { await fs.rm(dir, { recursive: true, force: true }); return; }
      catch (e: any) { if ((e.code === 'EBUSY' || e.code === 'EPERM') && i < 4) await new Promise((r) => setTimeout(r, 300)); else throw e; }
    }
  }
  afterAll(async () => {
    await cleanup(tmpDir);
  });

  it('initializes without persistence', async () => {
    const vault = new VaultManager(vaultPath);
    const graph = new GraphEngine();
    const bm25 = new BM25Engine();
    const semanticDb = new SemanticDatabase(vaultPath);
    await semanticDb.initSchema();
    const indexer = new BackgroundIndexer(vault, graph, bm25, undefined, undefined, semanticDb);

    await indexer.initialize();
    // Without persistence, dirtyFiles remains empty until markDirty/markAllDirty is called
    expect(indexer['dirtyFiles'].size).toBe(0);
    indexer.stop();
    semanticDb.close();
  });

  it('stops cleanly', async () => {
    const vault = new VaultManager(vaultPath);
    const graph = new GraphEngine();
    const bm25 = new BM25Engine();
    const semanticDb = new SemanticDatabase(vaultPath);
    await semanticDb.initSchema();
    const indexer = new BackgroundIndexer(vault, graph, bm25, undefined, undefined, semanticDb);

    indexer.markDirty('notes/a.md');
    await indexer.stopGraceful();
    expect(indexer['batchTimer']).toBeNull();
    expect(indexer['dirtyFiles'].size).toBe(0);
    semanticDb.close();
  });
});
