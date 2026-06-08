import { AIAgent } from './base.js';
import type { AIResult, LintReport } from '../../../shared/types.js';
export interface LintInput {
    orphans: string[];
    deadends: string[];
    unresolved: Array<{
        link: string;
        source: string;
        line: number;
    }>;
    staleMocs: string[];
    oldSeedlings: string[];
    duplicateTitles: Array<{
        title: string;
        paths: string[];
    }>;
    invalidTags: Array<{
        tag: string;
        file: string;
    }>;
    ontology: string[];
}
export declare class LintAgent extends AIAgent<LintInput, LintReport> {
    getSystemPrompt(): string;
    getTaskComplexity(): "medium";
    execute(input: LintInput): Promise<AIResult<LintReport>>;
}
//# sourceMappingURL=LintAgent.d.ts.map