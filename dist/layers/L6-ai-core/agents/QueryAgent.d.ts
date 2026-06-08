import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';
export interface QueryInput {
    question: string;
    contextNotes: Array<{
        path: string;
        title: string;
        snippet: string;
    }>;
}
export interface QueryOutput {
    answer: string;
    citations: Array<{
        path: string;
        quote: string;
    }>;
    followUpQuestions: string[];
}
export declare class QueryAgent extends AIAgent<QueryInput, QueryOutput> {
    getSystemPrompt(): string;
    getTaskComplexity(): "heavy";
    execute(input: QueryInput): Promise<AIResult<QueryOutput>>;
}
//# sourceMappingURL=QueryAgent.d.ts.map