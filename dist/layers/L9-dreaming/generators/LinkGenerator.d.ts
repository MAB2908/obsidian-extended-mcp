import type { IBM25Engine } from '../../../shared/interfaces/IBM25Engine.js';
import type { DreamTopic, LinkCandidate } from '../types.js';
export interface LinkGeneratorOptions {
    threshold?: number;
    maxCandidates?: number;
}
export declare function generateLinkCandidates(topics: DreamTopic[], bm25: IBM25Engine, opts?: LinkGeneratorOptions): LinkCandidate[];
//# sourceMappingURL=LinkGenerator.d.ts.map