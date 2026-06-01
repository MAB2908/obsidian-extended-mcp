// v0.1b:
// ───────────────────────────────────────────
// Session Lock Service — prevents concurrent dreaming sessions per vault
// ───────────────────────────────────────────

interface LockEntry {
  sessionId: string;
  acquiredAt: number;
}

export class SessionLockService {
  private static locks = new Map<string, LockEntry>();
  private static readonly DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /** Atomic try-acquire: returns true only if lock was newly acquired (C1a) */
  static tryAcquire(vaultPath: string, sessionId: string): boolean {
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

  static acquire(vaultPath: string, sessionId: string): boolean {
    return SessionLockService.tryAcquire(vaultPath, sessionId);
  }

  static release(vaultPath: string, sessionId: string): boolean {
    const current = SessionLockService.locks.get(vaultPath);
    if (current && current.sessionId === sessionId) {
      SessionLockService.locks.delete(vaultPath);
      return true;
    }
    return false;
  }

  static isLocked(vaultPath: string): boolean {
    const entry = SessionLockService.locks.get(vaultPath);
    if (!entry) return false;
    const now = Date.now();
    if (now - entry.acquiredAt >= SessionLockService.DEFAULT_TTL_MS) {
      // auto-expire stale lock (C1b)
      SessionLockService.locks.delete(vaultPath);
      return false;
    }
    return true;
  }

  static getHolder(vaultPath: string): string | undefined {
    const entry = SessionLockService.locks.get(vaultPath);
    if (!entry) return undefined;
    const now = Date.now();
    if (now - entry.acquiredAt >= SessionLockService.DEFAULT_TTL_MS) {
      SessionLockService.locks.delete(vaultPath);
      return undefined;
    }
    return entry.sessionId;
  }

  static isStale(vaultPath: string, timeoutMs = SessionLockService.DEFAULT_TTL_MS): boolean {
    const entry = SessionLockService.locks.get(vaultPath);
    if (!entry) return false;
    return Date.now() - entry.acquiredAt >= timeoutMs;
  }

  /** For testing — clear all locks */
  static clear(): void {
    SessionLockService.locks.clear();
  }
}
