// v0.2b:
// ───────────────────────────────────────────
// Dream State — persist active sessions to JSON
// ───────────────────────────────────────────
import { promises as fs } from 'fs';
import path from 'path';
import { safeJsonParse } from '../../shared/utils.js';
const STATE_VERSION = 1;
export class DreamState {
    statePath;
    lock = Promise.resolve();
    constructor(vaultPath) {
        const cacheDir = path.join(vaultPath, '.mcp-cache');
        this.statePath = path.join(cacheDir, 'dream-state.json');
    }
    async withLock(fn) {
        const next = this.lock.then(async () => fn());
        this.lock = next.catch(() => { });
        return next;
    }
    async load() {
        try {
            const raw = await fs.readFile(this.statePath, 'utf-8');
            const parsed = safeJsonParse(raw);
            if (parsed.version !== STATE_VERSION) {
                return this.emptyState();
            }
            return parsed;
        }
        catch {
            return this.emptyState();
        }
    }
    /** Atomic write: temp file + rename (C1c) */
    async save(state) {
        state.version = STATE_VERSION;
        state.updatedAt = new Date().toISOString();
        await fs.mkdir(path.dirname(this.statePath), { recursive: true });
        const tempPath = `${this.statePath}.tmp-${Date.now()}`;
        await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
        await fs.rename(tempPath, this.statePath);
    }
    async addSession(session) {
        await this.withLock(async () => {
            const state = await this.load();
            state.activeSessions.push(session);
            await this.save(state);
        });
    }
    async removeSession(sessionId) {
        await this.withLock(async () => {
            const state = await this.load();
            state.activeSessions = state.activeSessions.filter((s) => s.sessionId !== sessionId);
            await this.save(state);
        });
    }
    async getSession(sessionId) {
        return this.withLock(async () => {
            const state = await this.load();
            return state.activeSessions.find((s) => s.sessionId === sessionId);
        });
    }
    emptyState() {
        return { version: STATE_VERSION, updatedAt: new Date().toISOString(), activeSessions: [] };
    }
}
//# sourceMappingURL=DreamState.js.map