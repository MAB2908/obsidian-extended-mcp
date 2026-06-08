// v0.2b:
// ───────────────────────────────────────────
// Dreaming Log — persist archive operations for undo
// ───────────────────────────────────────────
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import readline from 'readline';
import { FileLock } from '../../shared/FileLock.js';
import { safeJsonParse } from '../../shared/utils.js';
export class DreamLog {
    logPath;
    archiveDir;
    constructor(vaultPath) {
        const cacheDir = path.join(vaultPath, '.mcp-cache');
        this.logPath = path.join(cacheDir, 'dream-log.jsonl');
        this.archiveDir = path.join(cacheDir, 'dream-archive');
    }
    async init() {
        await fs.mkdir(this.archiveDir, { recursive: true });
    }
    async append(entry) {
        const line = JSON.stringify(entry) + '\n';
        await FileLock.withLock(this.logPath, async () => {
            await fs.appendFile(this.logPath, line, 'utf-8');
        });
    }
    async readLastSession(sessionId) {
        const entries = [];
        try {
            await fs.access(this.logPath);
        }
        catch {
            return entries;
        }
        const rl = readline.createInterface({
            input: createReadStream(this.logPath, { encoding: 'utf-8' }),
            crlfDelay: Infinity,
        });
        for await (const line of rl) {
            if (!line.trim())
                continue;
            try {
                const e = safeJsonParse(line);
                if (e.sessionId === sessionId)
                    entries.push(e);
            }
            catch {
                // skip malformed
            }
        }
        return entries;
    }
    getArchivePath(relPath) {
        // Flatten: replace / with __
        const flat = relPath.replace(/[/\\]/g, '__');
        return path.join(this.archiveDir, flat);
    }
    async archive(relPath, content) {
        const dest = this.getArchivePath(relPath);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, content, 'utf-8');
    }
    async restore(relPath) {
        const src = this.getArchivePath(relPath);
        try {
            const content = await fs.readFile(src, 'utf-8');
            const stat = await fs.stat(src);
            return { content, mtime: stat.mtimeMs };
        }
        catch {
            return null;
        }
    }
    async exists(relPath) {
        try {
            await fs.access(this.getArchivePath(relPath));
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=DreamLog.js.map