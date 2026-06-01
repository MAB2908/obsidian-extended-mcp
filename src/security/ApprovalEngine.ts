// v0.1b:
import { FolderACL } from './FolderACL.js';

/**
 * Approval levels as defined in the security model.
 *
 * 1. Read operations        — no approval required
 * 2. Write to safe zones    — no approval required
 * 3. Write to concepts/…    — user confirmation
 * 4. Delete, move, batch    — user confirmation + backup
 * 5. cli_eval (arbitrary JS)— explicit opt-in + sandbox
 * 6. Plugin install/uninstall— explicit opt-in
 * 7. Batch destructive ops  — Preview → Apply
 * 8. Audit / fallback       — everything logged unconditionally
 */
export type ApprovalLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export class ApprovalEngine {
  private readonly acl: FolderACL;

  constructor(safeZones?: string[]) {
    this.acl = new FolderACL({ safeZones });
  }

  /**
   * Determine the exact approval level for a given tool invocation.
   *
   * @param toolName   — canonical tool name (e.g. `write_note`, `cli_eval`)
   * @param args       — tool arguments; used to inspect paths, preview flags, etc.
   * @param safeZones  — optional override for safe-zone prefixes (defaults to `['raw/', 'sessions/']`)
   */
  getApprovalLevel(
    toolName: string,
    args?: Record<string, unknown>,
    safeZones?: string[],
  ): ApprovalLevel {
    // Level 1 — Read operations
    if (
      toolName.startsWith('read_') ||
      toolName.startsWith('search_') ||
      toolName.startsWith('list_') ||
      toolName.startsWith('get_')
    ) {
      return 1;
    }

    // Level 5 — Arbitrary code evaluation
    if (toolName === 'cli_eval') {
      return 5;
    }

    // Level 6 — Plugin install / uninstall
    if (toolName === 'cli_plugin') {
      const action = String(args?.action ?? '').toLowerCase();
      if (action === 'install' || action === 'uninstall') {
        return 6;
      }
      // Level 3 — Plugin enable / disable (mutates vault state)
      if (action === 'enable' || action === 'disable') {
        return 3;
      }
    }

    // Level 4 — Arbitrary CLI command execution
    if (toolName === 'cli_command') {
      return 4;
    }

    // Level 7 (destructive batch) or 4 (standard batch)
    if (toolName === 'batch_edit') {
      if (args?.preview === false) {
        return 7;
      }
      return 4;
    }

    // Level 4 — Delete / move
    if (toolName.startsWith('delete_') || toolName.startsWith('move_')) {
      return 4;
    }

    // Level 2 (safe zone) or 3 (everything else)
    if (
      toolName.startsWith('write_') ||
      toolName.startsWith('append_') ||
      toolName.startsWith('patch_')
    ) {
      const filePath = this.extractPath(args);
      if (filePath) {
        const checker = safeZones ? new FolderACL({ safeZones }) : this.acl;
        if (checker.isSafeZone(filePath)) {
          return 2;
        }
      }
      return 3;
    }

    // Level 8 — Audit / catch-all for unclassified tools
    return 8;
  }

  /** Levels that need an interactive confirmation prompt. */
  requiresConfirmation(level: number): boolean {
    return level === 3 || level === 4 || level === 7;
  }

  /** Levels that must trigger an automatic backup before execution. */
  requiresBackup(level: number): boolean {
    return level === 4;
  }

  /** Levels that require the user to have explicitly opted in (e.g. via config). */
  requiresOptIn(level: number): boolean {
    return level === 5 || level === 6;
  }

  /** Levels that mutate or risk destroying data. */
  isDestructive(level: number): boolean {
    return level === 4 || level === 5 || level === 6 || level === 7;
  }

  private extractPath(args?: Record<string, unknown>): string | undefined {
    if (!args) return undefined;
    for (const key of ['path', 'from', 'to', 'raw_path', 'file', 'dest', 'notePath', 'destPath']) {
      const value = args[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return undefined;
  }
}
