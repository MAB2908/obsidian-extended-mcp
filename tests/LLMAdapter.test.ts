// v0.2b:
import { describe, it, expect } from 'vitest';
import { LLMAdapter, type LLMProvider } from '../src/layers/L6-ai-core/LLMAdapter.js';
import type { LLMRequest, AIResult } from '../src/shared/types.js';

const mockProvider: LLMProvider = {
  name: 'mock',
  async isAvailable() {
    return true;
  },
  async generate<T>(request: LLMRequest): Promise<AIResult<T>> {
    const last = request.messages[request.messages.length - 1]?.content || '{}';
    return {
      data: JSON.parse(last) as T,
      confidence: 1,
      reasoning: 'mock',
    };
  },
};

describe('LLMAdapter', () => {
  it('registers and uses provider', async () => {
    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(mockProvider);
    const result = await adapter.generate<number>({
      messages: [{ role: 'user', content: '42' }],
    });
    expect(result.data).toBe(42);
  });

  it('caches identical requests', async () => {
    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(mockProvider);
    const req = { messages: [{ role: 'user', content: '"cached"' }] };
    const r1 = await adapter.generate<string>(req);
    const r2 = await adapter.generate<string>(req);
    expect(r1.data).toBe('cached');
    expect(r2.data).toBe('cached');
    // Second should be instant (duration 0 from cache)
    expect(r2.durationMs).toBe(0);
  });

  it('retries on failure then throws', async () => {
    let calls = 0;
    const failingProvider: LLMProvider = {
      name: 'fail',
      async isAvailable() { return true; },
      async generate<T>(): Promise<AIResult<T>> {
        calls++;
        throw new Error('fail');
      },
    };
    const adapter = new LLMAdapter('fail');
    adapter.registerProvider(failingProvider);
    await expect(adapter.generate({ messages: [] })).rejects.toThrow('fail');
    expect(calls).toBe(3);
  }, 10000);

  it('deduplicates in-flight requests (RC-005)', async () => {
    let calls = 0;
    const slowProvider: LLMProvider = {
      name: 'slow',
      async isAvailable() { return true; },
      async generate<T>(): Promise<AIResult<T>> {
        calls++;
        await new Promise((r) => setTimeout(r, 50));
        return { data: { value: calls } as T, confidence: 1, reasoning: 'slow' };
      },
    };
    const adapter = new LLMAdapter('slow');
    adapter.registerProvider(slowProvider);
    const req = { messages: [{ role: 'user', content: '{}' }] };

    // Fire two identical requests concurrently
    const [r1, r2] = await Promise.all([
      adapter.generate<Record<string, never>>(req),
      adapter.generate<Record<string, never>>(req),
    ]);

    // Only one actual provider call should have been made
    expect(calls).toBe(1);
    expect(r1.data).toEqual(r2.data);
  });
});
