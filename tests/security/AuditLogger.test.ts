// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogger } from '../../src/security/AuditLogger.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('AuditLogger', () => {
  let tempDir: string;
  let logger: AuditLogger;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-test-'));
    logger = new AuditLogger({ vaultPath: tempDir, flushIntervalMs: 999999 });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('flushes entries atomically without race (V-002)', async () => {
    logger.log({ event: 'test', tool: 't1', message: 'm1' });
    logger.log({ event: 'test', tool: 't2', message: 'm2' });

    await logger.flush();

    const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
    const data = await fs.readFile(masterPath, 'utf-8');
    const lines = data.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).tool).toBe('t1');
    expect(JSON.parse(lines[1]).tool).toBe('t2');
  });

  it('handles concurrent flush without data loss (V-002)', async () => {
    // Simulate concurrent log + flush
    logger.log({ event: 'test', tool: 't1' });
    const flush1 = logger.flush();
    logger.log({ event: 'test', tool: 't2' }); // logged during flush
    const flush2 = logger.flush();

    await Promise.all([flush1, flush2]);

    const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
    const data = await fs.readFile(masterPath, 'utf-8');
    const lines = data.trim().split('\n').filter(Boolean);
    // Both entries should be present (order may vary due to concurrency)
    const tools = lines.map((l) => JSON.parse(l).tool);
    expect(tools).toContain('t1');
    expect(tools).toContain('t2');
  });

  it('drops oldest entries when buffer exceeds maxBufferSize (V-005)', async () => {
    const smallLogger = new AuditLogger({
      vaultPath: tempDir,
      flushIntervalMs: 999999,
      batchSize: 100,
      maxBufferSize: 5,
    });

    for (let i = 0; i < 7; i++) {
      smallLogger.log({ event: 'test', tool: `t${i}` });
    }

    await smallLogger.flush();

    const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
    const data = await fs.readFile(masterPath, 'utf-8');
    const lines = data.trim().split('\n').filter(Boolean);
    const tools = lines.map((l) => JSON.parse(l).tool);

    // Oldest entries (t0, t1) should have been dropped during overflow
    expect(tools).not.toContain('t0');
    expect(tools).not.toContain('t1');
    // Newer entries should be preserved (t2-t6)
    expect(tools).toContain('t2');
    expect(tools).toContain('t6');
  });
});
