// v0.2b:
import { AIAgent } from './base.js';
export class QueryAgent extends AIAgent {
    getSystemPrompt() {
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
        return 'heavy';
    }
    async execute(input) {
        return super.execute(input);
    }
}
//# sourceMappingURL=QueryAgent.js.map