// v0.1b:
// ───────────────────────────────────────────
// Dreaming Log — persist archive operations for undo
// ───────────────────────────────────────────

import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import readline from 'readline';
import type { DreamLogEntry } from './types.js';
import { FileLock } from '../../shared/FileLock.js';
import { safeJsonParse } from '../../shared/utils.js';

export class DreamLog {
  private logPath: string;
  private archiveDir: string;

  constructor(vaultPath: string) {
    const cacheDir = path.join(vaultPath, '.mcp-cache');
    this.logPath = path.join(cacheDir, 'dream-log.jsonl');
    this.archiveDir = path.join(cacheDir, 'dream-archive');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.archiveDir, { recursive: true });
  }

  async append(entry: DreamLogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    await FileLock.withLock(this.logPath, async () => {
      await fs.appendFile(this.logPath, line, 'utf-8');
    });
  }

  async readLastSession(sessionId: string): Promise<DreamLogEntry[]> {
    const entries: DreamLogEntry[] = [];
    try {
      await fs.access(this.logPath);
    } catch {
      return entries;
    }

    const rl = readline.createInterface({
      input: createReadStream(this.logPath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const e = safeJsonParse(line) as DreamLogEntry;
        if (e.sessionId === sessionId) entries.push(e);
      } catch {
        // skip malformed
      }
    }
    return entries;
  }

  getArchivePath(relPath: string): string {
    // Flatten: replace / with __
    const flat = relPath.replace(/[/\\]/g, '__');
    return path.join(this.archiveDir, flat);
  }

  async archive(relPath: string, content: string): Promise<void> {
    const dest = this.getArchivePath(relPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content, 'utf-8');
  }

  async restore(relPath: string): Promise<{ content: string; mtime: number } | null> {
    const src = this.getArchivePath(relPath);
    try {
      const content = await fs.readFile(src, 'utf-8');
      const stat = await fs.stat(src);
      return { content, mtime: stat.mtimeMs };
    } catch {
      return null;
    }
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(this.getArchivePath(relPath));
      return true;
    } catch {
      return false;
    }
  }
}
