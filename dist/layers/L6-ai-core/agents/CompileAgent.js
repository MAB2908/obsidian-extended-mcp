// v0.2b:
import { AIAgent } from './base.js';
export class CompileAgent extends AIAgent {
    getSystemPrompt() {
        return `You are a Compile Agent. Synthesize concept notes from source notes.
Respond with valid JSON only.
Output schema:
{
  "newConcepts": [{"file": "string", "title": "string", "content": "string", "links": ["string"], "domain": "string"}],
  "updatedConcepts": [{"file": "string", "appendTo": "string", "content": "string"}],
  "updatedMocs": [{"file": "string", "appendTo": "string", "content": "string"}],
  "orphanedSources": ["string"]
}`;
    }
    getTaskComplexity() {
        return 'heavy';
    }
    async execute(input) {
        return super.execute(input);
    }
}
//# sourceMappingURL=CompileAgent.js.map