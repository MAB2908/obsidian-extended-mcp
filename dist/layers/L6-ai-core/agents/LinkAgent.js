// v0.2b:
import { AIAgent } from './base.js';
export class LinkAgent extends AIAgent {
    getSystemPrompt() {
        return `You are a Link Agent. Find unlinked mentions of concepts in a note and suggest wikilinks.
Respond with valid JSON only.
Output schema:
{
  "suggestions": [{"phrase": "string", "target": "string", "confidence": number}]
}`;
    }
    getTaskComplexity() {
        return 'medium';
    }
    async execute(input) {
        return super.execute(input);
    }
}
//# sourceMappingURL=LinkAgent.js.map