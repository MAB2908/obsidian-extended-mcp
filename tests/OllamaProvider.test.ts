// v0.2b:
import { describe, it, expect, vi } from 'vitest';
import { OllamaProvider } from '../src/layers/L6-ai-core/providers/OllamaProvider.js';
import { LLMProviderError } from '../src/shared/errors.js';

describe('OllamaProvider', () => {
  const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'llama3.1' });

  it('isAvailable returns true on OK', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    expect(await provider.isAvailable()).toBe(true);
  });

  it('isAvailable returns false on error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await provider.isAvailable()).toBe(false);
  });

  it('generate parses JSON response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: '{"result": "ok"}' },
        prompt_eval_count: 20,
        eval_count: 10,
      }),
    } as Response);

    const result = await provider.generate({ messages: [] });
    expect(result.data).toEqual({ result: 'ok' });
    expect(result.tokensUsed).toBe(30);
  });

  it('generate throws on error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'fail' } as Response);
    await expect(provider.generate({ messages: [] })).rejects.toThrow(LLMProviderError);
  });

  it('sends Authorization header when apiKey is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{}' }, prompt_eval_count: 1, eval_count: 1 }),
    } as Response);
    global.fetch = fetchMock;

    const authProvider = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'llama3.1', apiKey: 'test-key-123' });
    await authProvider.isAvailable();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-key-123' } })
    );

    await authProvider.generate({ messages: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key-123' }) })
    );
  });
});
