// v0.2b:
// ───────────────────────────────────────────
// Session Lock Service — prevents concurrent dreaming sessions per vault
// ───────────────────────────────────────────
export class SessionLockService {
    static locks = new Map();
    static DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
    /** Atomic try-acquire: returns true only if lock was newly acquired (C1a) */
    static tryAcquire(vaultPath, sessionId) {
        const now = Date.now();
        const existing = SessionLockService.locks.get(vaultPath);
        if (existing) {
            if (now - existing.acquiredAt < SessionLockService.DEFAULT_TTL_MS) {
                return false; // still held and not stale
            }
            // stale lock — overwrite
        }
        SessionLockService.locks.set(vaultPath, { sessionId, acquiredAt: now });
        return true;
    }
    static acquire(vaultPath, sessionId) {
        return SessionLockService.tryAcquire(vaultPath, sessionId);
    }
    static release(vaultPath, sessionId) {
        const current = SessionLockService.locks.get(vaultPath);
        if (current && current.sessionId === sessionId) {
            SessionLockService.locks.delete(vaultPath);
            return true;
        }
        return false;
    }
    static isLocked(vaultPath) {
        const entry = SessionLockService.locks.get(vaultPath);
        if (!entry)
            return false;
        const now = Date.now();
        if (now - entry.acquiredAt >= SessionLockService.DEFAULT_TTL_MS) {
            // auto-expire stale lock (C1b)
            SessionLockService.locks.delete(vaultPath);
            return false;
        }
        return true;
    }
    static getHolder(vaultPath) {
        const entry = SessionLockService.locks.get(vaultPath);
        if (!entry)
            return undefined;
        const now = Date.now();
        if (now - entry.acquiredAt >= SessionLockService.DEFAULT_TTL_MS) {
            SessionLockService.locks.delete(vaultPath);
            return undefined;
        }
        return entry.sessionId;
    }
    static isStale(vaultPath, timeoutMs = SessionLockService.DEFAULT_TTL_MS) {
        const entry = SessionLockService.locks.get(vaultPath);
        if (!entry)
            return false;
        return Date.now() - entry.acquiredAt >= timeoutMs;
    }
    /** For testing — clear all locks */
    static clear() {
        SessionLockService.locks.clear();
    }
}
//# sourceMappingURL=SessionLockService.js.map