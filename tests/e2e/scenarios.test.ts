// v0.2b:
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer, teardownTestServer, type TestServer } from './harness.js';
import { promises as fs } from 'fs';
import path from 'path';

const FIXTURE = './tests/fixtures/test-vault';

describe('E2E Scenarios', () => {
  let server: TestServer;
  let aiServer: TestServer;

  beforeAll(async () => {
    server = await setupTestServer(FIXTURE);
    aiServer = await setupTestServer(FIXTURE, true);
  }, 30000);

  afterAll(async () => {
    await teardownTestServer(server);
    await teardownTestServer(aiServer);
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

    it('creates a .bak backup before patching', async () => {
      const backups = await server.vault.listBackups();
      const match = backups.find((b) => b.relPath === targetPath);
      expect(match).toBeDefined();
    });
  });

  // ─── SC-05: Lint / fix ───
  describe('SC-05: Lint / fix', () => {
    it('returns suggested edits from lint analysis', async () => {
      const lintResult = await aiServer.dispatcher.call('ai_lint', {});
      const lintText = (lintResult as { content: Array<{ type: string; text: string }> }).content[0].text;
      const lintData = JSON.parse(lintText);

      expect(lintData.data.suggestedEdits).toBeDefined();
      expect(lintData.data.suggestedEdits.length).toBeGreaterThan(0);
      const edit = lintData.data.suggestedEdits[0];
      expect(edit.file).toBeDefined();
      expect(edit.operation).toBeDefined();
      expect(edit.target).toBeDefined();
    });
  });

  // ─── SC-06: AI query ───
  describe('SC-06: AI query', () => {
    it('creates a session note in sessions/', async () => {
      const queryResult = await aiServer.dispatcher.call('ai_query', {
        question: 'What is API design?',
      });
      const queryText = (queryResult as { content: Array<{ type: string; text: string }> }).content[0].text;
      const queryData = JSON.parse(queryText);

      expect(queryData.data.answer).toBeDefined();

      const sessionsDir = path.join(aiServer.vaultPath, 'sessions');
      const entries = await fs.readdir(sessionsDir);
      const sessionNote = entries.find((f) => f.endsWith('-query.md'));
      expect(sessionNote).toBeDefined();

      const sessionContent = await fs.readFile(path.join(sessionsDir, sessionNote!), 'utf-8');
      expect(sessionContent).toContain('What is API design?');
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

    it('updates backlinks in other notes', async () => {
      const referencingPath = 'concepts/neural-networks.md';
      const readResult = await server.dispatcher.call('read_note', {
        path: referencingPath,
        includeContent: true,
      });
      const readText = (readResult as { content: Array<{ type: string; text: string }> }).content[0].text;
      const note = JSON.parse(readText);

      expect(note.content).not.toContain('[[backpropagation]]');
      expect(note.content).toContain('[[backprop]]');
    });
  });
});
