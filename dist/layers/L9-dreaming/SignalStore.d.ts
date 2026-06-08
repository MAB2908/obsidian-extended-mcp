import type { DreamSignals } from './types.js';
export declare class SignalStore {
    private db;
    private readonly tableName;
    constructor(dbPath: string);
    private initSchema;
    get(path: string): DreamSignals | undefined;
    set(notePath: string, signals: Partial<DreamSignals>): void;
    list(): Map<string, DreamSignals>;
    incrementAccess(path: string): void;
    close(): void;
    /** Factory: opens or creates signal store for a vault */
    static forVault(vaultPath: string): Promise<SignalStore>;
}
//# sourceMappingURL=SignalStore.d.ts.map