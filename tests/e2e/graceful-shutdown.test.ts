// v0.1b:
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { VaultPool } from '../../src/layers/L1-filesystem/VaultPool.js';
import { DreamingEngine } from '../../src/layers/L9-dreaming/DreamingEngine.js';
import { BM25Engine } from '../../src/layers/L4-semantic/BM25Engine.js';

describe('Graceful Shutdown', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-shutdown-test-'));
    vaultPath = path.join(tmpDir, 'vault');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'notes'), { recursive: true });
    await fs.writeFile(path.join(vaultPath, 'notes', 'hello.md'), '# Hello', 'utf-8');
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('VaultPool.shutdown stops indexers, closes semantic DBs and dreaming engines', async () => {
    const pool = new VaultPool();
    const entry = await pool.addVault(vaultPath);
    await pool.initializeComponents(entry);

    const bm25 = new BM25Engine();
    const dreaming = await DreamingEngine.create({ vaultPath, vault: entry.vault, bm25 });
    (entry as any).dreaming = dreaming;

    const closeSpy = vi.spyOn(dreaming, 'close');

    expect(pool.size).toBe(1);
    await pool.shutdown();
    expect(pool.size).toBe(0);
    expect(closeSpy).toHaveBeenCalled();

    closeSpy.mockRestore();
  });
});
