// v0.2b:
import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';

export interface TagInput {
  title: string;
  content: string;
  existingTags: string[];
  ontology: string[];
}

export interface TagOutput {
  tags: string[];
  newTags: string[];
  reasoning: string;
}

export class TagAgent extends AIAgent<TagInput, TagOutput> {
  getSystemPrompt(): string {
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
    return 'light' as const;
  }

  async execute(input: TagInput): Promise<AIResult<TagOutput>> {
    return super.execute(input);
  }
}
