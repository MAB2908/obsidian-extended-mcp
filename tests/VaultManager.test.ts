// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { VaultManager } from '../src/layers/L1-filesystem/VaultManager.js';
import { PathSecurityError, OntologyViolationError, FileSystemError } from '../src/shared/errors.js';
import { FolderACL } from '../src/security/FolderACL.js';

const TEST_VAULT = path.resolve('./test-vault');

describe('VaultManager', () => {
  let vault: VaultManager;

  beforeEach(async () => {
    await fs.mkdir(TEST_VAULT, { recursive: true });
    vault = new VaultManager(TEST_VAULT);
  });

  afterEach(async () => {
    await fs.rm(TEST_VAULT, { recursive: true, force: true });
  });

  it('writes and reads a note', async () => {
    await vault.writeNote('hello.md', '# Hello\nWorld');
    const note = await vault.readNote('hello.md');
    expect(note.title).toBe('hello');
    expect(note.content).toBe('# Hello\nWorld');
  });

  it('rejects path traversal', async () => {
    await expect(vault.readNote('../outside.md')).rejects.toThrow(PathSecurityError);
  });

  it('rejects oversized content (MAX_NOTE_SIZE)', async () => {
    const huge = 'A'.repeat(11 * 1024 * 1024); // 11 MB
    await expect(vault.writeNote('huge.md', huge)).rejects.toThrow(FileSystemError);
  });

  it('rejects append that exceeds MAX_NOTE_SIZE', async () => {
    await vault.writeNote('big.md', 'A'.repeat(5 * 1024 * 1024));
    const append = 'B'.repeat(6 * 1024 * 1024);
    await expect(vault.appendNote('big.md', append)).rejects.toThrow(FileSystemError);
  });

  it('rejects patch that exceeds MAX_NOTE_SIZE', async () => {
    await vault.writeNote('patch-big.md', 'A'.repeat(5 * 1024 * 1024));
    const replacement = 'B'.repeat(6 * 1024 * 1024);
    await expect(vault.patchNote('patch-big.md', 'AAA', 'append', replacement)).rejects.toThrow(FileSystemError);
  });

  it('parses frontmatter', async () => {
    await vault.writeNote('front.md', '---\ntags: [a, b]\n---\nBody');
    const note = await vault.readNote('front.md');
    expect(note.tags).toEqual(['a', 'b']);
    expect(note.content.trim()).toBe('Body');
  });

  it('lists directory', async () => {
    await vault.writeNote('a.md', 'A');
    await vault.writeNote('b.md', 'B');
    await fs.mkdir(path.join(TEST_VAULT, 'sub'), { recursive: true });
    const entries = await vault.listDirectory('');
    expect(entries.some((e) => e.name === 'a.md')).toBe(true);
    expect(entries.some((e) => e.name === 'sub' && e.isDirectory)).toBe(true);
  });

  it('searches notes', async () => {
    await vault.writeNote('alpha.md', 'alpha content');
    await vault.writeNote('beta.md', 'beta content');
    const results = await vault.searchNotes('alpha');
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('alpha.md');
  });

  it('appends to note', async () => {
    await vault.writeNote('app.md', 'hello');
    await vault.appendNote('app.md', ' world');
    const note = await vault.readNote('app.md');
    expect(note.content).toBe('hello world');
  });

  it('patches note', async () => {
    await vault.writeNote('patch.md', 'hello world');
    await vault.patchNote('patch.md', 'world', 'replace', 'universe');
    const note = await vault.readNote('patch.md');
    expect(note.content).toBe('hello universe');
  });

  it('deletes note', async () => {
    await vault.writeNote('del.md', 'x');
    await vault.deleteNote('del.md');
    await expect(vault.readNote('del.md')).rejects.toThrow();
  });

  it('soft deletes note to .trash', async () => {
    await vault.writeNote('soft.md', 'x');
    await vault.deleteNote('soft.md', { soft: true });
    const trash = await fs.readFile(path.join(TEST_VAULT, '.trash', 'soft.md'), 'utf-8');
    expect(trash).toBe('x');
  });

  it('moves note', async () => {
    await vault.writeNote('old.md', 'x');
    await vault.moveNote('old.md', 'new.md');
    const note = await vault.readNote('new.md');
    expect(note.content).toBe('x');
    await expect(vault.readNote('old.md')).rejects.toThrow();
  });

  it('updates backlinks when moving a note', async () => {
    await vault.writeNote('folder/old.md', 'x');
    await vault.writeNote('ref.md', 'See [[folder/old]] and [[old|alias text]].');
    const { updatedFiles } = await vault.moveNote('folder/old.md', 'moved/new.md');
    expect(updatedFiles).toContain('ref.md');
    const ref = await vault.readNote('ref.md');
    expect(ref.content).toBe('See [[moved/new]] and [[new|alias text]].');
  });

  it('creates a backup before patching an existing note', async () => {
    await vault.writeNote('patch-backup.md', 'original');
    await vault.patchNote('patch-backup.md', 'original', 'replace', 'updated');
    const backups = await vault.listBackups();
    expect(backups.some((b) => b.relPath === 'patch-backup.md')).toBe(true);
    const note = await vault.readNote('patch-backup.md');
    expect(note.content).toBe('updated');
  });

  it('uses injected FTS search when available', async () => {
    const ftsVault = new VaultManager(TEST_VAULT, undefined, undefined, false, (q, limit) => [
      { path: 'fts-result.md', score: 0.9, snippet: `matched ${q}` },
    ]);
    const results = await ftsVault.searchNotes('alpha', { limit: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('fts-result.md');
    expect(results[0].score).toBe(0.9);
    expect(results[0].snippet).toBe('matched alpha');
  });

  it('readNoteTags parses tags in long frontmatter', async () => {
    const longValue = 'x'.repeat(20 * 1024);
    await vault.writeNote('long-fm.md', `---\nlong: ${longValue}\ntags: [deep-tag]\n---\nBody`);
    const tags = await vault.readNoteTags('long-fm.md');
    expect(tags).toEqual(['deep-tag']);
  });

  it('soft delete preserves folder structure in .trash', async () => {
    await vault.writeNote('concepts/soft-folder.md', 'x');
    await vault.deleteNote('concepts/soft-folder.md', { soft: true });
    const trash = await fs.readFile(path.join(TEST_VAULT, '.trash', 'concepts', 'soft-folder.md'), 'utf-8');
    expect(trash).toBe('x');
    await expect(vault.readNote('concepts/soft-folder.md')).rejects.toThrow();
  });

  it('soft delete appends timestamp when trash destination exists', async () => {
    await fs.mkdir(path.join(TEST_VAULT, '.trash', 'concepts'), { recursive: true });
    await fs.writeFile(path.join(TEST_VAULT, '.trash', 'concepts', 'collision.md'), 'old', 'utf-8');
    await vault.writeNote('concepts/collision.md', 'new');
    await vault.deleteNote('concepts/collision.md', { soft: true });
    const entries = await fs.readdir(path.join(TEST_VAULT, '.trash', 'concepts'));
    expect(entries.length).toBe(2);
    expect(entries).toContain('collision.md');
    expect(entries.some((e) => e.startsWith('collision-') && e.endsWith('.md'))).toBe(true);
  });

  it('moveNote overwrites destination and keeps a backup', async () => {
    await vault.writeNote('src.md', 'source content');
    await vault.writeNote('dst.md', 'destination content');
    const { updatedFiles } = await vault.moveNote('src.md', 'dst.md');
    expect(updatedFiles).toEqual([]);
    const note = await vault.readNote('dst.md');
    expect(note.content).toBe('source content');
    await expect(vault.readNote('src.md')).rejects.toThrow();
    const backups = await vault.listBackups();
    expect(backups.some((b) => b.relPath === 'dst.md')).toBe(true);
  });
});

describe('VaultManager with ontology enforcement', () => {
  let vault: VaultManager;

  beforeEach(async () => {
    await fs.mkdir(TEST_VAULT, { recursive: true });
    vault = new VaultManager(TEST_VAULT, undefined, undefined, true);
  });

  afterEach(async () => {
    await fs.rm(TEST_VAULT, { recursive: true, force: true });
  });

  it('allows write that complies with ontology', async () => {
    await vault.writeNote('concepts/test.md', '# Test', {
      frontmatter: { tags: ['concept'] },
    });
    const note = await vault.readNote('concepts/test.md');
    expect(note.tags).toContain('concept');
  });

  it('blocks write missing required tag', async () => {
    await expect(
      vault.writeNote('concepts/test.md', '# Test', {
        frontmatter: { tags: ['random'] },
      })
    ).rejects.toThrow(OntologyViolationError);
  });

  it('blocks write with forbidden tag', async () => {
    await expect(
      vault.writeNote('raw/test.md', '# Test', {
        frontmatter: { tags: ['source', 'evergreen'] },
      })
    ).rejects.toThrow(OntologyViolationError);
  });

  it('batchEdit preview respects read ACL (C2 fix)', async () => {
    await vault.writeNote('secret.md', 'classified content');
    await vault.writeNote('public/open.md', 'public content');
    const restrictedVault = new VaultManager(TEST_VAULT, new FolderACL({
      readPaths: ['public/'],
      writePaths: ['*'],
      safeZones: [],
      forbiddenPaths: [],
    }));
    const result = await restrictedVault.batchEdit({}, 'replace', 'content', 'REDACTED', true);
    // Only public/open.md should be in previews (secret.md blocked by read ACL)
    expect(result.previews?.length).toBe(1);
    expect(result.previews?.[0].path).toBe('public/open.md');
  });
});
