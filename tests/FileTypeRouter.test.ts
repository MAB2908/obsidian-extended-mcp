// v0.1b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileTypeRouter, markdownHandler, canvasHandler, jsonHandler } from '../src/shared/FileTypeRouter.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('FileTypeRouter', () => {
  let tmpDir: string;
  let router: FileTypeRouter;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'router-'));
    router = new FileTypeRouter();
    router.register(markdownHandler);
    router.register(canvasHandler);
    router.register(jsonHandler);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads markdown as string', async () => {
    const file = path.join(tmpDir, 'note.md');
    await fs.writeFile(file, '# Hello', 'utf-8');
    const result = await router.read(file);
    expect(result).toBe('# Hello');
  });

  it('reads canvas as parsed JSON', async () => {
    const file = path.join(tmpDir, 'board.canvas');
    await fs.writeFile(file, '{"nodes":[]}', 'utf-8');
    const result = await router.read(file);
    expect(result).toEqual({ nodes: [] });
  });

  it('reads json as parsed object', async () => {
    const file = path.join(tmpDir, 'data.json');
    await fs.writeFile(file, '{"x":1}', 'utf-8');
    const result = await router.read(file);
    expect(result).toEqual({ x: 1 });
  });

  it('reads unknown text as string', async () => {
    const file = path.join(tmpDir, 'plain.txt');
    await fs.writeFile(file, 'hello world', 'utf-8');
    const result = await router.read(file);
    expect(result).toBe('hello world');
  });

  it('reads binary as base64 object', async () => {
    const file = path.join(tmpDir, 'image.png');
    await fs.writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'binary');
    const result = await router.read(file);
    expect(result).toMatchObject({ type: 'base64', mime: 'image/png' });
    expect(typeof (result as { data: string }).data).toBe('string');
  });

  it('writes markdown', async () => {
    const file = path.join(tmpDir, 'out.md');
    await router.write(file, '# Test');
    const content = await fs.readFile(file, 'utf-8');
    expect(content).toBe('# Test');
  });

  it('writes canvas', async () => {
    const file = path.join(tmpDir, 'out.canvas');
    await router.write(file, { nodes: [] });
    const content = await fs.readFile(file, 'utf-8');
    expect(JSON.parse(content)).toEqual({ nodes: [] });
  });
});
