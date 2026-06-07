// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { BatchEditGuard } from '../../src/security/BatchEditGuard.js';
import { VaultManager } from '../../src/layers/L1-filesystem/VaultManager.js';
import { FolderACL } from '../../src/security/FolderACL.js';
import { AclDeniedError } from '../../src/shared/errors.js';

describe('BatchEditGuard ACL', () => {
  let tempDir: string;
  let guard: BatchEditGuard;
  let vm: VaultManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-acl-test-'));
    await fs.mkdir(path.join(tempDir, 'safe'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.obsidian'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'safe', 'a.md'), '# A');

    const acl = new FolderACL({ forbiddenPaths: ['.obsidian/', '.git/', '.trash/'] });
    vm = new VaultManager(tempDir, acl);
    guard = new BatchEditGuard(tempDir, vm);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('throws AclDeniedError when rollback targets forbidden path', async () => {
    // Create a fake backup with file in forbidden zone
    const timestamp = Date.now().toString();
    const backupDir = path.join(tempDir, '.mcp-cache', 'backups', `batch-${timestamp}`);
    await fs.mkdir(path.join(backupDir, '.obsidian'), { recursive: true });
    await fs.writeFile(path.join(backupDir, '.obsidian', 'config'), '{}');

    await expect(guard.rollback(timestamp, vm)).rejects.toThrow(AclDeniedError);
  });

  describe('C4 — checksum guard', () => {
    it('rollback succeeds when file is unchanged', async () => {
      await fs.writeFile(path.join(tempDir, 'safe', 'b.md'), 'original content');
      const result = await guard.apply({ folder: 'safe' }, 'replace', 'original', 'modified');
      expect(result.modified).toBeGreaterThan(0);

      // Rollback without changes
      await guard.rollback(result.backupTimestamp, vm);
      const restored = await fs.readFile(path.join(tempDir, 'safe', 'b.md'), 'utf-8');
      expect(restored).toBe('original content');
    });

    it('rollback refuses when file was modified after apply', async () => {
      await fs.writeFile(path.join(tempDir, 'safe', 'c.md'), 'original content');
      const result = await guard.apply({ folder: 'safe' }, 'replace', 'original', 'modified');
      expect(result.modified).toBeGreaterThan(0);

      // Simulate external modification
      await fs.writeFile(path.join(tempDir, 'safe', 'c.md'), 'tampered content');

      await expect(guard.rollback(result.backupTimestamp, vm)).rejects.toThrow('Rollback refused');
    });

    it('rollback allows when file was deleted after apply', async () => {
      await fs.writeFile(path.join(tempDir, 'safe', 'd.md'), 'original content');
      const result = await guard.apply({ folder: 'safe' }, 'replace', 'original', 'modified');
      expect(result.modified).toBeGreaterThan(0);

      // Delete file
      await fs.unlink(path.join(tempDir, 'safe', 'd.md'));

      // Should succeed because missing file is treated as acceptable for rollback
      await guard.rollback(result.backupTimestamp, vm);
      const restored = await fs.readFile(path.join(tempDir, 'safe', 'd.md'), 'utf-8');
      expect(restored).toBe('original content');
    });
  });
});
