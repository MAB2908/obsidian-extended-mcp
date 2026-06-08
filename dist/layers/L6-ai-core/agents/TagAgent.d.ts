import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';
export interface TagInput {
    title: string;
    content: string;
    existingTags: string[];
    ontology: string[];
}
export interface TagOutput {
    tags: string[];
    newTags: string[];
    reasoning: string;
}
export declare class TagAgent extends AIAgent<TagInput, TagOutput> {
    getSystemPrompt(): string;
    getTaskComplexity(): "light";
    execute(input: TagInput): Promise<AIResult<TagOutput>>;
}
//# sourceMappingURL=TagAgent.d.ts.map