// v0.1b:
import { promises as fs, constants } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import type { IVaultManager } from '../shared/interfaces/IVaultManager.js';
import { AclDeniedError } from '../shared/errors.js';
import { safeJsonParse } from '../shared/utils.js';

interface BackupMeta {
  timestamp: string;
  files: Record<string, { checksum: string; mtimeMs: number }>;
}

export interface BatchPreviewItem {
  path: string;
  before: string;
  after: string;
}

export interface PreviewResult {
  previews: BatchPreviewItem[];
  count: number;
}

export interface ApplyResult {
  modified: number;
  backupTimestamp: string;
}

export interface PendingBatchInfo {
  timestamp: string;
  count: number;
  paths: string[];
}

type BatchOperation = 'replace' | 'prepend' | 'append' | 'rename_tag';

const VALID_OPERATIONS: readonly string[] = ['replace', 'prepend', 'append', 'rename_tag'];

function assertValidOperation(op: string): asserts op is BatchOperation {
  if (!VALID_OPERATIONS.includes(op)) {
    throw new Error(`Invalid batch operation: ${op}. Expected one of: ${VALID_OPERATIONS.join(', ')}`);
  }
}

/**
 * Two-phase guard for batch edit operations.
 *
 * Phase 1 — `preview`: generates a list of affected files and their before/after
 *            content without mutating the vault. The preview is stored in memory
 *            as a "pending batch".
 *
 * Phase 2 — `apply`: creates a dedicated batch backup under
 *            `.mcp-cache/backups/batch-{timestamp}/`, then applies the changes
 *            via the VaultManager.
 *
 * `rollback` restores all files from a previously created batch backup.
 */
export class BatchEditGuard {
  private pending = new Map<string, { timestamp: string; previews: BatchPreviewItem[]; paths: string[] }>();

  constructor(
    private vaultPath: string,
    private defaultVaultManager?: IVaultManager,
  ) {}

  /**
   * Generate a preview of a batch edit without applying it.
   * The preview is stored in memory and can be inspected via `getPendingBatches()`.
   */
  async preview(
    filter: { folder?: string; glob?: string; tag?: string },
    operation: string,
    target: string,
    replacement?: string,
  ): Promise<PreviewResult> {
    const vm = this.requireVaultManager();
    assertValidOperation(operation);

    const result = await vm.batchEdit(filter, operation, target, replacement, true);
    const timestamp = Date.now().toString();
    const previews = result.previews ?? [];

    this.pending.set(timestamp, {
      timestamp,
      previews,
      paths: result.paths,
    });

    return { previews, count: previews.length };
  }

  /**
   * Apply a batch edit after creating a dedicated batch backup.
   * Backup is written to `.mcp-cache/backups/batch-{timestamp}/` before
   * any file is modified.
   */
  async apply(
    filter: { folder?: string; glob?: string; tag?: string },
    operation: string,
    target: string,
    replacement?: string,
    vaultManager?: IVaultManager,
  ): Promise<ApplyResult> {
    const vm = vaultManager ?? this.defaultVaultManager;
    if (!vm) {
      throw new Error('BatchEditGuard.apply requires a VaultManager');
    }
    assertValidOperation(operation);

    const timestamp = Date.now().toString();
    const backupDir = path.join(this.vaultPath, '.mcp-cache', 'backups', `batch-${timestamp}`);

    // Determine affected files first (preview mode) so we know what to back up.
    const previewResult = await vm.batchEdit(filter, operation, target, replacement, true);

    if (previewResult.paths.length > 0) {
      // 1. Create backup FIRST
      await fs.mkdir(backupDir, { recursive: true });
      for (const relPath of previewResult.paths) {
        const src = path.join(this.vaultPath, relPath);
        const dest = path.join(backupDir, relPath);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
      }
    }

    // 2. Apply actual changes
    const applyResult = await vm.batchEdit(filter, operation, target, replacement, false);

    // 3. Capture post-apply checksums for rollback guard (C4)
    const meta: BackupMeta = { timestamp, files: {} };
    if (previewResult.paths.length > 0) {
      for (const relPath of previewResult.paths) {
        const src = path.join(this.vaultPath, relPath);
        try {
          const stat = await fs.stat(src);
          const data = await fs.readFile(src, 'utf-8');
          meta.files[relPath] = {
            checksum: createHash('sha256').update(data).digest('hex'),
            mtimeMs: stat.mtimeMs,
          };
        } catch {
          // file may have been deleted during apply — skip checksum tracking
        }
      }
      await fs.writeFile(path.join(backupDir, 'batch-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
    }

    return { modified: applyResult.modified, backupTimestamp: timestamp };
  }

  /**
   * Restore all files from a batch backup directory.
   */
  async rollback(backupTimestamp: string, vaultManager?: IVaultManager): Promise<void> {
    if (!/^\d+$/.test(backupTimestamp)) {
      throw new Error('Invalid backup timestamp');
    }
    const vm = vaultManager ?? this.defaultVaultManager;
    const backupDir = path.join(this.vaultPath, '.mcp-cache', 'backups', `batch-${backupTimestamp}`);

    try {
      await fs.access(backupDir, constants.R_OK);
    } catch {
      throw new Error(`Batch backup not found: ${backupTimestamp}`);
    }

    // Load metadata for checksum guard (C4)
    let meta: BackupMeta | undefined;
    try {
      const metaRaw = await fs.readFile(path.join(backupDir, 'batch-meta.json'), 'utf-8');
      meta = safeJsonParse(metaRaw) as BackupMeta;
    } catch {
      // no metadata — proceed with blind rollback (backward compat)
    }

    const files = await this.collectFilesRecursive(backupDir, '');
    for (const absPath of files) {
      const relPath = path.relative(backupDir, absPath).replace(/\\/g, '/');
      if (relPath === 'batch-meta.json') continue;
      if (vm && !vm.isWriteAllowed(relPath)) {
        throw new AclDeniedError(relPath, 'write');
      }
      const dest = path.join(this.vaultPath, relPath);

      // C4: verify current file matches expected state from apply()
      if (meta && meta.files[relPath]) {
        try {
          const currentData = await fs.readFile(dest, 'utf-8');
          const currentChecksum = createHash('sha256').update(currentData).digest('hex');
          if (currentChecksum !== meta.files[relPath].checksum) {
            throw new Error(
              `Rollback refused for ${relPath}: file was modified after apply (checksum mismatch)`
            );
          }
        } catch (err) {
          if ((err as Error).message.includes('Rollback refused')) throw err;
          // If file is missing, allow rollback (it was deleted)
        }
      }

      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(absPath, dest);
    }
  }

  /**
   * Return all pending batches created by `preview` calls.
   */
  getPendingBatches(): PendingBatchInfo[] {
    return Array.from(this.pending.values()).map((b) => ({
      timestamp: b.timestamp,
      count: b.previews.length,
      paths: b.paths,
    }));
  }

  private requireVaultManager(): IVaultManager {
    if (!this.defaultVaultManager) {
      throw new Error('BatchEditGuard requires a VaultManager');
    }
    return this.defaultVaultManager;
  }

  private async collectFilesRecursive(dir: string, prefix: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        results.push(...(await this.collectFilesRecursive(path.join(dir, e.name), rel)));
      } else {
        results.push(path.join(dir, e.name));
      }
    }
    return results;
  }
}
