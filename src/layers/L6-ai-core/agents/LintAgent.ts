// v0.2b:
import { AIAgent } from './base.js';
import type { AIResult, LintReport } from '../../../shared/types.js';

export interface LintInput {
  orphans: string[];
  deadends: string[];
  unresolved: Array<{ link: string; source: string; line: number }>;
  staleMocs: string[];
  oldSeedlings: string[];
  duplicateTitles: Array<{ title: string; paths: string[] }>;
  invalidTags: Array<{ tag: string; file: string }>;
  ontology: string[];
}

export class LintAgent extends AIAgent<LintInput, LintReport> {
  getSystemPrompt(): string {
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
    return 'medium' as const;
  }

  async execute(input: LintInput): Promise<AIResult<LintReport>> {
    return super.execute(input);
  }
}
