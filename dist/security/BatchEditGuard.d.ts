import type { IVaultManager } from '../shared/interfaces/IVaultManager.js';
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
export declare class BatchEditGuard {
    private vaultPath;
    private defaultVaultManager?;
    private pending;
    constructor(vaultPath: string, defaultVaultManager?: IVaultManager | undefined);
    /**
     * Generate a preview of a batch edit without applying it.
     * The preview is stored in memory and can be inspected via `getPendingBatches()`.
     */
    preview(filter: {
        folder?: string;
        glob?: string;
        tag?: string;
    }, operation: string, target: string, replacement?: string): Promise<PreviewResult>;
    /**
     * Apply a batch edit after creating a dedicated batch backup.
     * Backup is written to `.mcp-cache/backups/batch-{timestamp}/` before
     * any file is modified.
     */
    apply(filter: {
        folder?: string;
        glob?: string;
        tag?: string;
    }, operation: string, target: string, replacement?: string, vaultManager?: IVaultManager): Promise<ApplyResult>;
    /**
     * Restore all files from a batch backup directory.
     */
    rollback(backupTimestamp: string, vaultManager?: IVaultManager): Promise<void>;
    /**
     * Return all pending batches created by `preview` calls.
     */
    getPendingBatches(): PendingBatchInfo[];
    private requireVaultManager;
    private collectFilesRecursive;
}
//# sourceMappingURL=BatchEditGuard.d.ts.map