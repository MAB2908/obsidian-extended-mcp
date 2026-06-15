// v0.2b:
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditLogger } from '../../src/security/AuditLogger.js';
import { securityConfig } from '../../src/shared/config.js';
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

  describe('rotateByAge', () => {
    const oldTs = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const recentTs = new Date().toISOString();

    it('removes old JSONL rows from master and session logs', async () => {
      const jsonlLogger = new AuditLogger({
        vaultPath: tempDir,
        format: 'jsonl',
        flushIntervalMs: 999999,
        batchSize: 10,
        maxAgeDays: 1,
      });

      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
      const sessionDir = path.join(tempDir, 'sessions');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.mkdir(sessionDir, { recursive: true });
      await fs.writeFile(
        masterPath,
        [
          JSON.stringify({ timestamp: oldTs, sessionId: 's1', event: 'old1' }),
          JSON.stringify({ timestamp: recentTs, sessionId: 's1', event: 'new1' }),
        ].join('\n') + '\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(sessionDir, 'mcp-audit-old.jsonl'),
        [
          JSON.stringify({ timestamp: oldTs, sessionId: 's2', event: 'old2' }),
          JSON.stringify({ timestamp: recentTs, sessionId: 's2', event: 'new2' }),
        ].join('\n') + '\n',
        'utf-8',
      );

      const removed = await jsonlLogger.rotateByAge();
      expect(removed).toBe(2);

      const masterData = await fs.readFile(masterPath, 'utf-8');
      const sessionData = await fs.readFile(path.join(sessionDir, 'mcp-audit-old.jsonl'), 'utf-8');
      expect(masterData).toContain('new1');
      expect(masterData).not.toContain('old1');
      expect(sessionData).toContain('new2');
      expect(sessionData).not.toContain('old2');
    });

    it('keeps CSV header after removing old rows', async () => {
      const csvLogger = new AuditLogger({
        vaultPath: tempDir,
        format: 'csv',
        flushIntervalMs: 999999,
        batchSize: 10,
        maxAgeDays: 1,
      });
      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.csv');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.writeFile(
        masterPath,
        'timestamp,sessionId,event,tool,args,result,durationMs,level,reason,blocked,message,vaultPath\n' +
          `${oldTs},s1,old,t1,,,,,,,,\n` +
          `${recentTs},s1,new,t2,,,,,,,,\n`,
        'utf-8',
      );

      const removed = await csvLogger.rotateByAge();
      expect(removed).toBe(1);

      const data = await fs.readFile(masterPath, 'utf-8');
      const lines = data.trim().split('\n').filter(Boolean);
      expect(lines[0]).toContain('timestamp');
      expect(lines).toHaveLength(2);
      expect(data).toContain('new');
      expect(data).not.toContain('old');
    });

    it('rebuilds Markdown table without old rows', async () => {
      const mdLogger = new AuditLogger({
        vaultPath: tempDir,
        format: 'markdown',
        flushIntervalMs: 999999,
        batchSize: 10,
        maxAgeDays: 1,
      });
      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.md');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.writeFile(
        masterPath,
        '| timestamp | sessionId | event | tool | args | result | durationMs | level | reason | blocked | message | vaultPath |\n' +
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n' +
          `| ${oldTs} | s1 | old | t1 |  |  |  |  |  |  |  |  |\n` +
          `| ${recentTs} | s1 | new | t2 |  |  |  |  |  |  |  |  |\n`,
        'utf-8',
      );

      const removed = await mdLogger.rotateByAge();
      expect(removed).toBe(1);

      const data = await fs.readFile(masterPath, 'utf-8');
      const lines = data.trim().split('\n').filter(Boolean);
      expect(lines[0]).toMatch(/^\| timestamp \|/);
      expect(lines[1]).toMatch(/^\| --- \|/);
      expect(lines).toHaveLength(3);
      expect(data).toContain('new');
      expect(data).not.toContain('old');
    });
  });

  describe('gdprPurge', () => {
    it('throws when criteria is empty', async () => {
      await expect(logger.gdprPurge({})).rejects.toThrow('at least one criterion');
    });

    it('removes entries by sessionId and logs GDPR_PURGE entries', async () => {
      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.writeFile(
        masterPath,
        [
          JSON.stringify({ timestamp: new Date().toISOString(), sessionId: 'keep-session', event: 'auth', tool: 'read_note' }),
          JSON.stringify({ timestamp: new Date().toISOString(), sessionId: 'purge-session', event: 'auth', tool: 'write_note' }),
        ].join('\n') + '\n',
        'utf-8',
      );

      const removed = await logger.gdprPurge({ sessionId: 'purge-session' });
      expect(removed).toBe(1);

      const remaining = await logger.query({});
      expect(remaining.some((e) => e.sessionId === 'purge-session')).toBe(false);
      expect(remaining.some((e) => e.sessionId === 'keep-session')).toBe(true);
      expect(remaining.some((e) => e.event === 'GDPR_PURGE')).toBe(true);
    });

    it('removes entries by operation (tool)', async () => {
      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.writeFile(
        masterPath,
        [
          JSON.stringify({ timestamp: new Date().toISOString(), sessionId: 's1', event: 'auth', tool: 'write_note' }),
          JSON.stringify({ timestamp: new Date().toISOString(), sessionId: 's1', event: 'auth', tool: 'delete_note' }),
        ].join('\n') + '\n',
        'utf-8',
      );

      const removed = await logger.gdprPurge({ operation: 'delete_note' });
      expect(removed).toBe(1);

      const remaining = await logger.query({});
      expect(remaining.some((e) => e.tool === 'delete_note' && e.event !== 'GDPR_PURGE')).toBe(false);
      expect(remaining.some((e) => e.tool === 'write_note')).toBe(true);
    });

    it('removes entries by path prefix', async () => {
      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.writeFile(
        masterPath,
        [
          JSON.stringify({ timestamp: new Date().toISOString(), sessionId: 's1', event: 'auth', tool: 'write_note', vaultPath: 'private/journal.md' }),
          JSON.stringify({ timestamp: new Date().toISOString(), sessionId: 's1', event: 'auth', tool: 'write_note', vaultPath: 'public/note.md' }),
        ].join('\n') + '\n',
        'utf-8',
      );

      const removed = await logger.gdprPurge({ path: 'private' });
      expect(removed).toBe(1);

      const remaining = await logger.query({});
      expect(remaining.some((e) => e.vaultPath === 'private/journal.md')).toBe(false);
      expect(remaining.some((e) => e.vaultPath === 'public/note.md')).toBe(true);
    });

    it('removes entries by before date', async () => {
      const oldTs = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const recentTs = new Date().toISOString();
      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.writeFile(
        masterPath,
        [
          JSON.stringify({ timestamp: oldTs, sessionId: 's1', event: 'auth', tool: 'read_note' }),
          JSON.stringify({ timestamp: recentTs, sessionId: 's1', event: 'auth', tool: 'read_note' }),
        ].join('\n') + '\n',
        'utf-8',
      );

      const removed = await logger.gdprPurge({ before: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() });
      expect(removed).toBe(1);

      const remaining = await logger.query({});
      expect(remaining.some((e) => e.timestamp === oldTs)).toBe(false);
      expect(remaining.some((e) => e.timestamp === recentTs)).toBe(true);
    });

    it('never purges GDPR_PURGE entries themselves', async () => {
      const masterPath = path.join(tempDir, '.mcp-cache', 'audit.log');
      await fs.mkdir(path.dirname(masterPath), { recursive: true });
      await fs.writeFile(
        masterPath,
        [
          JSON.stringify({ timestamp: new Date().toISOString(), sessionId: 's1', event: 'auth', tool: 'write_note' }),
        ].join('\n') + '\n',
        'utf-8',
      );

      await logger.gdprPurge({ operation: 'write_note' });
      const afterFirst = await logger.query({ event: 'GDPR_PURGE' });
      expect(afterFirst).toHaveLength(1);

      await logger.gdprPurge({ operation: 'write_note' });
      const afterSecond = await logger.query({ event: 'GDPR_PURGE' });
      expect(afterSecond).toHaveLength(1);
    });
  });

  describe('remote sink', () => {
    const originalRemote = {
      auditRemoteUrl: securityConfig.auditRemoteUrl,
      auditRemoteToken: securityConfig.auditRemoteToken,
      auditRemoteBatchSize: securityConfig.auditRemoteBatchSize,
      auditRemoteTimeoutMs: securityConfig.auditRemoteTimeoutMs,
      auditRemoteRetryAttempts: securityConfig.auditRemoteRetryAttempts,
    };

    afterEach(() => {
      Object.assign(securityConfig, originalRemote);
      vi.restoreAllMocks();
    });

    it('successfully flushes entries to a remote endpoint', async () => {
      Object.assign(securityConfig, {
        auditRemoteUrl: 'http://localhost:9999/audit',
        auditRemoteToken: 'token',
        auditRemoteBatchSize: 50,
        auditRemoteTimeoutMs: 5000,
        auditRemoteRetryAttempts: 3,
      });
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

      logger.log({ event: 'test', tool: 't1' });
      logger.log({ event: 'test', tool: 't2' });
      await logger.flush();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('http://localhost:9999/audit');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(init?.body as string);
      expect(body).toHaveLength(2);
      expect(body[0].tool).toBe('t1');
      expect(body[1].tool).toBe('t2');
    });

    it('retries then falls back to local failure file', async () => {
      Object.assign(securityConfig, {
        auditRemoteUrl: 'http://localhost:9999/audit',
        auditRemoteToken: '',
        auditRemoteBatchSize: 50,
        auditRemoteTimeoutMs: 5000,
        auditRemoteRetryAttempts: 3,
      });
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

      logger.log({ event: 'test', tool: 't1' });
      await logger.flush();

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      const failures = await logger.getFailedRemoteFlushes();
      expect(failures).toHaveLength(1);
      expect(failures[0].tool).toBe('t1');
      expect(failures[0]._remoteError).toContain('network down');
    });

    it('sends Authorization bearer header when token is configured', async () => {
      Object.assign(securityConfig, {
        auditRemoteUrl: 'http://localhost:9999/audit',
        auditRemoteToken: 'secret-token',
      });
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

      logger.log({ event: 'test', tool: 't1' });
      await logger.flush();

      const [, init] = fetchSpy.mock.calls[0];
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' });
    });

    it('returns correct remote status counts', async () => {
      Object.assign(securityConfig, {
        auditRemoteUrl: 'http://localhost:9999/audit',
        auditRemoteToken: '',
        auditRemoteBatchSize: 50,
        auditRemoteTimeoutMs: 5000,
        auditRemoteRetryAttempts: 2,
      });
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('unreachable'));

      logger.log({ event: 'test', tool: 't1' });
      logger.log({ event: 'test', tool: 't2' });
      await logger.flush();

      const status = logger.getRemoteStatus();
      expect(status.configured).toBe(true);
      expect(status.url).toBe('http://localhost:9999/audit');
      expect(status.pendingFailures).toBe(2);
      expect(status.lastError).toContain('unreachable');
    });
  });
});
