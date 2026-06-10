// v0.2b:
import { AIAgent } from './base.js';
export class LinkAgent extends AIAgent {
    getSystemPrompt() {
        return `You are a Link Agent. Find unlinked mentions of concepts, people, places, or topics in a note and suggest wikilinks to other notes.
You are given a list of available note titles — use ONLY these titles as link targets.
Only suggest links when the mention is clearly related to the target note.
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