// v0.1b:
import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';

export interface QueryInput {
  question: string;
  contextNotes: Array<{ path: string; title: string; snippet: string }>;
}

export interface QueryOutput {
  answer: string;
  citations: Array<{ path: string; quote: string }>;
  followUpQuestions: string[];
}

export class QueryAgent extends AIAgent<QueryInput, QueryOutput> {
  getSystemPrompt(): string {
    return `You are a Query Agent. Answer the user's question using only the provided context notes.
Respond with valid JSON only.
Output schema:
{
  "answer": "string",
  "citations": [{"path": "string", "quote": "string"}],
  "followUpQuestions": ["string"]
}`;
  }

  getTaskComplexity() {
    return 'heavy' as const;
  }

  async execute(input: QueryInput): Promise<AIResult<QueryOutput>> {
    return super.execute(input);
  }
}
