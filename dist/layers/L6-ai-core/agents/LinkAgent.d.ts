import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';
export interface LinkInput {
    content: string;
    title: string;
    availableTargets: string[];
}
export interface LinkOutput {
    suggestions: Array<{
        phrase: string;
        target: string;
        confidence: number;
    }>;
}
export declare class LinkAgent extends AIAgent<LinkInput, LinkOutput> {
    getSystemPrompt(): string;
    getTaskComplexity(): "medium";
    execute(input: LinkInput): Promise<AIResult<LinkOutput>>;
}
//# sourceMappingURL=LinkAgent.d.ts.map