import { AIAgent } from './base.js';
import type { Note, AIResult } from '../../../shared/types.js';
export interface IngestInput {
    note: Note;
}
export interface IngestOutput {
    title: string;
    summary: string;
    keyIdeas: string[];
    suggestedTags: string[];
    entities: Array<{
        name: string;
        type: string;
    }>;
}
export declare class IngestAgent extends AIAgent<IngestInput, IngestOutput> {
    getSystemPrompt(): string;
    getTaskComplexity(): "medium";
    execute(input: IngestInput): Promise<AIResult<IngestOutput>>;
}
//# sourceMappingURL=IngestAgent.d.ts.map