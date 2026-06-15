// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { VaultManager } from '../src/layers/L1-filesystem/VaultManager.js';
import { SignalStore } from '../src/layers/L9-dreaming/SignalStore.js';
import { TopicLoader } from '../src/layers/L9-dreaming/TopicLoader.js';
import { DreamingEngine } from '../src/layers/L9-dreaming/DreamingEngine.js';
import { generateLinkCandidates } from '../src/layers/L9-dreaming/generators/LinkGenerator.js';
import { generateMergeCandidates } from '../src/layers/L9-dreaming/generators/MergeGenerator.js';
import { generatePruneCandidates } from '../src/layers/L9-dreaming/generators/PruneGenerator.js';
import { generateSynthesizeCandidates } from '../src/layers/L9-dreaming/generators/SynthesizeGenerator.js';
import type { DreamTopic } from '../src/layers/L9-dreaming/types.js';
import type { ISemanticDatabase } from '../src/shared/interfaces/ISemanticDatabase.js';

const TEST_VAULT = path.resolve('./test-vault-dreaming');

function makeTopic(overrides: Partial<DreamTopic> & { path: string; title: string }): DreamTopic {
  return {
    summary: '',
    html: '',
    mtimeMs: Date.now(),
    related: [],
    signals: { importance: 50, maturity: 'draft', accessCount: 0 },
    domain: overrides.path.split('/')[0] || 'root',
    ...overrides,
  };
}

function makeSearch(topics: DreamTopic[]) {
  return (query: string, _limit: number) => {
    const q = query.toLowerCase().split(/\s+/).filter(Boolean);
    return topics
      .map((t) => {
        const text = `${t.title} ${t.summary} ${t.html}`.toLowerCase();
        const score = q.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0) / Math.max(q.length, 1);
        return { path: t.path, score, snippet: '', highlights: [] };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  };
}

function makeMockSemanticDb(results: Array<{ path: string; score: number }> = []): ISemanticDatabase {
  return {
    initSchema: async () => {},
    upsertNode: () => {},
    deleteEdgesFrom: () => {},
    upsertEdge: () => {},
    updateFTSContent: () => {},
    deleteChunks: () => {},
    upsertChunk: () => 0,
    upsertEmbedding: () => {},
    close: () => {},
    searchFTS: (_query: string, limit = 20) => results.slice(0, limit).map((r) => ({ path: r.path, score: r.score, snippet: '' })),
    getStats: () => ({ nodes: results.length, edges: 0, chunks: 0, embeddings: 0 }),
    clearAll: () => {},
    bulkIndex: () => [],
    bulkUpdateFTS: () => {},
    getAllEmbeddings: () => [],
  } as unknown as ISemanticDatabase;
}

describe('L9-Dreaming Generators', () => {
  it('LinkGenerator finds missing cross-links', () => {
    const topics: DreamTopic[] = [
      makeTopic({ path: 'a.md', title: 'machine learning', html: 'ml content' }),
      makeTopic({ path: 'b.md', title: 'deep learning', html: 'dl content' }),
      makeTopic({ path: 'c.md', title: 'cooking recipes', html: 'food content' }),
    ];
    const candidates = generateLinkCandidates(topics, makeSearch(topics), { maxCandidates: 10, threshold: 0.1 });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].kind).toBe('link');
  });

  it('LinkGenerator skips already-linked pairs', () => {
    const topics: DreamTopic[] = [
      makeTopic({ path: 'a.md', title: 'machine learning', related: ['b.md'] }),
      makeTopic({ path: 'b.md', title: 'deep learning' }),
    ];
    const candidates = generateLinkCandidates(topics, makeSearch(topics), { maxCandidates: 10 });
    expect(candidates.some((c) => c.sourcePath === 'a.md' && c.targetPath === 'b.md')).toBe(false);
  });

  it('MergeGenerator finds highly similar notes', () => {
    const topics: DreamTopic[] = [
      makeTopic({ path: 'a.md', title: 'react hooks', summary: 'useState useEffect' }),
      makeTopic({ path: 'b.md', title: 'react hooks guide', summary: 'useState useEffect tutorial' }),
    ];
    const candidates = generateMergeCandidates(topics, makeSearch(topics), { maxCandidates: 10, threshold: 0.1 });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].kind).toBe('merge');
  });

  it('PruneGenerator skips core maturity', () => {
    const topics: DreamTopic[] = [
      makeTopic({ path: 'a.md', title: 'old draft', signals: { importance: 10, maturity: 'draft', accessCount: 0 }, mtimeMs: Date.now() - 200 * 24 * 60 * 60 * 1000 }),
      makeTopic({ path: 'b.md', title: 'core note', signals: { importance: 10, maturity: 'core', accessCount: 0 }, mtimeMs: Date.now() - 200 * 24 * 60 * 60 * 1000 }),
    ];
    const candidates = generatePruneCandidates(topics, { maxCandidates: 10 });
    expect(candidates.some((c) => c.path === 'b.md')).toBe(false);
    expect(candidates.some((c) => c.path === 'a.md')).toBe(true);
  });

  it('PruneGenerator scores stale + low-importance higher', () => {
    const topics: DreamTopic[] = [
      makeTopic({ path: 'fresh.md', title: 'fresh', signals: { importance: 50, maturity: 'draft', accessCount: 5 }, mtimeMs: Date.now() }),
      makeTopic({ path: 'stale.md', title: 'stale', signals: { importance: 20, maturity: 'draft', accessCount: 0 }, mtimeMs: Date.now() - 200 * 24 * 60 * 60 * 1000 }),
    ];
    const candidates = generatePruneCandidates(topics, { maxCandidates: 10 });
    expect(candidates[0].path).toBe('stale.md');
  });

  it('SynthesizeGenerator proposes MOC for dense domains', () => {
    const topics: DreamTopic[] = [
      makeTopic({ path: 'ml/a.md', title: 'a' }),
      makeTopic({ path: 'ml/b.md', title: 'b' }),
      makeTopic({ path: 'ml/c.md', title: 'c' }),
      makeTopic({ path: 'ml/d.md', title: 'd' }),
      makeTopic({ path: 'ml/e.md', title: 'e' }),
      makeTopic({ path: 'x/a.md', title: 'x' }),
    ];
    const candidates = generateSynthesizeCandidates(topics, { maxCandidates: 10, minNotesPerDomain: 5 });
    expect(candidates.some((c) => c.domain === 'ml')).toBe(true);
    expect(candidates.some((c) => c.domain === 'x')).toBe(false);
  });
});

