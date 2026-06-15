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
    logger = new AuditLogger({ vaultPath: tempDir, flushIntervalMs: 999999, format: 'jsonl' });
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
      format: 'jsonl',
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

  it('writes CSV format with header and escaped values', async () => {
    const csvLogger = new AuditLogger({
      vaultPath: tempDir,
      format: 'csv',
      flushIntervalMs: 999999,
      batchSize: 10,
    });
    csvLogger.log({ event: 'test', tool: 't1', message: 'hello, world' });
    csvLogger.log({ event: 'test', tool: 't2', message: 'quote"inside' });
    await csvLogger.flush();

    const masterPath = path.join(tempDir, '.mcp-cache', 'audit.csv');
    const sessionPath = path.join(tempDir, 'sessions');
    const data = await fs.readFile(masterPath, 'utf-8');
    const lines = data.trim().split('\n').filter(Boolean);

    expect(lines[0]).toContain('timestamp');
    expect(lines[0]).toContain('event');
    expect(lines[0]).toContain('tool');
    expect(lines).toHaveLength(3);
    expect(data).toContain('"hello, world"');
    expect(data).toContain('"quote""inside"');

    const sessions = await fs.readdir(sessionPath);
    expect(sessions.some((f) => f.endsWith('.csv'))).toBe(true);
  });

  it('writes Markdown format as a single table', async () => {
    const mdLogger = new AuditLogger({
      vaultPath: tempDir,
      format: 'markdown',
      flushIntervalMs: 999999,
      batchSize: 10,
    });
    mdLogger.log({ event: 'test', tool: 't1', message: 'row one' });
    mdLogger.log({ event: 'test', tool: 't2', message: 'row two' });
    await mdLogger.flush();

    const masterPath = path.join(tempDir, '.mcp-cache', 'audit.md');
    const data = await fs.readFile(masterPath, 'utf-8');
    const lines = data.trim().split('\n').filter(Boolean);

    expect(lines[0]).toMatch(/^\| timestamp \|/);
    expect(lines[1]).toMatch(/^\| --- \|/);
    expect(lines).toHaveLength(4);
    expect(data).toContain('row one');
    expect(data).toContain('row two');
  });

  it('queries CSV audit logs correctly', async () => {
    const csvLogger = new AuditLogger({
      vaultPath: tempDir,
      format: 'csv',
      flushIntervalMs: 999999,
      batchSize: 10,
    });
    csvLogger.log({ event: 'alpha', tool: 't1' });
    csvLogger.log({ event: 'beta', tool: 't2' });
    await csvLogger.flush();

    const results = await csvLogger.query({ event: 'alpha' });
    expect(results).toHaveLength(1);
    expect(results[0].event).toBe('alpha');
    expect(results[0].tool).toBe('t1');
  });

  it('queries Markdown audit logs correctly', async () => {
    const mdLogger = new AuditLogger({
      vaultPath: tempDir,
      format: 'markdown',
      flushIntervalMs: 999999,
      batchSize: 10,
    });
    mdLogger.log({ event: 'alpha', tool: 't1' });
    mdLogger.log({ event: 'beta', tool: 't2' });
    await mdLogger.flush();

    const results = await mdLogger.query({ tool: 't2' });
    expect(results).toHaveLength(1);
    expect(results[0].event).toBe('beta');
    expect(results[0].tool).toBe('t2');
  });
});
