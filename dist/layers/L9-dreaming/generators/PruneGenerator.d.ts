import type { DreamTopic, PruneCandidate } from '../types.js';
export interface PruneGeneratorOptions {
    maxCandidates?: number;
    staleDaysDraft?: number;
    staleDaysValidated?: number;
    importanceThreshold?: number;
}
export declare function generatePruneCandidates(topics: DreamTopic[], opts?: PruneGeneratorOptions): PruneCandidate[];
//# sourceMappingURL=PruneGenerator.d.ts.map