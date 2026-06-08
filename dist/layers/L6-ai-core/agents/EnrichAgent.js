// v0.2b:
import { AIAgent } from './base.js';
export class EnrichAgent extends AIAgent {
    getSystemPrompt() {
        return `You are an Enrich Agent. Enhance an existing note with AI-generated metadata.
Respond with valid JSON only.
Output schema:
{
  "summary": "string",
  "keyPoints": ["string"],
  "suggestedTags": ["string"],
  "relatedLinks": ["string"],
  "questions": ["string"]
}`;
    }
    getTaskComplexity() {
        return 'medium';
    }
    async execute(input) {
        return super.execute(input);
    }
}
//# sourceMappingURL=EnrichAgent.js.map