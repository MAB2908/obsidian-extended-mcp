// v0.1b:
import { describe, it, expect } from 'vitest';
import { LLMAdapter } from '../../src/layers/L6-ai-core/LLMAdapter.js';
import {
  IngestAgent,
  QueryAgent,
  TagAgent,
  CompileAgent,
  LinkAgent,
  LintAgent,
  EnrichAgent,
} from '../../src/layers/L6-ai-core/agents/index.js';
import type { LLMProvider, LLMRequest, AIResult } from '../../src/shared/types.js';

class TestProvider implements LLMProvider {
  name = 'test';
  constructor(private response: unknown) {}
  async isAvailable(): Promise<boolean> {
    return true;
  }
  async generate<T>(request: LLMRequest): Promise<AIResult<T>> {
    return {
      data: this.response as T,
      confidence: 0.9,
      reasoning: 'test',
      tokensUsed: 10,
      durationMs: 1,
    };
  }
}

describe('AI Agents', () => {
  const agentCases = [
    {
      name: 'IngestAgent',
      AgentClass: IngestAgent,
      input: {
        note: {
          path: 'test.md',
          title: 'Test',
          content: '# Test\n\nContent',
          tags: [],
          frontmatter: {},
          outboundLinks: [],
          inboundLinks: [],
        },
      },
      response: {
        title: 'Test Title',
        summary: 'Summary text',
        keyIdeas: ['Idea 1', 'Idea 2'],
        suggestedTags: ['concept', 'ai'],
        entities: [{ name: 'Entity', type: 'concept' }],
      },
      assertions: (data: any) => {
        expect(data.title).toBe('Test Title');
        expect(data.summary).toBe('Summary text');
        expect(data.keyIdeas).toHaveLength(2);
      },
    },
    {
      name: 'QueryAgent',
      AgentClass: QueryAgent,
      input: {
        question: 'What is AI?',
        contextNotes: [{ path: 'notes/a.md', title: 'AI', snippet: 'AI is...' }],
      },
      response: {
        answer: 'Answer text',
        citations: [{ path: 'notes/a.md', quote: 'Quote' }],
        followUpQuestions: ['Q1'],
      },
      assertions: (data: any) => {
        expect(data.answer).toBe('Answer text');
        expect(data.citations).toHaveLength(1);
      },
    },
    {
      name: 'CompileAgent',
      AgentClass: CompileAgent,
      input: { sources: [], existingConcepts: [], graphSnapshot: '{}', ontology: [] },
      response: {
        newConcepts: [{ file: 'concepts/ai.md', title: 'AI', content: '# AI', links: ['ml'], domain: 'cs' }],
        updatedConcepts: [],
        updatedMocs: [{ file: 'moc/ai.md', appendTo: '## Concepts', content: '- [[ai]]' }],
        orphanedSources: [],
      },
      assertions: (data: any) => {
        expect(data.newConcepts).toHaveLength(1);
        expect(data.updatedMocs).toHaveLength(1);
      },
    },
    {
      name: 'LinkAgent',
      AgentClass: LinkAgent,
      input: { content: 'Neural networks are...', title: 'AI', availableConcepts: ['neural-networks'] },
      response: { suggestions: [{ phrase: 'neural networks', target: 'neural-networks', confidence: 0.85 }] },
      assertions: (data: any) => {
        expect(data.suggestions).toHaveLength(1);
        expect(data.suggestions[0].confidence).toBe(0.85);
      },
    },
    {
      name: 'LintAgent',
      AgentClass: LintAgent,
      input: {
        orphans: [], deadends: [], unresolved: [], staleMocs: [],
        oldSeedlings: [], duplicateTitles: [], invalidTags: [], ontology: [],
      },
      response: {
        critical: [],
        warnings: [{ description: 'Broken link', file: 'a.md', suggestedAction: 'fix' }],
        recommendations: [],
        suggestedEdits: [],
      },
      assertions: (data: any) => {
        expect(data.warnings).toHaveLength(1);
      },
    },
    {
      name: 'EnrichAgent',
      AgentClass: EnrichAgent,
      input: { title: 'Note', content: 'Content', existingFrontmatter: {}, relatedConcepts: ['concept'] },
      response: {
        summary: 'Enriched summary',
        keyPoints: ['Point 1'],
        suggestedTags: ['enriched'],
        relatedLinks: ['concept'],
        questions: ['Q?'],
      },
      assertions: (data: any) => {
        expect(data.summary).toBe('Enriched summary');
        expect(data.keyPoints).toHaveLength(1);
      },
    },
  ];

  it.each(agentCases)('$name returns structured output', async ({ AgentClass, input, response, assertions }) => {
    const adapter = new LLMAdapter('test');
    adapter.registerProvider(new TestProvider(response));
    const agent = new AgentClass(adapter);
    const result = await agent.execute(input);
    assertions(result.data);
  });

  it('TagAgent returns tags and newTags', async () => {
    const adapter = new LLMAdapter('test');
    adapter.registerProvider({
      name: 'test',
      async isAvailable() {
        return true;
      },
      async generate<T>(request: LLMRequest): Promise<AIResult<T>> {
        return {
          data: { tags: ['ai', 'ml'], newTags: ['deep-learning'], reasoning: 'test' } as T,
          confidence: 0.9,
          reasoning: 'test',
          tokensUsed: 10,
          durationMs: 1,
        };
      },
    });
    const agent = new TagAgent(adapter);
    const result = await agent.execute({
      title: 'Neural Networks',
      content: '# NN\n\nDeep learning...',
      existingTags: ['ai'],
      ontology: ['ai', 'ml', 'nlp'],
    });
    expect(result.data.tags).toContain('ai');
    expect(result.data.newTags).toContain('deep-learning');
  });
});
