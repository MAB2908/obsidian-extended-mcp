// v0.2b:
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer, teardownTestServer, type TestServer } from './harness.js';

const FIXTURE = './tests/fixtures/test-vault';

describe('E2E Scenarios', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await setupTestServer(FIXTURE);
  }, 15000);

  afterAll(async () => {
    await teardownTestServer(server);
  });

  // ─── SC-04: Patch note ───
  describe('SC-04: Patch note', () => {
    const targetPath = 'concepts/neural-networks.md';

    it('appends a section after ## Суть', async () => {
      const patchResult = await server.dispatcher.call('patch_note', {
        path: targetPath,
        target: '## Суть',
        operation: 'append',
        replacement: '\n## Применения\nТрансформеры используются в NLP, CV и рекомендательных системах.',
      });
      const patchText = (patchResult as { content: Array<{ type: string; text: string }> }).content[0].text;
      expect(patchText).toContain('Patched');

      const readResult = await server.dispatcher.call('read_note', {
        path: targetPath,
        includeContent: true,
      });
      const readText = (readResult as { content: Array<{ type: string; text: string }> }).content[0].text;
      const note = JSON.parse(readText);

      expect(note.content).toContain('## Применения');
      expect(note.content).toContain('## Связи');
    });
  });

  // ─── SC-07: Move note ───
  describe('SC-07: Move note', () => {
    it('moves a note to a new path', async () => {
      const moveResult = await server.dispatcher.call('move_note', {
        from: 'concepts/backpropagation.md',
        to: 'concepts/backprop.md',
      });
      const moveText = (moveResult as { content: Array<{ type: string; text: string }> }).content[0].text;
      expect(moveText).toContain('Moved');

      // New path should exist
      const newResult = await server.dispatcher.call('read_note', {
        path: 'concepts/backprop.md',
        includeContent: true,
      });
      const newText = (newResult as { content: Array<{ type: string; text: string }> }).content[0].text;
      expect(JSON.parse(newText).title).toBe('Backpropagation');

      // Old path should be gone
      await expect(
        server.dispatcher.call('read_note', { path: 'concepts/backpropagation.md' })
      ).rejects.toThrow();
    });
  });
});
