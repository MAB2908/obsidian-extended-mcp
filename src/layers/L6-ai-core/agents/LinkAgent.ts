// v0.2b:
import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';

export interface LinkInput {
  content: string;
  title: string;
  availableConcepts: string[];
}

export interface LinkOutput {
  suggestions: Array<{ phrase: string; target: string; confidence: number }>;
}

export class LinkAgent extends AIAgent<LinkInput, LinkOutput> {
  getSystemPrompt(): string {
    return `You are a Link Agent. Find unlinked mentions of concepts in a note and suggest wikilinks.
Respond with valid JSON only.
Output schema:
{
  "suggestions": [{"phrase": "string", "target": "string", "confidence": number}]
}`;
  }

  getTaskComplexity() {
    return 'medium' as const;
  }

  async execute(input: LinkInput): Promise<AIResult<LinkOutput>> {
    return super.execute(input);
  }
}
