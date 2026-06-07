// v0.2b:
import { describe, it, expect, vi } from 'vitest';
import { AnthropicProvider } from '../src/layers/L6-ai-core/providers/AnthropicProvider.js';
import { LLMProviderError } from '../src/shared/errors.js';

describe('AnthropicProvider', () => {
  const provider = new AnthropicProvider({ apiKey: 'test-key', model: 'claude-3-haiku' });

  it('isAvailable returns true on OK', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    expect(await provider.isAvailable()).toBe(true);
  });

  it('isAvailable returns false on error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fail'));
    expect(await provider.isAvailable()).toBe(false);
  });

  it('generate parses JSON response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"answer": 42}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    } as Response);

    const result = await provider.generate({ messages: [] });
    expect(result.data).toEqual({ answer: 42 });
    expect(result.tokensUsed).toBe(15);
  });

  it('generate throws on error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' } as Response);
    await expect(provider.generate({ messages: [] })).rejects.toThrow(LLMProviderError);
  });
});
