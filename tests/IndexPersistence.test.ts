// v0.1b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { IndexPersistence } from '../src/layers/L4-semantic/IndexPersistence.js';
import { GraphEngine } from '../src/layers/L4-semantic/GraphEngine.js';
import { BM25Engine } from '../src/layers/L4-semantic/BM25Engine.js';

const TEST_DIR = path.resolve('./test-vault-persist');

describe('IndexPersistence', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('saves and loads graph + bm25', async () => {
    const persistence = new IndexPersistence(TEST_DIR);
    const graph = new GraphEngine();
    const bm25 = new BM25Engine();

    graph.addNode({
      path: 'a.md', title: 'A', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    graph.addEdge('a.md', 'b.md');
    bm25.addDoc('a.md', 'hello world');

    await persistence.save(graph, bm25);

    const graph2 = new GraphEngine();
    const bm252 = new BM25Engine();
    const loaded = await persistence.load(graph2, bm252);

    expect(loaded).toBe(true);
    expect(graph2.getNeighbors('a.md', 'out')).toContain('b.md');
    expect(bm252.search('hello').length).toBe(1);
  });

  it('returns false when no cache exists', async () => {
    const persistence = new IndexPersistence(TEST_DIR);
    const graph = new GraphEngine();
    const bm25 = new BM25Engine();
    const loaded = await persistence.load(graph, bm25);
    expect(loaded).toBe(false);
  });

  it('clears cache', async () => {
    const persistence = new IndexPersistence(TEST_DIR);
    const graph = new GraphEngine();
    const bm25 = new BM25Engine();
    await persistence.save(graph, bm25);
    await persistence.clear();
    const loaded = await persistence.load(graph, bm25);
    expect(loaded).toBe(false);
  });
});
