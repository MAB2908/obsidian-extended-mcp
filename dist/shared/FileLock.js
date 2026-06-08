// v0.2b:
import { lock } from 'proper-lockfile';
import path from 'path';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
export class FileLock {
    static getLockFile(filePath) {
        const dir = path.join(path.dirname(filePath), '.mcp-cache', 'locks');
        mkdirSync(dir, { recursive: true });
        const hash = createHash('sha256').update(filePath).digest('hex').slice(0, 16);
        const lockfile = path.join(dir, `${hash}.lock`);
        if (!existsSync(lockfile)) {
            writeFileSync(lockfile, '');
        }
        return lockfile;
    }
    static async acquire(filePath, opts) {
        const lockfilePath = this.getLockFile(filePath);
        const release = await lock(lockfilePath, {
            retries: opts?.retries ?? 5,
            stale: opts?.stale ?? 5000,
        });
        return release;
    }
    static async withLock(filePath, fn, opts) {
        const release = await FileLock.acquire(filePath, opts);
        try {
            return await fn();
        }
        finally {
            await release();
        }
    }
}
//# sourceMappingURL=FileLock.js.map