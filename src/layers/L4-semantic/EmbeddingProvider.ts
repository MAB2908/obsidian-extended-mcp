// v0.1b:
import { llmConfig } from '../../shared/config.js';

export interface EmbeddingProvider {
  name: string;
  embed(texts: string[]): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama-embed';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = llmConfig.ollamaBaseUrl, model = llmConfig.ollamaModel || 'nomic-embed-text') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed error: ${res.status}`);
    }
    const json = await res.json() as { embeddings: number[][] };
    return json.embeddings;
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
