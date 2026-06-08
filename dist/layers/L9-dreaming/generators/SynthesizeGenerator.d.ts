import type { DreamTopic, SynthesizeCandidate } from '../types.js';
export interface SynthesizeGeneratorOptions {
    minNotesPerDomain?: number;
    maxCandidates?: number;
}
export declare function generateSynthesizeCandidates(topics: DreamTopic[], opts?: SynthesizeGeneratorOptions): SynthesizeCandidate[];
//# sourceMappingURL=SynthesizeGenerator.d.ts.map