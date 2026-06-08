import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';
export interface EnrichInput {
    title: string;
    content: string;
    existingFrontmatter: Record<string, unknown>;
    relatedConcepts: string[];
}
export interface EnrichOutput {
    summary: string;
    keyPoints: string[];
    suggestedTags: string[];
    relatedLinks: string[];
    questions: string[];
}
export declare class EnrichAgent extends AIAgent<EnrichInput, EnrichOutput> {
    getSystemPrompt(): string;
    getTaskComplexity(): "medium";
    execute(input: EnrichInput): Promise<AIResult<EnrichOutput>>;
}
//# sourceMappingURL=EnrichAgent.d.ts.map