// v0.2b:
import { AIAgent } from './base.js';
export class LintAgent extends AIAgent {
    getSystemPrompt() {
        return `You are a Lint Agent. Analyze vault health and return a structured report.
Respond with valid JSON only.
Output schema:
{
  "critical": [{"description": "string", "file": "string", "line": number, "suggestedAction": "string"}],
  "warnings": [{"description": "string", "file": "string", "suggestedAction": "string"}],
  "recommendations": [{"description": "string", "suggestedAction": "string"}],
  "suggestedEdits": [{"file": "string", "action": "string", "section": "string", "content": "string", "reason": "string", "confidence": number}]
}`;
    }
    getTaskComplexity() {
        return 'medium';
    }
    async execute(input) {
        return super.execute(input);
    }
}
//# sourceMappingURL=LintAgent.js.map