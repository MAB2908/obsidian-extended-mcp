export declare class SessionLockService {
    private static locks;
    private static readonly DEFAULT_TTL_MS;
    /** Atomic try-acquire: returns true only if lock was newly acquired (C1a) */
    static tryAcquire(vaultPath: string, sessionId: string): boolean;
    static acquire(vaultPath: string, sessionId: string): boolean;
    static release(vaultPath: string, sessionId: string): boolean;
    static isLocked(vaultPath: string): boolean;
    static getHolder(vaultPath: string): string | undefined;
    static isStale(vaultPath: string, timeoutMs?: number): boolean;
    /** For testing — clear all locks */
    static clear(): void;
}
//# sourceMappingURL=SessionLockService.d.ts.map