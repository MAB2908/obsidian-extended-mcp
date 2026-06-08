import type { LLMAdapter } from '../LLMAdapter.js';
import type { AIResult, TaskComplexity, LLMMessage } from '../../../shared/types.js';
export declare abstract class AIAgent<TInput, TOutput> {
    protected adapter: LLMAdapter;
    constructor(adapter: LLMAdapter);
    abstract getSystemPrompt(): string;
    abstract getTaskComplexity(): TaskComplexity;
    protected buildMessages(input: TInput): LLMMessage[];
    execute(input: TInput): Promise<AIResult<TOutput>>;
}
//# sourceMappingURL=base.d.ts.map