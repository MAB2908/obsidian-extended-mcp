// v0.2b:
import { llmConfig } from '../../shared/config.js';

export interface EmbeddingProvider {
  name: string;
  embed(texts: string[]): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama-embed';
  readonly baseUrl: string;
  private model: string;

  constructor(baseUrl = llmConfig.ollamaBaseUrl, model = llmConfig.ollamaModel || 'nomic-embed-text') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      console.error(`[OllamaEmbeddingProvider] checking availability at ${this.baseUrl}/api/tags`);
      const res = await fetch(`${this.baseUrl}/api/tags`);
      console.error(`[OllamaEmbeddingProvider] availability result: ${res.status}`);
      return res.ok;
    } catch (err) {
      console.error(`[OllamaEmbeddingProvider] availability error: ${(err as Error).message}`);
      return false;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const batchSize = 32;
    const maxChars = 2000;
    const truncated = texts.map((t) => (t.length <= maxChars ? t : t.slice(0, maxChars)));
    const results: number[][] = [];
    for (let i = 0; i < truncated.length; i += batchSize) {
      const batch = truncated.slice(i, i + batchSize);
      console.error(`[OllamaEmbeddingProvider] embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(truncated.length / batchSize)} (${batch.length} texts)`);
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: batch }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama embed error: ${res.status} ${body.slice(0, 500)}`);
      }
      const json = await res.json() as { embeddings?: number[][] };
      if (!json.embeddings || json.embeddings.length !== batch.length) {
        throw new Error(`Ollama embed returned ${json.embeddings?.length ?? 0} vectors for ${batch.length} texts`);
      }
      results.push(...json.embeddings);
    }
    return results;
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai-embed';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = llmConfig.openAiModel || 'text-embedding-3-small', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embed error: ${res.status}`);
    }
    const json = await res.json() as { data: Array<{ embedding: number[] }> };
    return json.data.map((d) => d.embedding);
  }
}
