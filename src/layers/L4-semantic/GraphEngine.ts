// v0.2b:
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { GraphNode, GraphEdge, Graph } from '../../shared/types.js';
import { semanticConfig } from '../../shared/config.js';

export class GraphEngine implements IGraphEngine {
  private nodes = new Map<string, GraphNode>();
  private outEdges = new Map<string, Set<string>>();
  private inEdges = new Map<string, Set<string>>();

  addNode(node: GraphNode): void {
    if (this.nodes.has(node.path)) {
      // Re-index: clear only this node's outbound edges to prevent phantom edges,
      // but preserve inbound edges from other nodes (they are still valid backlinks)
      const oldOut = this.outEdges.get(node.path);
      if (oldOut) {
        for (const target of oldOut) {
          this.inEdges.get(target)?.delete(node.path);
        }
        oldOut.clear();
      }
      // Preserve existing inbound edges in the node data to keep graph consistency
      const existingIn = this.inEdges.get(node.path);
      if (existingIn && existingIn.size > 0) {
        node.inbound = Array.from(existingIn);
      }
      this.nodes.set(node.path, node);
    } else {
      this.nodes.set(node.path, node);
      this.outEdges.set(node.path, new Set());
      this.inEdges.set(node.path, new Set());
    }
  }

  removeNode(path: string): void {
    const out = this.outEdges.get(path);
    if (out) {
      for (const target of out) {
        this.inEdges.get(target)?.delete(path);
      }
    }
    const inn = this.inEdges.get(path);
    if (inn) {
      for (const source of inn) {
        this.outEdges.get(source)?.delete(path);
      }
    }
    this.nodes.delete(path);
    this.outEdges.delete(path);
    this.inEdges.delete(path);
  }

  addEdge(from: string, to: string, _type: GraphEdge['type'] = 'wikilink', _context?: string): void {
    this.ensureNode(from);
    this.ensureNode(to);
    this.outEdges.get(from)!.add(to);
    this.inEdges.get(to)!.add(from);
    // Update node link lists
    const fromNode = this.nodes.get(from)!;
    const toNode = this.nodes.get(to)!;
    if (!fromNode.outbound.includes(to)) fromNode.outbound.push(to);
    if (!toNode.inbound.includes(from)) toNode.inbound.push(from);
  }

