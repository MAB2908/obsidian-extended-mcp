// v0.2b:
import type { LLMRequest, AIResult, TaskComplexity, ModelCapability } from '../../shared/types.js';
import { createHash } from 'crypto';
import { llmConfig } from '../../shared/config.js';
import { ModelAwareBackupService } from '../../shared/ModelAwareBackupService.js';
import type { AuditLogger } from '../../security/AuditLogger.js';

export type { LLMRequest } from '../../shared/types.js';

export interface LLMProvider {
  name: string;
  model: string;
  readonly capabilities?: readonly ModelCapability[];
  generate<T>(request: LLMRequest): Promise<AIResult<T>>;
  isAvailable(): Promise<boolean>;
}

interface CacheEntry {
  result: unknown;
  timestamp: number;
}

export class LLMAdapter {
  private providers = new Map<string, LLMProvider>();
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<AIResult<unknown>>>();
  private readonly maxCacheSize = llmConfig.maxCacheSize;
  private defaultProvider: string;
  private mabs?: ModelAwareBackupService;
  private audit?: AuditLogger;

  constructor(defaultProvider?: string) {
    this.defaultProvider = defaultProvider || llmConfig.defaultProvider;
  }

  attachAuditLogger(audit: AuditLogger): void {
    this.audit = audit;
  }

  /** Attach Model-Aware Backup Service for automatic model profiling */
  attachBackupService(mabs: ModelAwareBackupService): void {
    this.mabs = mabs;
  }

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    // Auto-register model profile if backup service attached
    if (this.mabs) {
      this.mabs.registerModelProfile({
        provider: provider.name,
        model: provider.model,
        label: `${provider.name}/${provider.model}`,
        capabilities: provider.capabilities ?? ['chat'],
        parameters: {},
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.audit?.log({ event: 'warn', tool: 'llm_register_profile', message: `MABS profile registration failed: ${msg}`, blocked: false });
      });
    }
  }

  async generate<T>(request: LLMRequest, complexity: TaskComplexity = 'medium'): Promise<AIResult<T>> {
    const providerName = await this.selectProvider(complexity);
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`LLM provider not found: ${providerName}`);
    }

    const cacheKey = this.hashRequest(request, providerName);

    // RC-005: Deduplicate in-flight requests with the same cache key
    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing as Promise<AIResult<T>>;
    }

    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return { ...(cached.result as AIResult<T>), durationMs: 0 };
    }
    if (cached) {
      this.cache.delete(cacheKey);
    }

    const promise = this.executeGeneration<T>(request, providerName, provider, cacheKey, complexity);
    this.inFlight.set(cacheKey, promise as Promise<AIResult<unknown>>);

    try {
      const result = await promise;
      return result;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async executeGeneration<T>(
    request: LLMRequest,
    providerName: string,
    provider: LLMProvider,
    cacheKey: string,
    complexity: TaskComplexity
  ): Promise<AIResult<T>> {
    // Set current model for MABS context tracking
    if (this.mabs) {
      const profileId = `model-${providerName}/${provider.model}`.toLowerCase().replace(/[^a-z0-9\/._-]/g, '_');
      this.mabs.setCurrentModel(profileId);
    }

    let lastError: unknown = new Error(`LLM provider ${providerName} failed: maxRetries=${llmConfig.maxRetries} reached`);
    for (let attempt = 1; attempt <= llmConfig.maxRetries; attempt++) {
      try {
        const start = Date.now();
        const result = await provider.generate<T>(request);
        result.durationMs = Date.now() - start;
        this.setCache(cacheKey, result);

        // Snapshot session context if MABS attached (fire-and-forget with timeout)
        if (this.mabs) {
          const snapshotPromise = this.mabs.snapshotSessionContext('llm-generation', {
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
          });
          Promise.race([
            snapshotPromise,
            new Promise<void>((_, reject) => setTimeout(() => reject(new Error('MABS snapshot timeout')), 5000)),
          ]).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[LLMAdapter] MABS snapshot failed: ${msg}`);
            this.audit?.log({ event: 'warn', tool: 'llm_snapshot', message: `MABS session snapshot failed: ${msg}`, blocked: false });
          });
        }

        return result;
      } catch (e) {
        lastError = e;
        if (!this.isRetryableError(e)) {
          break;
        }
        // Use longer delay for connection errors to allow pool recovery
        const errMsg = e instanceof Error ? e.message : String(e);
        const isConnectionError = errMsg.includes('SocketError') || errMsg.includes('fetch failed') || errMsg.includes('ECONN');
        const delayMs = isConnectionError
          ? 5000 * Math.pow(2, attempt - 1)
          : llmConfig.retryBaseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw lastError;
  }

  private isRetryableError(err: unknown): boolean {
    if (err && typeof err === 'object') {
      const ex = err as { status?: number; code?: string };
      if (typeof ex.status === 'number') {
        return ex.status >= 500 || ex.status === 429;
      }
      if (typeof ex.code === 'string') {
        return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'].includes(ex.code);
      }
    }
    return true;
  }

  private async selectProvider(complexity: TaskComplexity): Promise<string> {
    // Always prefer default provider if available (avoids timeouts on misconfigured providers)
    const defaultProvider = this.providers.get(this.defaultProvider);
    if (defaultProvider && (await defaultProvider.isAvailable().catch(() => false))) {
      return this.defaultProvider;
    }

    // Fallback priorities by complexity
    const candidates: Record<TaskComplexity, string[]> = {
      light: ['ollama', 'anthropic', 'openai'],
      medium: ['anthropic', 'openai', 'ollama'],
      heavy: ['openai', 'anthropic', 'ollama'],
    };
    for (const name of candidates[complexity] ?? candidates.medium) {
      if (name === this.defaultProvider) continue; // already checked above
      const provider = this.providers.get(name);
      if (provider && (await provider.isAvailable().catch(() => false))) {
        return name;
      }
    }
    return this.defaultProvider;
  }

  private hashRequest(request: LLMRequest, provider: string): string {
    const payload = JSON.stringify({ messages: request.messages, temp: request.temperature, provider });
    return createHash('sha256').update(payload).digest('hex');
  }

  private setCache(key: string, result: unknown): void {
    if (this.cache.size >= this.maxCacheSize) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < llmConfig.cacheTtlMs;
  }
}
