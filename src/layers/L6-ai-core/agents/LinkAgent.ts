// v0.2b:
import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';

export interface LinkInput {
  content: string;
  title: string;
  availableTargets: string[];
}

export interface LinkOutput {
  suggestions: Array<{ phrase: string; target: string; confidence: number }>;
}

export class LinkAgent extends AIAgent<LinkInput, LinkOutput> {
  getSystemPrompt(): string {
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
    return 'medium' as const;
  }

  async execute(input: LinkInput): Promise<AIResult<LinkOutput>> {
    return super.execute(input);
  }
}
