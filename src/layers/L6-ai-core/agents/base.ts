// v0.1b:
import type { LLMAdapter } from '../LLMAdapter.js';
import type { AIResult, TaskComplexity, LLMMessage } from '../../../shared/types.js';

export abstract class AIAgent<TInput, TOutput> {
  protected adapter: LLMAdapter;

  constructor(adapter: LLMAdapter) {
    this.adapter = adapter;
  }

  abstract getSystemPrompt(): string;
  abstract getTaskComplexity(): TaskComplexity;

  protected buildMessages(input: TInput): LLMMessage[] {
    return [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: JSON.stringify(input) },
    ];
  }

  async execute(input: TInput): Promise<AIResult<TOutput>> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.adapter.generate<TOutput>(
          { messages: this.buildMessages(input), temperature: 0.3 },
          this.getTaskComplexity()
        );
      } catch (e) {
        lastError = e;
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    throw lastError;
  }
}
