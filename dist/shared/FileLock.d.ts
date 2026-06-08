export interface LockOptions {
    retries?: number;
    stale?: number;
}
export declare class FileLock {
    private static getLockFile;
    static acquire(filePath: string, opts?: LockOptions): Promise<() => Promise<void>>;
    static withLock<T>(filePath: string, fn: () => Promise<T>, opts?: LockOptions): Promise<T>;
}
//# sourceMappingURL=FileLock.d.ts.map