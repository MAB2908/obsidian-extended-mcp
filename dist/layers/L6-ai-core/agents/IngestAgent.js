// v0.2b:
import { AIAgent } from './base.js';
export class IngestAgent extends AIAgent {
    getSystemPrompt() {
        return `You are an Ingest Agent. Parse a raw markdown note and extract structured metadata.
Respond with valid JSON only, no markdown formatting.
Output schema:
{
  "title": "string",
  "summary": "string",
  "keyIdeas": ["string"],
  "suggestedTags": ["string"],
  "entities": [{"name": "string", "type": "string"}]
}`;
    }
    getTaskComplexity() {
        return 'medium';
    }
    async execute(input) {
        return super.execute(input);
    }
}
//# sourceMappingURL=IngestAgent.js.map