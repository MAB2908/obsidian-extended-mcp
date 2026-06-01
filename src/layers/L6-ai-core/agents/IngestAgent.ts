// v0.1b:
import { AIAgent } from './base.js';
import type { Note, AIResult } from '../../../shared/types.js';

export interface IngestInput {
  note: Note;
}

export interface IngestOutput {
  title: string;
  summary: string;
  keyIdeas: string[];
  suggestedTags: string[];
  entities: Array<{ name: string; type: string }>;
}

export class IngestAgent extends AIAgent<IngestInput, IngestOutput> {
  getSystemPrompt(): string {
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
    return 'medium' as const;
  }

  async execute(input: IngestInput): Promise<AIResult<IngestOutput>> {
    return super.execute(input);
  }
}
