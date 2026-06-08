// v0.2b:
import { llmConfig } from '../../shared/config.js';
export class OllamaEmbeddingProvider {
    name = 'ollama-embed';
    baseUrl;
    model;
    constructor(baseUrl = llmConfig.ollamaBaseUrl, model = llmConfig.ollamaModel || 'nomic-embed-text') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.model = model;
    }
    async isAvailable() {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
    async embed(texts) {
        if (texts.length === 0)
            return [];
        const res = await fetch(`${this.baseUrl}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.model, input: texts }),
        });
        if (!res.ok) {
            throw new Error(`Ollama embed error: ${res.status}`);
        }
        const json = await res.json();
        return json.embeddings;
    }
}
export class OpenAIEmbeddingProvider {
    name = 'openai-embed';
    apiKey;
    model;
    baseUrl;
    constructor(apiKey, model = llmConfig.openAiModel || 'text-embedding-3-small', baseUrl = 'https://api.openai.com/v1') {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
    }
    async isAvailable() {
        try {
            const res = await fetch(`${this.baseUrl}/models`, {
                headers: { Authorization: `Bearer ${this.apiKey}` },
            });
            return res.ok;
        }
        catch {
            return false;
        }
    }
    async embed(texts) {
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
        const json = await res.json();
        return json.data.map((d) => d.embedding);
    }
}
//# sourceMappingURL=EmbeddingProvider.js.map