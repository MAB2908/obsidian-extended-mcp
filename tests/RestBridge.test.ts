// v0.2b:
import { describe, it, expect, vi } from 'vitest';
import { RestBridge } from '../src/layers/L2b-rest/RestBridge.js';
import { RestError } from '../src/shared/errors.js';

describe('RestBridge', () => {
  it('isAvailable returns true when server responds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    expect(await bridge.isAvailable()).toBe(true);
  });

  it('isAvailable returns false on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    expect(await bridge.isAvailable()).toBe(false);
  });

  it('activeNote returns parsed note', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'daily.md', content: '# Daily Note' }),
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'https://localhost:27123', token: 'secret' });
    const note = await bridge.activeNote();
    expect(note?.path).toBe('daily.md');
    expect(note?.content).toBe('# Daily Note');
  });

  it('activeNote returns null on error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const note = await bridge.activeNote();
    expect(note).toBeNull();
  });

  it('executeDataview returns JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ values: [['A', 'B']] }),
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const result = await bridge.executeDataview('TABLE file.name FROM ""');
    expect(result).toEqual({ values: [['A', 'B']] });
  });

  it('executeDataview throws RestError on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    await expect(bridge.executeDataview('BAD')).rejects.toThrow(RestError);
  });
});
