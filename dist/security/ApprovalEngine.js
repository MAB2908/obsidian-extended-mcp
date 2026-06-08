// v0.2b:
import { FolderACL } from './FolderACL.js';
export class ApprovalEngine {
    acl;
    constructor(safeZones) {
        this.acl = new FolderACL({ safeZones });
    }
    /**
     * Determine the exact approval level for a given tool invocation.
     *
     * @param toolName   — canonical tool name (e.g. `write_note`, `cli_eval`)
     * @param args       — tool arguments; used to inspect paths, preview flags, etc.
     * @param safeZones  — optional override for safe-zone prefixes (defaults to `['raw/', 'sessions/']`)
     */
    getApprovalLevel(toolName, args, safeZones) {
        // Level 1 — Read operations
        if (toolName.startsWith('read_') ||
            toolName.startsWith('search_') ||
            toolName.startsWith('list_') ||
            toolName.startsWith('get_')) {
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
        if (toolName.startsWith('write_') ||
            toolName.startsWith('append_') ||
            toolName.startsWith('patch_')) {
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
    requiresConfirmation(level) {
        return level === 3 || level === 4 || level === 7;
    }
    /** Levels that must trigger an automatic backup before execution. */
    requiresBackup(level) {
        return level === 4;
    }
    /** Levels that require the user to have explicitly opted in (e.g. via config). */
    requiresOptIn(level) {
        return level === 5 || level === 6;
    }
    /** Levels that mutate or risk destroying data. */
    isDestructive(level) {
        return level === 4 || level === 5 || level === 6 || level === 7;
    }
    extractPath(args) {
        if (!args)
            return undefined;
        for (const key of ['path', 'from', 'to', 'raw_path', 'file', 'dest', 'notePath', 'destPath']) {
            const value = args[key];
            if (typeof value === 'string' && value.length > 0) {
                return value;
            }
        }
        return undefined;
    }
}
//# sourceMappingURL=ApprovalEngine.js.map