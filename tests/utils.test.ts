// v0.1b:
import { describe, it, expect } from 'vitest';
import { validatePath, tokenize, hashKey, slugify } from '../src/shared/utils.js';
import { PathSecurityError } from '../src/shared/errors.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('validatePath', () => {
  const root = process.platform === 'win32' ? 'C:\\vault' : '/vault';

  it('allows valid relative paths', async () => {
    expect(await validatePath(root, 'notes/hello.md')).toBe('notes/hello.md');
    expect(await validatePath(root, 'concepts/ai.md')).toBe('concepts/ai.md');
  });

  it('rejects .. traversal', async () => {
    await expect(() => validatePath(root, '../etc/passwd')).rejects.toThrow(PathSecurityError);
    await expect(() => validatePath(root, 'foo/../../etc/passwd')).rejects.toThrow(PathSecurityError);
  });

  it('rejects ~ home directory', async () => {
    await expect(() => validatePath(root, '~/secrets')).rejects.toThrow(PathSecurityError);
  });

  it('rejects absolute paths', async () => {
    await expect(() => validatePath(root, '/etc/passwd')).rejects.toThrow(PathSecurityError);
  });

  it('rejects Windows absolute paths', async () => {
    await expect(() => validatePath(root, 'C:\\Windows\\system32')).rejects.toThrow(PathSecurityError);
    await expect(() => validatePath(root, 'D:/data')).rejects.toThrow(PathSecurityError);
    await expect(() => validatePath(root, '\\\\server\\share')).rejects.toThrow(PathSecurityError);
  });

  it('revents backslash traversal', async () => {
    await expect(() => validatePath(root, '..\\windows\\system32')).rejects.toThrow(PathSecurityError);
  });

  it('normalizes backslashes to forward slashes', async () => {
    const result = await validatePath(root, 'notes\\hello.md');
    expect(result).toBe('notes/hello.md');
  });

  it('rejects empty path components that resolve outside', async () => {
    await expect(() => validatePath(root, 'foo/../../../etc/passwd')).rejects.toThrow(PathSecurityError);
  });

  it('rejects symlink traversal to outside vault', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-symlink-test-'));
    const vaultDir = path.join(tmpDir, 'vault');
    const secretFile = path.join(tmpDir, 'secret.txt');
    await fs.mkdir(vaultDir, { recursive: true });
    await fs.writeFile(secretFile, 'secret', 'utf-8');
    const symlinkPath = path.join(vaultDir, 'evil-link');
    try {
      await fs.symlink(secretFile, symlinkPath);
      await expect(() => validatePath(vaultDir, 'evil-link')).rejects.toThrow(PathSecurityError);
    } catch (e: unknown) {
      // Symlinks may require elevated permissions on Windows — skip if creation fails
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'EPERM') {
        return;
      }
      throw e;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('allows symlink inside vault', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-symlink-test-'));
    const vaultDir = path.join(tmpDir, 'vault');
    const notesDir = path.join(vaultDir, 'notes');
    await fs.mkdir(notesDir, { recursive: true });
    await fs.writeFile(path.join(notesDir, 'hello.md'), 'hello', 'utf-8');
    const symlinkPath = path.join(vaultDir, 'link-to-notes');
    try {
      await fs.symlink(notesDir, symlinkPath);
      const result = await validatePath(vaultDir, 'link-to-notes/hello.md');
      expect(result).toBe('link-to-notes/hello.md');
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'EPERM') {
        return;
      }
      throw e;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('tokenize', () => {
  it('splits on whitespace and lowercases', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('filters single characters', () => {
    expect(tokenize('a b c de')).toEqual(['de']);
  });

  it('handles cyrillic', () => {
    expect(tokenize('Привет мир')).toEqual(['привет', 'мир']);
  });
});

describe('hashKey', () => {
  it('returns consistent string', () => {
    expect(typeof hashKey('test')).toBe('string');
    expect(hashKey('test')).toBe(hashKey('test'));
  });

  it('returns different values for different inputs', () => {
    expect(hashKey('a')).not.toBe(hashKey('b'));
  });
});

describe('slugify', () => {
  it('converts to kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('trims dashes', () => {
    expect(slugify('  Hello  ')).toBe('hello');
  });
});
