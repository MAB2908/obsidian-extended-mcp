// v0.2b:
import type { LLMProvider, LLMRequest, AIResult } from '../../src/shared/types.js';

function isIngest(messages: Array<{ role: string; content: string }>): boolean {
  return messages.some((m) => m.content.includes('Ingest Agent'));
}

function isCompile(messages: Array<{ role: string; content: string }>): boolean {
  return messages.some((m) => m.content.includes('Compile Agent'));
}

function isLint(messages: Array<{ role: string; content: string }>): boolean {
  return messages.some((m) => m.content.includes('Lint Agent'));
}

function isQuery(messages: Array<{ role: string; content: string }>): boolean {
  return messages.some((m) => m.content.includes('Query Agent'));
}

export class MockLLMProvider implements LLMProvider {
  name = 'mock';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate<T>(request: LLMRequest): Promise<AIResult<T>> {
    const messages = request.messages;

    if (isIngest(messages)) {
      return {
        data: {
          title: 'Mock Ingested Title',
          summary: 'Mock summary of the note.',
          keyIdeas: ['Idea 1', 'Idea 2', 'Idea 3'],
          suggestedTags: ['concept', 'ai', 'ml'],
          entities: [{ name: 'MockEntity', type: 'concept' }],
        } as unknown as T,
        confidence: 0.95,
        reasoning: 'mock ingest',
        tokensUsed: 50,
        durationMs: 10,
      };
    }

    if (isCompile(messages)) {
      return {
        data: {
          newConcepts: [
            {
              file: 'concepts/transformers.md',
              title: 'Transformers',
              content: '# Transformers\n\nModern architecture replacing RNN.',
              links: ['neural-networks', 'attention-mechanism'],
              domain: 'ai',
            },
          ],
          updatedConcepts: [],
          updatedMocs: [
            {
              file: 'index/MOC-ai.md',
              appendTo: '## Основные концепции',
              content: '- [[transformers]] — современная архитектура',
            },
          ],
          orphanedSources: [],
        } as unknown as T,
        confidence: 0.9,
        reasoning: 'mock compile',
        tokensUsed: 100,
        durationMs: 10,
      };
    }

    if (isLint(messages)) {
      return {
        data: {
          critical: [],
          warnings: [
            { description: 'Unresolved link: gradient-descent', file: 'concepts/neural-networks.md', suggestedAction: 'Create concept note or remove link' },
          ],
          recommendations: [
            { description: '2 orphan notes found', suggestedAction: 'Link meeting-notes and inbox-thought to relevant concepts' },
          ],
          suggestedEdits: [],
        } as unknown as T,
        confidence: 0.85,
        reasoning: 'mock lint',
        tokensUsed: 60,
        durationMs: 10,
      };
    }

    if (isQuery(messages)) {
      return {
        data: {
          answer: 'Transformers are a modern neural network architecture that uses self-attention mechanisms. They are described in [[attention-mechanism]] and [[raw/2026-05-20-article-transformers.md]].',
          citations: [
            { path: 'concepts/attention-mechanism.md', quote: 'Механизм внимания позволяет модели фокусироваться' },
          ],
          followUpQuestions: ['How do transformers compare to RNNs?'],
        } as unknown as T,
        confidence: 0.92,
        reasoning: 'mock query',
        tokensUsed: 80,
        durationMs: 10,
      };
    }

    // Fallback for TagAgent, LinkAgent, EnrichAgent
    return {
      data: {} as unknown as T,
      confidence: 0.5,
      reasoning: 'mock fallback',
      tokensUsed: 10,
      durationMs: 10,
    };
  }
}
