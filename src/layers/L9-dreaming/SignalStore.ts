// v0.2b:
// ───────────────────────────────────────────
// Dreaming Signal Store — SQLite sidecar
// ───────────────────────────────────────────

import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs } from 'fs';
import type { DreamSignals } from './types.js';

export class SignalStore {
  private db: Database.Database;
  private readonly tableName = 'dream_signals';

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        path TEXT PRIMARY KEY,
        importance INTEGER NOT NULL DEFAULT 50,
        maturity TEXT NOT NULL DEFAULT 'draft',
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_dream_maturity ON ${this.tableName}(maturity);
      CREATE INDEX IF NOT EXISTS idx_dream_importance ON ${this.tableName}(importance);
    `);
  }

  get(path: string): DreamSignals | undefined {
    const row = this.db
      .prepare(`SELECT importance, maturity, access_count, last_accessed FROM ${this.tableName} WHERE path = ?`)
      .get(path) as
      | { importance: number; maturity: string; access_count: number; last_accessed: number | null }
      | undefined;
    if (!row) return undefined;
    return {
      importance: row.importance,
      maturity: row.maturity as DreamSignals['maturity'],
      accessCount: row.access_count,
      lastAccessed: row.last_accessed ?? undefined,
    };
  }

  set(notePath: string, signals: Partial<DreamSignals>): void {
    const existing = this.get(notePath);
    const merged: DreamSignals = {
      importance: signals.importance ?? existing?.importance ?? 50,
      maturity: signals.maturity ?? existing?.maturity ?? 'draft',
      accessCount: signals.accessCount ?? existing?.accessCount ?? 0,
      lastAccessed: signals.lastAccessed ?? existing?.lastAccessed ?? Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO ${this.tableName} (path, importance, maturity, access_count, last_accessed)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           importance = excluded.importance,
           maturity = excluded.maturity,
           access_count = excluded.access_count,
           last_accessed = excluded.last_accessed`
      )
      .run(notePath, merged.importance, merged.maturity, merged.accessCount, merged.lastAccessed);
  }

  list(): Map<string, DreamSignals> {
    const rows = this.db
      .prepare(`SELECT path, importance, maturity, access_count, last_accessed FROM ${this.tableName}`)
      .all() as Array<{ path: string; importance: number; maturity: string; access_count: number; last_accessed: number | null }>;

    const map = new Map<string, DreamSignals>();
    for (const row of rows) {
      map.set(row.path, {
        importance: row.importance,
        maturity: row.maturity as DreamSignals['maturity'],
        accessCount: row.access_count,
        lastAccessed: row.last_accessed ?? undefined,
      });
    }
    return map;
  }

  incrementAccess(path: string): void {
    const existing = this.get(path);
    if (existing) {
      this.set(path, {
        accessCount: existing.accessCount + 1,
        lastAccessed: Date.now(),
      });
    } else {
      this.set(path, { accessCount: 1, lastAccessed: Date.now() });
    }
  }

  close(): void {
    this.db.close();
  }

  /** Factory: opens or creates signal store for a vault */
  static async forVault(vaultPath: string): Promise<SignalStore> {
    const cacheDir = path.join(vaultPath, '.mcp-cache');
    await fs.mkdir(cacheDir, { recursive: true });
    const dbPath = path.join(cacheDir, 'dream-signals.db');
    return new SignalStore(dbPath);
  }
}
