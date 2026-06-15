// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { IndexPersistence } from '../src/layers/L4-semantic/IndexPersistence.js';
import { GraphEngine } from '../src/layers/L4-semantic/GraphEngine.js';

const TEST_DIR = path.resolve('./test-vault-persist');

describe('IndexPersistence', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('saves and loads graph', async () => {
    const persistence = new IndexPersistence(TEST_DIR);
    const graph = new GraphEngine();

    graph.addNode({
      path: 'a.md', title: 'A', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    graph.addEdge('a.md', 'b.md');

    await persistence.save(graph);

    const graph2 = new GraphEngine();
    const loaded = await persistence.load(graph2);

    expect(loaded).toBe(true);
    expect(graph2.getNeighbors('a.md', 'out')).toContain('b.md');
  });

  it('returns false when no cache exists', async () => {
    const persistence = new IndexPersistence(TEST_DIR);
    const graph = new GraphEngine();
    const loaded = await persistence.load(graph);
    expect(loaded).toBe(false);
  });

  it('clears cache', async () => {
    const persistence = new IndexPersistence(TEST_DIR);
    const graph = new GraphEngine();
    await persistence.save(graph);
    await persistence.clear();
    const loaded = await persistence.load(graph);
    expect(loaded).toBe(false);
  });
});
