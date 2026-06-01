// v0.1b:
import { AIAgent } from './base.js';
import type { AIResult } from '../../../shared/types.js';

export interface EnrichInput {
  title: string;
  content: string;
  existingFrontmatter: Record<string, unknown>;
  relatedConcepts: string[];
}

export interface EnrichOutput {
  summary: string;
  keyPoints: string[];
  suggestedTags: string[];
  relatedLinks: string[];
  questions: string[];
}

export class EnrichAgent extends AIAgent<EnrichInput, EnrichOutput> {
  getSystemPrompt(): string {
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
    return 'medium' as const;
  }

  async execute(input: EnrichInput): Promise<AIResult<EnrichOutput>> {
    return super.execute(input);
  }
}
