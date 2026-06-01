// v0.1b:
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { VaultPool } from '../src/layers/L1-filesystem/VaultPool.js';
import { GraphEngine } from '../src/layers/L4-semantic/GraphEngine.js';
import { BM25Engine } from '../src/layers/L4-semantic/BM25Engine.js';
import { BackgroundIndexer } from '../src/layers/L4-semantic/BackgroundIndexer.js';

describe('VaultPool', () => {
  let tempDir: string;
  let pool: VaultPool;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-pool-test-'));
    await fs.mkdir(path.join(tempDir, 'vault1', 'notes'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'vault1', 'notes', 'a.md'), '# A');
    await fs.mkdir(path.join(tempDir, 'vault2', 'notes'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'vault2', 'notes', 'b.md'), '# B');
    pool = new VaultPool();
  });

  afterEach(async () => {
    for (const [, entry] of (pool as any).entries) {
      entry.semanticDb.close();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('adds a vault and retrieves entry with correct types', async () => {
    const vault1Path = path.join(tempDir, 'vault1');
    const entry = await pool.addVault(vault1Path);
    expect(entry.vault.root).toBe(vault1Path);
    expect(entry.graph).toBeInstanceOf(GraphEngine);
    expect(entry.bm25).toBeInstanceOf(BM25Engine);
  });

  it('returns existing entry on duplicate add', async () => {
    const vault1Path = path.join(tempDir, 'vault1');
    const entry1 = await pool.addVault(vault1Path);
    const entry2 = await pool.addVault(vault1Path);
    expect(entry1).toBe(entry2);
  });

  it('lists all vaults', async () => {
    const vault1Path = path.join(tempDir, 'vault1');
    const vault2Path = path.join(tempDir, 'vault2');
    await pool.addVault(vault1Path);
    await pool.addVault(vault2Path);
    const list = await pool.listVaults();
    expect(list).toHaveLength(2);
    expect(list.map((v) => v.path)).toContain(vault1Path);
    expect(list.map((v) => v.path)).toContain(vault2Path);
  });

  it('stops BackgroundIndexer on remove', async () => {
    const vault1Path = path.join(tempDir, 'vault1');
    const entry = await pool.addVault(vault1Path);
    await pool.initializeComponents(entry);
    expect(entry.indexer).toBeDefined();

    const stopSpy = vi.spyOn(entry.indexer!, 'stopGraceful');
    await pool.removeVault(vault1Path);
    expect(stopSpy).toHaveBeenCalled();
  });

  it('removes a vault', async () => {
    const vault1Path = path.join(tempDir, 'vault1');
    await pool.addVault(vault1Path);
    expect(pool.hasVault(vault1Path)).toBe(true);
    const removed = await pool.removeVault(vault1Path);
    expect(removed).toBe(true);
    expect(pool.hasVault(vault1Path)).toBe(false);
  });

  it('returns false when removing non-existent vault', async () => {
    expect(await pool.removeVault('/non/existent')).toBe(false);
  });

  it('throws on getVault for non-existent vault', () => {
    expect(() => pool.getVault('/non/existent')).toThrow();
  });

  it('initializes components', async () => {
    const vault1Path = path.join(tempDir, 'vault1');
    const entry = await pool.addVault(vault1Path);
    expect(entry.indexer).toBeUndefined();
    await pool.initializeComponents(entry);
    expect(entry.indexer).toBeInstanceOf(BackgroundIndexer);
  });
});
