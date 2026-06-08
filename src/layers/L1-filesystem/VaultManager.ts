// v0.2b:
import { promises as fs, constants } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import matter from 'gray-matter';
import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { Note, ReadNoteOptions, WriteNoteOptions, DeleteOptions, SearchResult, SearchOptions } from '../../shared/types.js';
import { FileSystemError, FileLockedError, FileNotFoundError, FileExistsError, UnknownOperationError, ReadFailedError, NoBackupError, WriteFailedError, AclDeniedError, PermissionDeniedError, PathSecurityError, OntologyViolationError, validatePath, tokenize } from '../../shared/index.js';
import { fsConfig } from '../../shared/config.js';
import { FolderACL } from '../../security/FolderACL.js';
import { TagEngine, type ValidationResult } from '../../shared/TagEngine.js';
import { FileLock } from '../../shared/FileLock.js';

interface CachedStats {
  stats: { totalNotes: number; totalFolders: number; totalTags: number; totalLinks: number };
  tags: Record<string, number>;
}

export class VaultManager implements IVaultManager {
  private vaultPath: string;
  private acl: FolderACL;
  private tagEngine: TagEngine;
  private enforceOntology: boolean;
  private cache: CachedStats | null = null;
  private cacheGeneration = 0;

  constructor(vaultPath: string, acl?: FolderACL, tagEngine?: TagEngine, enforceOntology = false) {
    this.vaultPath = path.resolve(vaultPath);
    this.acl = acl || new FolderACL();
    this.tagEngine = tagEngine || new TagEngine();
    this.enforceOntology = enforceOntology;
  }

  get root(): string {
    return this.vaultPath;
  }

  isWriteAllowed(relPath: string): boolean {
    return this.acl.isWriteAllowed(relPath);
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheGeneration++;
  }

  private async yieldEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  private async resolve(rel: string): Promise<string> {
    const safe = await validatePath(this.vaultPath, rel);
    const full = path.resolve(path.join(this.vaultPath, safe));
    const resolvedVault = path.resolve(this.vaultPath);
    const sep = path.sep;
    if (!full.startsWith(resolvedVault + sep) && full !== resolvedVault) {
      throw new PathSecurityError(rel);
    }
    return full;
  }

  /** Public accessor for resolving vault-relative paths (used by index.ts file router) */
  async resolvePath(rel: string): Promise<string> {
    return this.resolve(rel);
  }

  async readRawContent(relPath: string): Promise<string> {
    const full = await this.resolve(relPath);
    return this.readFileSafe(full);
  }

  async readNote(relPath: string, opts?: ReadNoteOptions): Promise<Note> {
    const raw = await this.readRawContent(relPath);
    const parsed = matter(raw);
    const content = parsed.content;
    const title = (parsed.data.title as string) || path.basename(relPath, '.md');
    const tags: string[] = Array.isArray(parsed.data.tags)
      ? parsed.data.tags
          .map((t: unknown) => (typeof t === 'string' ? t : t && typeof t === 'object' && 'name' in t ? String((t as { name: unknown }).name) : ''))
          .filter((t): t is string => t !== '')
      : [];
    const outboundLinks = this.extractWikilinks(content);

    return {
      path: relPath,
      content: opts?.includeContent === false ? '' : content,
      frontmatter: opts?.includeFrontmatter === false ? {} : parsed.data,
      title,
      tags,
      outboundLinks,
      inboundLinks: [],
      created: parsed.data.created ? new Date(parsed.data.created) : undefined,
      modified: parsed.data.modified ? new Date(parsed.data.modified) : undefined,
    };
  }

  private checkSize(content: string): void {
    const size = Buffer.byteLength(content, 'utf-8');
    if (size > fsConfig.maxNoteSize) {
      throw new FileSystemError('FILE_TOO_LARGE', `Content exceeds maximum size of ${fsConfig.maxNoteSize} bytes (${size} bytes)`);
    }
  }

