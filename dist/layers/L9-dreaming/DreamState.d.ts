import type { DreamSession } from './types.js';
interface PersistedState {
    version: number;
    updatedAt: string;
    activeSessions: DreamSession[];
}
export declare class DreamState {
    private statePath;
    private lock;
    constructor(vaultPath: string);
    private withLock;
    load(): Promise<PersistedState>;
    /** Atomic write: temp file + rename (C1c) */
    save(state: PersistedState): Promise<void>;
    addSession(session: DreamSession): Promise<void>;
    removeSession(sessionId: string): Promise<void>;
    getSession(sessionId: string): Promise<DreamSession | undefined>;
    private emptyState;
}
export {};
//# sourceMappingURL=DreamState.d.ts.map