import type { IBM25Engine } from '../../../shared/interfaces/IBM25Engine.js';
import type { DreamTopic, MergeCandidate } from '../types.js';
export interface MergeGeneratorOptions {
    threshold?: number;
    maxCandidates?: number;
}
export declare function generateMergeCandidates(topics: DreamTopic[], bm25: IBM25Engine, opts?: MergeGeneratorOptions): MergeCandidate[];
//# sourceMappingURL=MergeGenerator.d.ts.map