  removeEdge(from: string, to: string): void {
    this.outEdges.get(from)?.delete(to);
    this.inEdges.get(to)?.delete(from);
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);
    if (fromNode) fromNode.outbound = fromNode.outbound.filter((p) => p !== to);
    if (toNode) toNode.inbound = toNode.inbound.filter((p) => p !== from);
  }

  getNeighbors(path: string, direction: 'both' | 'in' | 'out' = 'both'): string[] {
    const result = new Set<string>();
    if (direction === 'both' || direction === 'out') {
      const outs = this.outEdges.get(path);
      if (outs) outs.forEach((t) => result.add(t));
    }
    if (direction === 'both' || direction === 'in') {
      const ins = this.inEdges.get(path);
      if (ins) ins.forEach((s) => result.add(s));
    }
    return [...result];
  }

  getPath(from: string, to: string, maxDepth = semanticConfig.pathMaxDepth): string[] | null {
    if (from === to) return [from];
    const queue: Array<{ path: string; chain: string[] }> = [{ path: from, chain: [from] }];
    const visited = new Set<string>();
    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.chain.length > maxDepth + 1) continue;
      const outs = this.outEdges.get(current.path);
      if (!outs) continue;
      for (const neighbor of outs) {
        if (visited.has(neighbor)) continue;
        const nextChain = [...current.chain, neighbor];
        if (neighbor === to) return nextChain;
        visited.add(neighbor);
        queue.push({ path: neighbor, chain: nextChain });
      }
    }
    return null;
  }

  getGraph(): Graph {
    const nodes: Record<string, GraphNode> = {};
    const edges: GraphEdge[] = [];
    const unresolved: Array<{ source: string; link: string; line: number }> = [];
    const orphans: string[] = [];
    const deadends: string[] = [];

    for (const [path, node] of this.nodes) {
      nodes[path] = node;
      if (node.inbound.length === 0) orphans.push(path);
      if (node.outbound.length === 0) deadends.push(path);
      for (const target of node.outbound) {
        edges.push({ from: path, to: target, type: 'wikilink' });
      }
    }

    return { nodes, edges, unresolved, orphans, deadends };
  }

  serialize(): unknown {
    const nodes: Record<string, GraphNode> = {};
    for (const [k, v] of this.nodes) nodes[k] = v;
    const outEdges: Record<string, string[]> = {};
    for (const [k, v] of this.outEdges) outEdges[k] = [...v];
    const inEdges: Record<string, string[]> = {};
    for (const [k, v] of this.inEdges) inEdges[k] = [...v];
    return { nodes, outEdges, inEdges };
  }

  load(data: { nodes: Record<string, GraphNode>; outEdges: Record<string, string[]>; inEdges: Record<string, string[]> }): void {
    this.nodes.clear();
    this.outEdges.clear();
    this.inEdges.clear();
    for (const [k, v] of Object.entries(data.nodes)) {
      this.nodes.set(k, v);
    }
    for (const [k, v] of Object.entries(data.outEdges)) {
      this.outEdges.set(k, new Set(v));
    }
    for (const [k, v] of Object.entries(data.inEdges)) {
      this.inEdges.set(k, new Set(v));
    }
  }

  computePageRank(iterations = semanticConfig.pageRankIterations, damping = semanticConfig.pageRankDamping): Map<string, number> {
    const n = this.nodes.size;
    if (n === 0) return new Map();
    const ranks = new Map<string, number>();
    for (const path of this.nodes.keys()) ranks.set(path, 1 / n);

    for (let i = 0; i < iterations; i++) {
      const newRanks = new Map<string, number>();
      // Accumulate rank from dangling nodes (no outgoing edges)
      let danglingRank = 0;
      for (const path of this.nodes.keys()) {
        const outCount = this.outEdges.get(path)?.size || 0;
        if (outCount === 0) {
          danglingRank += ranks.get(path)!;
        }
      }
      for (const path of this.nodes.keys()) {
        let rank = (1 - damping) / n + damping * (danglingRank / n);
        const inbound = this.inEdges.get(path) || new Set();
        for (const source of inbound) {
          const outCount = this.outEdges.get(source)?.size || 0;
          if (outCount > 0) {
            rank += damping * (ranks.get(source)! / outCount);
          }
        }
        newRanks.set(path, rank);
      }
      for (const [k, v] of newRanks) ranks.set(k, v);
    }
    return ranks;
  }

  detectCommunities(maxPasses = semanticConfig.communityMaxPasses): Map<string, number> {
    // Simplified Louvain method for community detection
    const nodeList = [...this.nodes.keys()];
    if (nodeList.length === 0) return new Map();

    // Start with each node in its own community
    const communities = new Map<string, number>();
    nodeList.forEach((node, i) => communities.set(node, i));

    const m = this.countTotalEdges();
    if (m === 0) return communities;

    // Precompute node degrees
    const degrees = new Map<string, number>();
    for (const node of nodeList) {
      degrees.set(node, (this.outEdges.get(node)?.size || 0) + (this.inEdges.get(node)?.size || 0));
    }

    let pass = 0;
    let improved = true;
    while (improved && pass < maxPasses) {
      improved = false;
      pass++;
      // Compute community degrees once per pass for current state
      const commDegrees = new Map<number, number>();
      for (const [n, c] of communities) {
        commDegrees.set(c, (commDegrees.get(c) || 0) + degrees.get(n)!);
      }
      for (const node of nodeList) {
        const currentComm = communities.get(node)!;
        const neighborComms = new Map<number, number>();

        // Count edges to each neighboring community (undirected view)
        const outs = this.outEdges.get(node) || new Set();
        const ins = this.inEdges.get(node) || new Set();
        for (const n of outs) {
          if (n === node) continue;
          const comm = communities.get(n)!;
          neighborComms.set(comm, (neighborComms.get(comm) || 0) + 1);
        }
        for (const n of ins) {
          if (n === node) continue;
          const comm = communities.get(n)!;
          neighborComms.set(comm, (neighborComms.get(comm) || 0) + 1);
        }

        let bestComm = currentComm;
        let bestGain = 0;
        const ki = degrees.get(node)!;
        const kiInCurrent = neighborComms.get(currentComm) || 0;
        const sigmaTotCurrent = (commDegrees.get(currentComm) || 0) - ki;

        for (const [comm, kiIn] of neighborComms) {
          if (comm === currentComm) continue;
          const sigmaTot = commDegrees.get(comm) || 0;
          // Modularity gain for moving node from currentComm to comm
          // ΔQ = [kiIn - kiInCurrent]/(2m) + [ki * (sigmaTotCurrent - sigmaTot)]/(4m^2)
          const gain = (kiIn - kiInCurrent) / (2 * m) + (ki * (sigmaTotCurrent - sigmaTot)) / (4 * m * m);
          if (gain > bestGain) {
            bestGain = gain;
            bestComm = comm;
          }
        }

        if (bestComm !== currentComm) {
          communities.set(node, bestComm);
          improved = true;
        }
      }
    }

    // Renumber communities to be contiguous
    const commMap = new Map<number, number>();
    let nextId = 0;
    for (const [node, comm] of communities) {
      if (!commMap.has(comm)) {
        commMap.set(comm, nextId++);
      }
      communities.set(node, commMap.get(comm)!);
    }

    return communities;
  }

  private countTotalEdges(): number {
    let count = 0;
    for (const set of this.outEdges.values()) {
      count += set.size;
    }
    return count;
  }

  private ensureNode(path: string): void {
    if (!this.nodes.has(path)) {
      this.addNode({
        path,
        title: path,
        aliases: [],
        tags: [],
        frontmatter: {},
        outbound: [],
        inbound: [],
        isOrphan: true,
        isDeadend: false,
        hasUnresolvedLinks: false,
      });
    }
  }
}
