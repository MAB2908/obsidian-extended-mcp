// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileLock } from '../src/shared/FileLock.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('FileLock', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lock-'));
    testFile = path.join(tmpDir, 'test.md');
    await fs.writeFile(testFile, 'initial', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('acquires and releases lock', async () => {
    const release = await FileLock.acquire(testFile);
    expect(typeof release).toBe('function');
    await release();
  });

  it('withLock executes fn and releases', async () => {
    const result = await FileLock.withLock(testFile, async () => {
      return 'locked';
    });
    expect(result).toBe('locked');
  });

  it('serializes concurrent access', async () => {
    const active = new Set<number>();
    const overlaps: number[][] = [];
    const fn = async (id: number) => {
      active.add(id);
      overlaps.push([...active]);
      await new Promise((r) => setTimeout(r, 100));
      active.delete(id);
    };
    await Promise.all([FileLock.withLock(testFile, () => fn(1)), FileLock.withLock(testFile, () => fn(2))]);
    // No overlap: each overlap snapshot should have exactly 1 active task
    expect(overlaps.every((s) => s.length === 1)).toBe(true);
  }, 15000);

  it('works with non-existing files via lockfile', async () => {
    const newFile = path.join(tmpDir, 'new.md');
    const result = await FileLock.withLock(newFile, async () => {
      await fs.writeFile(newFile, 'created under lock');
      return 'ok';
    });
    expect(result).toBe('ok');
    const content = await fs.readFile(newFile, 'utf-8');
    expect(content).toBe('created under lock');
  });
});