  async writeNote(relPath: string, content: string, opts?: WriteNoteOptions): Promise<void> {
    if (!this.acl.isWriteAllowed(relPath)) {
      throw new AclDeniedError(relPath, 'write');
    }
    this.checkSize(content);
    if (this.enforceOntology) {
      await this.checkOntology(relPath, content, opts?.frontmatter);
    }
    const full = await this.resolve(relPath);
    const dir = path.dirname(full);
    await fs.mkdir(dir, { recursive: true });

    if (opts?.frontmatter && Object.keys(opts.frontmatter).length > 0) {
      const front = matter.stringify(content, opts.frontmatter);
      await this.atomicWrite(full, front, 3, opts?.overwrite);
    } else {
      await this.atomicWrite(full, content, 3, opts?.overwrite);
    }
    this.invalidateCache();
  }

  async appendNote(relPath: string, content: string): Promise<void> {
    if (!this.acl.isWriteAllowed(relPath)) {
      throw new AclDeniedError(relPath, 'write');
    }
    const full = await this.resolve(relPath);
    await FileLock.withLock(full, async () => {
      let existing = '';
      try {
        existing = await fs.readFile(full, 'utf-8');
      } catch (e: unknown) {
        const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
        if (code !== 'ENOENT') throw e;
        // ENOENT = file doesn't exist yet, start from empty
      }
      const combined = existing + content;
      this.checkSize(combined);
      const tmpPath = `${full}.tmp.${randomBytes(4).toString('hex')}`;
      try {
        await fs.writeFile(tmpPath, combined, { flag: 'wx' });
        try {
          await fs.rename(tmpPath, full);
        } catch (renameErr: unknown) {
          const rCode = renameErr && typeof renameErr === 'object' && 'code' in renameErr ? (renameErr as { code: string }).code : '';
          if (rCode === 'EPERM' || rCode === 'EBUSY') {
            await fs.copyFile(tmpPath, full);
            await fs.unlink(tmpPath).catch(() => {});
          } else {
            throw renameErr;
          }
        }
      } catch (e) {
        try { await fs.unlink(tmpPath); } catch { /* ignore */ }
        throw e;
      }
    });
    this.invalidateCache();
  }

  async patchNote(relPath: string, target: string, operation: 'replace' | 'append' | 'prepend' | 'delete', replacement?: string): Promise<void> {
    if (!this.acl.isWriteAllowed(relPath)) {
      throw new AclDeniedError(relPath, 'write');
    }
    if (!target) {
      throw new FileSystemError('PATCH_TARGET_EMPTY', 'patch target cannot be empty');
    }
    const full = await this.resolve(relPath);
    const existing = await this.readFileSafe(full);
    let updated: string;

    switch (operation) {
      case 'replace':
        updated = existing.split(target).join(replacement ?? '');
        break;
      case 'append':
        updated = existing + (replacement ?? '');
        break;
      case 'prepend':
        updated = (replacement ?? '') + existing;
        break;
      case 'delete':
        updated = existing.split(target).join('');
        break;
      default:
        throw new UnknownOperationError(operation);
    }

    this.checkSize(updated);
    await this.atomicWrite(full, updated);
    this.invalidateCache();
  }

  async deleteNote(relPath: string, opts?: DeleteOptions): Promise<void> {
    if (!this.acl.isWriteAllowed(relPath)) {
      throw new AclDeniedError(relPath, 'delete');
    }
    const full = await this.resolve(relPath);
    // Auto-backup before destructive operation
    await this.createBackup(full);
    await this.pruneBackups(fsConfig.maxBackups);
    if (opts?.soft) {
      const trashDir = path.join(this.vaultPath, fsConfig.trashDir);
      await fs.mkdir(trashDir, { recursive: true });
      const dest = path.join(trashDir, path.basename(relPath));
      await fs.rename(full, dest);
    } else {
      await fs.unlink(full);
    }
    this.invalidateCache();
  }

