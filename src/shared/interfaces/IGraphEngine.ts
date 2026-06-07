// v0.2b:
import type { GraphNode, GraphEdge, Graph } from '../types.js';

export interface IGraphEngine {
  addNode(node: GraphNode): void;
  addEdge(from: string, to: string, type?: GraphEdge['type'], context?: string): void;
  removeNode(path: string): void;
  getNeighbors(path: string, direction?: 'both' | 'in' | 'out'): string[];
  getPath(from: string, to: string, maxDepth?: number): string[] | null;
  getGraph(): Graph;
  serialize(): unknown;
  load(data: unknown): void;
  computePageRank(iterations?: number, damping?: number): Map<string, number>;
  detectCommunities(maxPasses?: number): Map<string, number>;
}
