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
            console.error(`[OllamaEmbeddingProvider] checking availability at ${this.baseUrl}/api/tags`);
            const res = await fetch(`${this.baseUrl}/api/tags`);
            console.error(`[OllamaEmbeddingProvider] availability result: ${res.status}`);
            return res.ok;
        }
        catch (err) {
            console.error(`[OllamaEmbeddingProvider] availability error: ${err.message}`);
            return false;
        }
    }
    async embed(texts) {
        if (texts.length === 0)
            return [];
        const batchSize = 32;
        const maxChars = 2000;
        const truncated = texts.map((t) => (t.length <= maxChars ? t : t.slice(0, maxChars)));
        const results = [];
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
            const json = await res.json();
            if (!json.embeddings || json.embeddings.length !== batch.length) {
                throw new Error(`Ollama embed returned ${json.embeddings?.length ?? 0} vectors for ${batch.length} texts`);
            }
            results.push(...json.embeddings);
        }
        return results;
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