  async moveNote(fromRel: string, toRel: string): Promise<void> {
    if (!this.acl.isWriteAllowed(fromRel) || !this.acl.isWriteAllowed(toRel)) {
      throw new AclDeniedError(`${fromRel} → ${toRel}`, 'move');
    }
    const fromFull = await this.resolve(fromRel);
    const toFull = await this.resolve(toRel);
    // Auto-backup source before destructive operation
    await this.createBackup(fromFull);
    // Backup destination if it exists (HIGH-008)
    let destBackupPath: string | undefined;
    try {
      await fs.access(toFull, constants.F_OK);
      destBackupPath = await this.createBackup(toFull);
    } catch { /* destination doesn't exist, no backup needed */ }
    if (destBackupPath) {
      await this.pruneBackups(fsConfig.maxBackups);
    }
    const dir = path.dirname(toFull);
    await fs.mkdir(dir, { recursive: true });
    await fs.rename(fromFull, toFull);
    this.invalidateCache();
  }

  async listDirectory(relDir: string = ''): Promise<{ name: string; isDirectory: boolean }[]> {
    const full = await this.resolve(relDir || '.');
    const entries = await fs.readdir(full, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  }

  async listNotes(relDir: string = ''): Promise<string[]> {
    return this.collectMarkdownFiles(relDir);
  }

  async searchNotes(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    const folder = opts?.folder ?? '';
    const limit = opts?.limit ?? 50;
    const all = await this.collectMarkdownFiles(folder);
    const qTokens = tokenize(query);
    const results: SearchResult[] = [];

    for (let i = 0; i < all.length; i++) {
      if (i % 50 === 0 && i > 0) await this.yieldEventLoop();
      const relPath = all[i];
      try {
        const raw = await this.readRawContent(relPath);
        const text = raw.toLowerCase();
        let matches = 0;
        for (const t of qTokens) {
          if (text.includes(t)) matches++;
        }
        if (matches === 0) continue;
        const score = matches / qTokens.length;
        const idx = text.indexOf(qTokens[0]);
        const snippet = raw.slice(Math.max(0, idx - 60), idx + 120);
        results.push({ path: relPath, score, snippet, highlights: qTokens });
      } catch {
        // ignore unreadable
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async getVaultStats(): Promise<{ totalNotes: number; totalFolders: number; totalTags: number; totalLinks: number }> {
    if (this.cache) return this.cache.stats;
    const startGen = this.cacheGeneration;
    const files = await this.collectMarkdownFiles('');
    const folders = new Set<string>();
    let totalTags = 0;
    let totalLinks = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (i % 50 === 0 && i > 0) await this.yieldEventLoop();
      let dir = path.dirname(f);
      while (dir !== '.') {
        folders.add(dir);
        dir = path.dirname(dir);
      }
      try {
        const note = await this.readNote(f, { includeContent: false });
        totalTags += note.tags.length;
        totalLinks += note.outboundLinks.length;
      } catch {
        // ignore
      }
    }

    const stats = { totalNotes: files.length, totalFolders: folders.size, totalTags, totalLinks };
    if (this.cacheGeneration === startGen) {
      if (!this.cache) this.cache = { stats, tags: {} };
      this.cache.stats = stats;
    }
    return stats;
  }

  async listAllTags(): Promise<Record<string, number>> {
    if (this.cache && Object.keys(this.cache.tags).length > 0) return this.cache.tags;
    const startGen = this.cacheGeneration;
    const files = await this.collectMarkdownFiles('');
    const counts: Record<string, number> = {};
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (i % 50 === 0 && i > 0) await this.yieldEventLoop();
      try {
        const note = await this.readNote(f, { includeContent: false });
        for (const tag of note.tags) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      } catch {
        // ignore
      }
    }
    if (this.cacheGeneration === startGen) {
      if (!this.cache) this.cache = { stats: { totalNotes: 0, totalFolders: 0, totalTags: 0, totalLinks: 0 }, tags: counts };
      this.cache.tags = counts;
    }
    return counts;
  }

  // Internal helpers

  private async readFileSafe(fullPath: string): Promise<string> {
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e) {
        const code = (e as { code: string }).code;
        if (code === 'ENOENT') throw new FileNotFoundError(fullPath);
        if (code === 'EACCES') throw new PermissionDeniedError(fullPath);
        if (code === 'EBUSY') throw new FileLockedError(fullPath);
      }
      throw new ReadFailedError(fullPath);
    }
  }

