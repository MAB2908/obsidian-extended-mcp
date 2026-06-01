// v0.1b:
import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../src/layers/L4-semantic/GraphEngine.js';

describe('GraphEngine', () => {
  it('adds nodes and edges', () => {
    const g = new GraphEngine();
    g.addNode({
      path: 'a.md', title: 'A', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    g.addNode({
      path: 'b.md', title: 'B', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    g.addEdge('a.md', 'b.md');
    expect(g.getNeighbors('a.md', 'out')).toContain('b.md');
    expect(g.getNeighbors('b.md', 'in')).toContain('a.md');
  });

  it('finds path', () => {
    const g = new GraphEngine();
    g.addNode({
      path: 'a.md', title: 'A', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    g.addNode({
      path: 'b.md', title: 'B', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    g.addNode({
      path: 'c.md', title: 'C', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    g.addEdge('a.md', 'b.md');
    g.addEdge('b.md', 'c.md');
    const path = g.getPath('a.md', 'c.md');
    expect(path).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('returns null when no path', () => {
    const g = new GraphEngine();
    g.addNode({
      path: 'a.md', title: 'A', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    g.addNode({
      path: 'b.md', title: 'B', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    expect(g.getPath('a.md', 'b.md')).toBeNull();
  });

  it('detects orphans', () => {
    const g = new GraphEngine();
    g.addNode({
      path: 'o.md', title: 'O', aliases: [], tags: [], frontmatter: {},
      outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
    });
    const graph = g.getGraph();
    expect(graph.orphans).toContain('o.md');
  });

  it('handles 100+ nodes', () => {
    const g = new GraphEngine();
    for (let i = 0; i < 150; i++) {
      g.addNode({
        path: `n${i}.md`, title: `N${i}`, aliases: [], tags: [], frontmatter: {},
        outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false,
      });
    }
    for (let i = 0; i < 149; i++) {
      g.addEdge(`n${i}.md`, `n${i + 1}.md`);
    }
    const graph = g.getGraph();
    expect(Object.keys(graph.nodes).length).toBe(150);
    const path = g.getPath('n0.md', 'n149.md', 200);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(150);
  });

  it('computes PageRank', () => {
    const g = new GraphEngine();
    g.addNode({ path: 'a', title: 'A', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    g.addNode({ path: 'b', title: 'B', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    g.addNode({ path: 'c', title: 'C', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('c', 'a');
    const ranks = g.computePageRank(10);
    expect(ranks.size).toBe(3);
    const sum = [...ranks.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('detects communities', () => {
    const g = new GraphEngine();
    // Community 1: a-b-c densely connected
    g.addNode({ path: 'a', title: 'A', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    g.addNode({ path: 'b', title: 'B', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    g.addNode({ path: 'c', title: 'C', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    // Community 2: d-e densely connected
    g.addNode({ path: 'd', title: 'D', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    g.addNode({ path: 'e', title: 'E', aliases: [], tags: [], frontmatter: {}, outbound: [], inbound: [], isOrphan: false, isDeadend: false, hasUnresolvedLinks: false });
    // One bridge edge between communities
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('c', 'a');
    g.addEdge('d', 'e');
    g.addEdge('e', 'd');
    g.addEdge('c', 'd'); // bridge

    const communities = g.detectCommunities();
    expect(communities.size).toBe(5);
    // a, b, c should be in the same community
    const commA = communities.get('a');
    const commB = communities.get('b');
    const commC = communities.get('c');
    expect(commA).toBe(commB);
    expect(commB).toBe(commC);
    // d, e should be in the same community (different from a,b,c)
    const commD = communities.get('d');
    const commE = communities.get('e');
    expect(commD).toBe(commE);
    expect(commD).not.toBe(commA);
  });
});
