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
export declare class ApprovalEngine {
    private readonly acl;
    constructor(safeZones?: string[]);
    /**
     * Determine the exact approval level for a given tool invocation.
     *
     * @param toolName   — canonical tool name (e.g. `write_note`, `cli_eval`)
     * @param args       — tool arguments; used to inspect paths, preview flags, etc.
     * @param safeZones  — optional override for safe-zone prefixes (defaults to `['raw/', 'sessions/']`)
     */
    getApprovalLevel(toolName: string, args?: Record<string, unknown>, safeZones?: string[]): ApprovalLevel;
    /** Levels that need an interactive confirmation prompt. */
    requiresConfirmation(level: number): boolean;
    /** Levels that must trigger an automatic backup before execution. */
    requiresBackup(level: number): boolean;
    /** Levels that require the user to have explicitly opted in (e.g. via config). */
    requiresOptIn(level: number): boolean;
    /** Levels that mutate or risk destroying data. */
    isDestructive(level: number): boolean;
    private extractPath;
}
//# sourceMappingURL=ApprovalEngine.d.ts.map