// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { VaultPool } from '../src/layers/L1-filesystem/VaultPool.js';
import { VaultRouter } from '../src/layers/L1-filesystem/VaultRouter.js';
import { BM25Engine } from '../src/layers/L4-semantic/BM25Engine.js';
import { SemanticDatabase } from '../src/layers/L4-semantic/SemanticDatabase.js';

describe('VaultRouter', () => {
  let tempDir: string;
  let pool: VaultPool;
  let router: VaultRouter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-router-test-'));
    await fs.mkdir(path.join(tempDir, 'vault1', 'notes'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'vault1', 'notes', 'a.md'), '# A');
    pool = new VaultPool();
    await pool.addVault(path.join(tempDir, 'vault1'));
    router = new VaultRouter(pool, path.join(tempDir, 'vault1'));
  });

  afterEach(async () => {
    for (const [, entry] of (pool as any).entries) {
      entry.semanticDb.close();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('resolves default vault when no vaultPath provided', () => {
    const ctx = router.resolve({});
    expect(ctx.vaultPath).toBe(path.join(tempDir, 'vault1'));
  });

  it('resolves specified vault by vaultPath', () => {
    const ctx = router.resolve({ vaultPath: path.join(tempDir, 'vault1') });
    expect(ctx.vaultPath).toBe(path.join(tempDir, 'vault1'));
  });

  it('throws on resolve for non-existent vault', () => {
    expect(() => router.resolve({ vaultPath: '/non/existent' })).toThrow();
  });

  it('returns null on resolveOptional for non-existent vault', () => {
    const ctx = router.resolveOptional({ vaultPath: '/non/existent' });
    expect(ctx).toBeNull();
  });

  it('returns context with all components', () => {
    const ctx = router.resolve({});
    expect(ctx.vaultPath).toBe(path.join(tempDir, 'vault1'));
    expect(ctx.vault.root).toBe(path.join(tempDir, 'vault1'));
    expect(ctx.bm25).toBeInstanceOf(BM25Engine);
    expect(ctx.semanticDb).toBeInstanceOf(SemanticDatabase);
  });
});
