import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { GraphNode, GraphEdge, Graph } from '../../shared/types.js';
export declare class GraphEngine implements IGraphEngine {
    private nodes;
    private outEdges;
    private inEdges;
    addNode(node: GraphNode): void;
    removeNode(path: string): void;
    addEdge(from: string, to: string, _type?: GraphEdge['type'], _context?: string): void;
    removeEdge(from: string, to: string): void;
    getNeighbors(path: string, direction?: 'both' | 'in' | 'out'): string[];
    getPath(from: string, to: string, maxDepth?: number): string[] | null;
    getGraph(): Graph;
    serialize(): unknown;
    load(data: {
        nodes: Record<string, GraphNode>;
        outEdges: Record<string, string[]>;
        inEdges: Record<string, string[]>;
    }): void;
    computePageRank(iterations?: number, damping?: number): Map<string, number>;
    detectCommunities(maxPasses?: number): Map<string, number>;
    private countTotalEdges;
    private ensureNode;
}
//# sourceMappingURL=GraphEngine.d.ts.map