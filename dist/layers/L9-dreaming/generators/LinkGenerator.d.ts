import type { SearchResult } from '../../../shared/types.js';
import type { DreamTopic, LinkCandidate } from '../types.js';
export interface LinkGeneratorOptions {
    threshold?: number;
    maxCandidates?: number;
}
export declare function generateLinkCandidates(topics: DreamTopic[], search: (query: string, limit: number) => SearchResult[], opts?: LinkGeneratorOptions): LinkCandidate[];
//# sourceMappingURL=LinkGenerator.d.ts.map