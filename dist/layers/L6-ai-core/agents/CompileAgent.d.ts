import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';
export interface CompileInput {
    sources: Array<{
        path: string;
        title: string;
        content: string;
        tags: string[];
        frontmatter: Record<string, unknown>;
        created?: Date;
    }>;
    existingConcepts: string[];
    graphSnapshot: string;
    ontology: string[];
}
export interface ConceptEdit {
    file: string;
    title: string;
    content: string;
    links: string[];
    domain: string;
}
export interface MocEdit {
    file: string;
    appendTo: string;
    content: string;
}
export interface CompileOutput {
    newConcepts: ConceptEdit[];
    updatedConcepts: Array<{
        file: string;
        appendTo: string;
        content: string;
    }>;
    updatedMocs: MocEdit[];
    orphanedSources: string[];
}
export declare class CompileAgent extends AIAgent<CompileInput, CompileOutput> {
    getSystemPrompt(): string;
    getTaskComplexity(): "heavy";
    execute(input: CompileInput): Promise<AIResult<CompileOutput>>;
}
//# sourceMappingURL=CompileAgent.d.ts.map