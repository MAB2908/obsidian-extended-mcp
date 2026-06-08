import { createHash } from 'crypto';
import { llmConfig } from '../../shared/config.js';
export class LLMAdapter {
    providers = new Map();
    cache = new Map();
    inFlight = new Map();
    maxCacheSize = llmConfig.maxCacheSize;
    defaultProvider;
    mabs;
    audit;
    constructor(defaultProvider) {
        this.defaultProvider = defaultProvider || llmConfig.defaultProvider;
    }
    attachAuditLogger(audit) {
        this.audit = audit;
    }
    /** Attach Model-Aware Backup Service for automatic model profiling */
    attachBackupService(mabs) {
        this.mabs = mabs;
    }
    registerProvider(provider) {
        this.providers.set(provider.name, provider);
        // Auto-register model profile if backup service attached
        if (this.mabs) {
            this.mabs.registerModelProfile({
                provider: provider.name,
                model: provider.model,
                label: `${provider.name}/${provider.model}`,
                capabilities: provider.capabilities ?? ['chat'],
                parameters: {},
            }).catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                this.audit?.log({ event: 'warn', tool: 'llm_register_profile', message: `MABS profile registration failed: ${msg}`, blocked: false });
            });
        }
    }
    async generate(request, complexity = 'medium') {
        const providerName = await this.selectProvider(complexity);
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`LLM provider not found: ${providerName}`);
        }
        const cacheKey = this.hashRequest(request, providerName);
        // RC-005: Deduplicate in-flight requests with the same cache key
        const existing = this.inFlight.get(cacheKey);
        if (existing) {
            return existing;
        }
        const cached = this.cache.get(cacheKey);
        if (cached && this.isCacheValid(cached)) {
            return { ...cached.result, durationMs: 0 };
        }
        if (cached) {
            this.cache.delete(cacheKey);
        }
        // Create the request promise and register it as in-flight
        const promise = this.executeGeneration(request, providerName, provider, cacheKey, complexity);
        this.inFlight.set(cacheKey, promise);
        try {
            const result = await promise;
            return result;
        }
        finally {
            this.inFlight.delete(cacheKey);
        }
    }
    async executeGeneration(request, providerName, provider, cacheKey, complexity) {
        // Set current model for MABS context tracking
        if (this.mabs) {
            const profileId = `model-${providerName}/${provider.model}`.toLowerCase().replace(/[^a-z0-9\/._-]/g, '_');
            this.mabs.setCurrentModel(profileId);
        }
        let lastError = new Error(`LLM provider ${providerName} failed: maxRetries=${llmConfig.maxRetries} reached`);
        for (let attempt = 1; attempt <= llmConfig.maxRetries; attempt++) {
            try {
                const start = Date.now();
                const result = await provider.generate(request);
                result.durationMs = Date.now() - start;
                this.setCache(cacheKey, result);
                // Snapshot session context if MABS attached
                if (this.mabs) {
                    await this.mabs.snapshotSessionContext('llm-generation', {
                        provider: providerName,
                        model: provider.model,
                        requestMessages: request.messages.map((m) => ({ role: m.role, contentLength: m.content.length })),
                        resultConfidence: result.confidence,
                        tokensUsed: result.tokensUsed,
                        durationMs: result.durationMs,
                        complexity,
                    }, {
                        userIntent: request.messages.find((m) => m.role === 'user')?.content.slice(0, 200),
                        replayable: true,
                        profileId: `model-${providerName}/${provider.model}`.toLowerCase().replace(/[^a-z0-9\/._-]/g, '_'),
                    }).catch((err) => {
                        const msg = err instanceof Error ? err.message : String(err);
                        this.audit?.log({ event: 'warn', tool: 'llm_snapshot', message: `MABS session snapshot failed: ${msg}`, blocked: false });
                    });
                }
                return result;
            }
            catch (e) {
                lastError = e;
                if (!this.isRetryableError(e)) {
                    break;
                }
                await new Promise((r) => setTimeout(r, llmConfig.retryBaseDelayMs * Math.pow(2, attempt - 1)));
            }
        }
        throw lastError;
    }
    isRetryableError(err) {
        if (err && typeof err === 'object') {
            const ex = err;
            if (typeof ex.status === 'number') {
                return ex.status >= 500 || ex.status === 429;
            }
            if (typeof ex.code === 'string') {
                return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'].includes(ex.code);
            }
        }
        return true;
    }
    async selectProvider(complexity) {
        // Priority: light -> ollama (local, fast)
        // medium -> anthropic or openai (balanced)
        // heavy -> openai or anthropic (best quality)
        const candidates = {
            light: ['ollama', 'anthropic', 'openai'],
            medium: ['anthropic', 'openai', 'ollama'],
            heavy: ['openai', 'anthropic', 'ollama'],
        };
        for (const name of candidates[complexity] ?? candidates.medium) {
            const provider = this.providers.get(name);
            if (provider && (await provider.isAvailable().catch(() => false))) {
                return name;
            }
        }
        return this.defaultProvider;
    }
    hashRequest(request, provider) {
        const payload = JSON.stringify({ messages: request.messages, temp: request.temperature, provider });
        return createHash('sha256').update(payload).digest('hex');
    }
    setCache(key, result) {
        if (this.cache.size >= this.maxCacheSize) {
            const first = this.cache.keys().next().value;
            if (first !== undefined)
                this.cache.delete(first);
        }
        this.cache.set(key, { result, timestamp: Date.now() });
    }
    isCacheValid(entry) {
        return Date.now() - entry.timestamp < llmConfig.cacheTtlMs;
    }
}
//# sourceMappingURL=LLMAdapter.js.map