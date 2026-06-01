// v0.1b:
// ───────────────────────────────────────────
// Dream State — persist active sessions to JSON
// ───────────────────────────────────────────

import { promises as fs } from 'fs';
import path from 'path';
import type { DreamSession } from './types.js';
import { safeJsonParse } from '../../shared/utils.js';

interface PersistedState {
  version: number;
  updatedAt: string;
  activeSessions: DreamSession[];
}

const STATE_VERSION = 1;

export class DreamState {
  private statePath: string;
  private lock: Promise<unknown> = Promise.resolve();

  constructor(vaultPath: string) {
    const cacheDir = path.join(vaultPath, '.mcp-cache');
    this.statePath = path.join(cacheDir, 'dream-state.json');
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.lock.then(async () => fn());
    this.lock = next.catch(() => {});
    return next;
  }

  async load(): Promise<PersistedState> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      const parsed = safeJsonParse(raw) as PersistedState;
      if (parsed.version !== STATE_VERSION) {
        return this.emptyState();
      }
      return parsed;
    } catch {
      return this.emptyState();
    }
  }

  /** Atomic write: temp file + rename (C1c) */
  async save(state: PersistedState): Promise<void> {
    state.version = STATE_VERSION;
    state.updatedAt = new Date().toISOString();
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    const tempPath = `${this.statePath}.tmp-${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tempPath, this.statePath);
  }

  async addSession(session: DreamSession): Promise<void> {
    await this.withLock(async () => {
      const state = await this.load();
      state.activeSessions.push(session);
      await this.save(state);
    });
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.withLock(async () => {
      const state = await this.load();
      state.activeSessions = state.activeSessions.filter((s) => s.sessionId !== sessionId);
      await this.save(state);
    });
  }

  async getSession(sessionId: string): Promise<DreamSession | undefined> {
    return this.withLock(async () => {
      const state = await this.load();
      return state.activeSessions.find((s) => s.sessionId === sessionId);
    });
  }

  private emptyState(): PersistedState {
    return { version: STATE_VERSION, updatedAt: new Date().toISOString(), activeSessions: [] };
  }
}
