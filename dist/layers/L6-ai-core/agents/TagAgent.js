// v0.2b:
import { AIAgent } from './base.js';
export class TagAgent extends AIAgent {
    getSystemPrompt() {
        return `You are a Tag Agent. Classify a note using the provided ontology.
Respond with valid JSON only.
Output schema:
{
  "tags": ["string"],
  "newTags": ["string"],
  "reasoning": "string"
}`;
    }
    getTaskComplexity() {
        return 'light';
    }
    async execute(input) {
        return super.execute(input);
    }
}
//# sourceMappingURL=TagAgent.js.map