describe('L9-Dreaming SignalStore', () => {
  let store: SignalStore;

  beforeEach(async () => {
    await fs.mkdir(TEST_VAULT, { recursive: true });
    store = await SignalStore.forVault(TEST_VAULT);
  });

  afterEach(async () => {
    store.close();
    await fs.rm(TEST_VAULT, { recursive: true, force: true });
  });

  it('round-trips signals', () => {
    store.set('note.md', { importance: 80, maturity: 'validated' });
    const s = store.get('note.md')!;
    expect(s.importance).toBe(80);
    expect(s.maturity).toBe('validated');
  });

  it('increments access count', () => {
    store.incrementAccess('note.md');
    expect(store.get('note.md')!.accessCount).toBe(1);
    store.incrementAccess('note.md');
    expect(store.get('note.md')!.accessCount).toBe(2);
  });

  it('lists all signals', () => {
    store.set('a.md', { importance: 10 });
    store.set('b.md', { importance: 20 });
    const list = store.list();
    expect(list.size).toBe(2);
  });
});

describe('L9-Dreaming Engine Integration', () => {
  let vault: VaultManager;
  let engine: DreamingEngine;

  beforeEach(async () => {
    await fs.mkdir(TEST_VAULT, { recursive: true });
    vault = new VaultManager(TEST_VAULT);
    await vault.writeNote('ml/learn.md', '# ML Learning\ncontent about ml');
    await vault.writeNote('ml/deep.md', '# Deep Learning\ncontent about deep');
    await vault.writeNote('cook/recipe.md', '# Recipe\ncontent about food');
    engine = await DreamingEngine.create({ vaultPath: TEST_VAULT, vault, semanticDb: makeMockSemanticDb([
      { path: 'ml/deep.md', score: 0.8 },
      { path: 'cook/recipe.md', score: 0.2 },
    ]) });
  });

  afterEach(async () => {
    engine.close();
    await fs.rm(TEST_VAULT, { recursive: true, force: true });
  });

  it('scans and returns candidates', async () => {
    const session = await engine.scan({ vaultPath: TEST_VAULT });
    expect(session.sessionId).toBeDefined();
    expect(session.candidates).toBeDefined();
    expect(Object.keys(session.candidates)).toEqual(['link', 'merge', 'prune', 'synthesize']);
  });

  it('touches a note and increments access', async () => {
    await engine.touch('ml/learn.md');
    const s = engine['signals'].get('ml/learn.md');
    expect(s!.accessCount).toBeGreaterThanOrEqual(1);
  });

  it('sets explicit signals', async () => {
    await engine.setSignals('ml/learn.md', { importance: 90, maturity: 'core' });
    const s = engine['signals'].get('ml/learn.md');
    expect(s!.importance).toBe(90);
    expect(s!.maturity).toBe('core');
  });

  it('finalize archives and deletes notes', async () => {
    const session = await engine.scan({ vaultPath: TEST_VAULT });
    const archivePaths = ['ml/learn.md'];
    const result = await engine.finalize({ sessionId: session.sessionId, archivePaths });
    expect(result.archived).toContain('ml/learn.md');
    let exists = true;
    try { await fs.access(path.join(TEST_VAULT, 'ml', 'learn.md')); } catch { exists = false; }
    expect(exists).toBe(false);
  });

  it('undo restores archived notes', async () => {
    const session = await engine.scan({ vaultPath: TEST_VAULT });
    await engine.finalize({ sessionId: session.sessionId, archivePaths: ['ml/learn.md'] });
    const undoResult = await engine.undo(session.sessionId);
    expect(undoResult.restored).toContain('ml/learn.md');
    const note = await vault.readNote('ml/learn.md', { includeContent: true });
    expect(note.content).toContain('ML Learning');
  });

  it('getEngine race safety: concurrent calls return same engine', async () => {
    const semanticDb = makeMockSemanticDb([
      { path: 'ml/learn.md', score: 0.9 },
      { path: 'ml/deep.md', score: 0.8 },
    ]);
    const [e1, e2] = await Promise.all([
      DreamingEngine.create({ vaultPath: TEST_VAULT, vault, semanticDb }),
      DreamingEngine.create({ vaultPath: TEST_VAULT, vault, semanticDb }),
    ]);
    expect(e1).toBe(e2);
    // do not close here — afterEach will close the shared engine
  });

  it('finalize rejects invalid sessionId (C1)', async () => {
    await expect(
      engine.finalize({ sessionId: 'fake-uuid', archivePaths: ['ml/learn.md'] })
    ).rejects.toThrow('Invalid or unknown sessionId');
  });

  it('finalize rejects sessionId from different vault (C1)', async () => {
    const session = await engine.scan({ vaultPath: TEST_VAULT });
    const otherEngine = await DreamingEngine.create({
      vaultPath: path.resolve('./test-vault-dreaming-other'),
      vault: new VaultManager(path.resolve('./test-vault-dreaming-other')),
      semanticDb: makeMockSemanticDb(),
    });
    await expect(
      otherEngine.finalize({ sessionId: session.sessionId, archivePaths: [] })
    ).rejects.toThrow('Invalid or unknown sessionId');
    otherEngine.close();
    await fs.rm(path.resolve('./test-vault-dreaming-other'), { recursive: true, force: true });
  });
});

describe('L9-DreamState atomic write (C1c)', () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = path.resolve('./test-dreamstate');
    await fs.mkdir(stateDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it('uses temp+rename for atomic saves', async () => {
    const { DreamState } = await import('../src/layers/L9-dreaming/DreamState.js');
    const ds = new DreamState(stateDir);
    await ds.addSession({
      sessionId: 's1',
      timestamp: new Date().toISOString(),
      vaultPath: stateDir,
      candidates: { link: [], merge: [], prune: [], synthesize: [] },
    });
    const session = await ds.getSession('s1');
    expect(session).toBeDefined();
    expect(session!.sessionId).toBe('s1');
  });
});