  private async atomicWrite(fullPath: string, content: string, retries = 3, overwrite = true): Promise<void> {
    await FileLock.withLock(fullPath, async () => {
      for (let i = 0; i < retries; i++) {
        const tmpPath = `${fullPath}.tmp.${randomBytes(4).toString('hex')}`;
        try {
          if (!overwrite) {
            try {
              await fs.access(fullPath, constants.F_OK);
              throw new FileExistsError(path.relative(this.vaultPath, fullPath));
            } catch (e: unknown) {
              if (e instanceof FileExistsError) throw e;
              const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
              if (code !== 'ENOENT') throw e; // Re-throw permission errors (VM-003)
            }
          }
          let backupPath: string | undefined;
          try {
            await fs.access(fullPath, constants.F_OK);
            backupPath = await this.createBackup(fullPath);
          } catch (e: unknown) {
            const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
            if (code === 'EACCES' || code === 'EBUSY') {
              throw new FileLockedError(fullPath);
            }
            // ENOENT = no existing file, proceed
          }
          await fs.writeFile(tmpPath, content, { flag: 'wx' });
          if (!overwrite) {
            try {
              await fs.copyFile(tmpPath, fullPath, constants.COPYFILE_EXCL);
            } catch (e: unknown) {
              const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
              if (code === 'EEXIST') {
                throw new FileExistsError(path.relative(this.vaultPath, fullPath));
              }
              throw e;
            } finally {
              await fs.unlink(tmpPath).catch(() => {});
            }
          } else {
            try {
              await fs.rename(tmpPath, fullPath);
            } catch (renameErr: unknown) {
              const rCode = renameErr && typeof renameErr === 'object' && 'code' in renameErr ? (renameErr as { code: string }).code : '';
              if (rCode === 'EPERM' || rCode === 'EBUSY') {
                await fs.copyFile(tmpPath, fullPath);
                await fs.unlink(tmpPath).catch(() => {});
              } else {
                throw renameErr;
              }
            }
          }
          if (backupPath) {
            await this.pruneBackups(fsConfig.maxBackups);
          }
          return;
        } catch (e: unknown) {
          try { await fs.unlink(tmpPath); } catch { /* ignore cleanup error */ }
          if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'EBUSY') {
            await new Promise((r) => setTimeout(r, 100 * (i + 1) + Math.random() * 50));
            continue;
          }
          throw e;
        }
      }
      throw new WriteFailedError(fullPath, retries);
    });
  }

  async createBackup(fullPath: string): Promise<string> {
    const relPath = path.relative(this.vaultPath, fullPath);
    const backupDir = path.join(this.vaultPath, fsConfig.backupDir, relPath);
    const backupPath = path.join(backupDir, `${Date.now()}.md`);
    await fs.mkdir(backupDir, { recursive: true });
    await fs.copyFile(fullPath, backupPath);
    return backupPath;
  }

  private async pruneBackups(maxCount: number): Promise<void> {
    const backupsDir = path.join(this.vaultPath, fsConfig.backupDir);
    try {
      const entries = await fs.readdir(backupsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const fileBackupDir = path.join(backupsDir, entry.name);
        const backups = await this.collectBackupFiles(fileBackupDir);
        if (backups.length > maxCount) {
          backups.sort((a, b) => b.time - a.time);
          for (const b of backups.slice(maxCount)) {
            await fs.unlink(b.path);
          }
          // Clean up empty directory
          try {
            const remaining = await fs.readdir(fileBackupDir);
            if (remaining.length === 0) {
              await fs.rmdir(fileBackupDir);
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      // no backups yet
    }
  }

  async listBackups(): Promise<Array<{ timestamp: string; path: string; relPath: string }>> {
    const backupsDir = path.join(this.vaultPath, fsConfig.backupDir);
    const results: Array<{ timestamp: string; path: string; relPath: string }> = [];
    try {
      const files = await this.collectBackupFiles(backupsDir);
      for (const f of files) {
        results.push({ timestamp: String(f.time), path: f.path, relPath: f.relPath });
      }
    } catch {
      // no backups
    }
    return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private async collectBackupFiles(dir: string): Promise<Array<{ path: string; time: number; relPath: string }>> {
    const results: Array<{ path: string; time: number; relPath: string }> = [];
    const walk = async (currentDir: string, prefix: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(currentDir, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) {
          await walk(full, prefix ? `${prefix}/${e.name}` : e.name);
        } else if (e.name.endsWith('.md')) {
          const time = parseInt(e.name.replace('.md', ''), 10);
          if (!isNaN(time)) {
            results.push({ path: full, time, relPath: prefix || e.name });
          }
        }
      }
    };
    try {
      await walk(dir, '');
    } catch {
      // directory may not exist
    }
    return results;
  }

  async rollback(relPath: string, timestamp?: string): Promise<void> {
    if (!this.acl.isWriteAllowed(relPath)) {
      throw new AclDeniedError(relPath, 'write');
    }
    const backupsDir = path.join(this.vaultPath, fsConfig.backupDir);
    const fileBackupDir = path.join(backupsDir, relPath);
    if (timestamp) {
      // CRIT-001 fix: sanitize timestamp and enforce path containment
      if (!/^\d+$/.test(timestamp)) {
        throw new Error('Invalid backup timestamp');
      }
      const backupPath = path.join(fileBackupDir, `${timestamp}.md`);
      const resolvedBackup = path.resolve(backupPath);
      const resolvedBackupsDir = path.resolve(backupsDir);
      if (!resolvedBackup.startsWith(resolvedBackupsDir + path.sep) && resolvedBackup !== resolvedBackupsDir) {
        throw new Error('Backup path escapes backups directory');
      }
      await fs.copyFile(backupPath, await this.resolve(relPath));
      this.invalidateCache();
      return;
    }
    // Find most recent backup for this file
    const backups = await this.collectBackupFiles(fileBackupDir);
    const match = backups.sort((a, b) => b.time - a.time)[0];
    if (!match) {
      throw new NoBackupError(relPath);
    }
    await fs.copyFile(match.path, await this.resolve(relPath));
    this.invalidateCache();
  }

  private extractWikilinks(content: string): string[] {
    const links: string[] = [];
    const regex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      links.push(m[1].trim());
    }
    return [...new Set(links)];
  }

  private async collectMarkdownFiles(relDir: string): Promise<string[]> {
    const full = await this.resolve(relDir || '.');
    const results: string[] = [];
    const walk = async (dir: string, prefix: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) {
          await walk(path.join(dir, e.name), rel);
        } else if (e.name.endsWith('.md')) {
          results.push(rel);
        }
      }
    };
    await walk(full, relDir);
    return results;
  }

  async manageTags(relPath: string, action: 'add' | 'remove' | 'set', tags: string[]): Promise<void> {
    if (!this.acl.isWriteAllowed(relPath)) {
      throw new AclDeniedError(relPath, 'write');
    }
    const note = await this.readNote(relPath, { includeContent: true });
    let newTags: string[];
    switch (action) {
      case 'add':
        newTags = this.tagEngine.addTags(note.tags, tags);
        break;
      case 'remove':
        newTags = this.tagEngine.removeTags(note.tags, tags);
        break;
      case 'set':
        newTags = this.tagEngine.setTags(note.tags, tags);
        break;
      default:
        throw new UnknownOperationError(action);
    }
    const updatedFrontmatter = { ...note.frontmatter, tags: newTags };
    await this.writeNote(relPath, note.content, { frontmatter: updatedFrontmatter, overwrite: true });
    this.invalidateCache();
  }

  async validateNote(relPath: string): Promise<ValidationResult> {
    const note = await this.readNote(relPath, { includeContent: true });
    const inlineTags = this.extractInlineTags(note.content);
    return this.tagEngine.validateNote(relPath, note.tags, inlineTags);
  }

  private extractInlineTags(content: string): string[] {
    const tags: string[] = [];
    const regex = /(?:^|\s)#([a-zA-Z0-9_\-/]+)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      tags.push(m[1]);
    }
    return [...new Set(tags)];
  }

  private async checkOntology(relPath: string, content: string, frontmatter?: Record<string, unknown>): Promise<void> {
    const parsed = matter(content);
    const effectiveFrontmatter = frontmatter ?? parsed.data;
    const fmTags: string[] = Array.isArray(effectiveFrontmatter.tags) ? effectiveFrontmatter.tags.map(String) : [];
    const inlineTags = this.extractInlineTags(parsed.content);
    const result = this.tagEngine.validateNote(relPath, fmTags, inlineTags);
    if (!result.valid) {
      throw new OntologyViolationError(relPath, result.errors);
    }
  }

  async batchEdit(
    filter: { folder?: string; glob?: string; tag?: string },
    operation: 'replace' | 'prepend' | 'append' | 'rename_tag',
    target: string,
    replacement?: string,
    preview = false,
  ): Promise<{ modified: number; paths: string[]; previews?: Array<{ path: string; before: string; after: string }> }> {
    const files = await this.collectMarkdownFiles(filter.folder ?? '');
    const paths: string[] = [];
    for (const f of files) {
      if (filter.glob && !this.globMatch(f, filter.glob)) continue;
      if (filter.tag) {
        const note = await this.readNote(f, { includeContent: false });
        if (!note.tags.includes(filter.tag)) continue;
      }
      paths.push(f);
    }

    const modified: string[] = [];
    const previews: Array<{ path: string; before: string; after: string }> = [];
    for (const f of paths) {
      if (!this.acl.isWriteAllowed(f)) continue;
      if (!this.acl.isReadAllowed(f)) continue;
      const note = await this.readNote(f, { includeContent: true });
      let updated = note.content;
      switch (operation) {
        case 'replace':
          updated = updated.split(target).join(replacement ?? '');
          break;
        case 'prepend':
          updated = (replacement ?? '') + updated;
          break;
        case 'append':
          updated = updated + (replacement ?? '');
          break;
        case 'rename_tag':
          if (note.tags.includes(target)) {
            const newTags = note.tags.map((t) => (t === target ? replacement ?? t : t));
            if (preview) {
              previews.push({ path: f, before: `tags: ${note.tags.join(', ')}`, after: `tags: ${newTags.join(', ')}` });
              modified.push(f);
              continue;
            }
            await this.writeNote(f, note.content, { frontmatter: { ...note.frontmatter, tags: newTags }, overwrite: true });
            modified.push(f);
            continue;
          }
          break;
        default:
          throw new UnknownOperationError(operation);
      }
      if (updated !== note.content) {
        if (preview) {
          previews.push({ path: f, before: note.content, after: updated });
        } else {
          await this.writeNote(f, updated, { overwrite: true });
        }
        modified.push(f);
      }
    }
    if (!preview && modified.length > 0) this.invalidateCache();
    return { modified: modified.length, paths: modified, previews: preview ? previews : undefined };
  }

  private globMatch(filePath: string, glob: string): boolean {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\\-]/g, '\\$&')
      .replace(/\*\*/g, '|||')
      .replace(/\*/g, '[^/]*')
      .replace(/\|\|\|/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp('^' + escaped + '$');
    return regex.test(filePath);
  }
}
