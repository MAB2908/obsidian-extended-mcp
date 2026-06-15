import type { SearchResult } from '../../../shared/types.js';
import type { DreamTopic, MergeCandidate } from '../types.js';
export interface MergeGeneratorOptions {
    threshold?: number;
    maxCandidates?: number;
}
export declare function generateMergeCandidates(topics: DreamTopic[], search: (query: string, limit: number) => SearchResult[], opts?: MergeGeneratorOptions): MergeCandidate[];
//# sourceMappingURL=MergeGenerator.d.ts.map