// v0.2b:
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DreamingEngine } from '../../src/layers/L9-dreaming/DreamingEngine.js';
import { SessionLockService } from '../../src/layers/L9-dreaming/SessionLockService.js';
import { setupTestServer, teardownTestServer, type TestServer } from './harness.js';

const FIXTURE = './tests/fixtures/test-vault';

describe('E2E Dreaming', () => {
  let server: TestServer;
  let engine: DreamingEngine;

  beforeAll(async () => {
    server = await setupTestServer(FIXTURE);
    engine = await DreamingEngine.create({
      vaultPath: server.vaultPath,
      vault: server.vault,
      semanticDb: server.semanticDb,
    });
  }, 15000);

  afterEach(() => {
    SessionLockService.clear();
  });

  afterAll(async () => {
    engine?.close();
    await teardownTestServer(server);
  });

  it('filters scan by scope', async () => {
    const session = await engine.scan({ vaultPath: server.vaultPath, scope: 'concepts' });
    const paths = new Set([
      ...session.candidates.link.map((c: { sourcePath: string }) => c.sourcePath),
      ...session.candidates.merge.map((c: { sourcePath: string }) => c.sourcePath),
    ]);
    for (const p of paths) {
      expect((p as string).startsWith('concepts/')).toBe(true);
    }
  });
});
