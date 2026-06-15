import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { ISemanticDatabase } from '../../shared/interfaces/ISemanticDatabase.js';
import type { IDreamingEngine } from '../../shared/interfaces/IDreamingEngine.js';
import { SignalStore } from './SignalStore.js';
import type { AuditLogger } from '../../security/AuditLogger.js';
import type { DreamScanParams, DreamFinalizeParams, DreamSession, DreamSignals } from './types.js';
export interface DreamingEngineConfig {
    vaultPath: string;
    vault: IVaultManager;
    semanticDb: ISemanticDatabase;
    signals: SignalStore;
    audit?: AuditLogger;
}
export declare class DreamingEngine implements IDreamingEngine {
    private vaultPath;
    private vault;
    private semanticDb;
    private signals;
    private log;
    private loader;
    private state;
    private audit?;
    private activeSessionId?;
    /** Per-vault promise cache to prevent duplicate SignalStore / SQLite opens */
    private static creationPromises;
    constructor(config: DreamingEngineConfig);
    /** Factory: async construction with SignalStore init (race-safe) */
    static create(config: Omit<DreamingEngineConfig, 'signals'>): Promise<DreamingEngine>;
    /** Phase 1: Scan — deterministic analysis, no mutations */
    scan(params: DreamScanParams): Promise<DreamSession>;
    /** Phase 3: Finalize — archive loser paths, log for undo */
    finalize(params: DreamFinalizeParams): Promise<{
        archived: string[];
    }>;
    /** Undo the last finalized session */
    undo(sessionId: string): Promise<{
        restored: string[];
    }>;
    /** Access a note — updates signal store */
    touch(relPath: string): Promise<void>;
    /** Set explicit signals for a note */
    setSignals(relPath: string, signals: Partial<DreamSignals>): Promise<void>;
    /** Structured log op: CONSOLIDATE — merge source into target and remove source */
    consolidate(sessionId: string, sourcePath: string, targetPath: string): Promise<{
        consolidated: boolean;
    }>;
    /** Structured log op: SYNTHESIZE — create a new overview note for a domain */
    synthesize(sessionId: string, domain: string, proposedTitle: string, paths: string[]): Promise<{
        createdPath?: string;
    }>;
    /** Structured log op: PRUNE — archive and delete low-value notes */
    prune(sessionId: string, paths: string[]): Promise<{
        pruned: string[];
    }>;
    close(): void;
}
//# sourceMappingURL=DreamingEngine.d.ts.map