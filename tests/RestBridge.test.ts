// v0.2b:
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestBridge } from '../src/layers/L2b-rest/RestBridge.js';
import { RestAuthError, RestError, RestNotFoundError, RestTimeoutError } from '../src/shared/errors.js';

describe('RestBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isAvailable returns true when server responds', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    expect(await bridge.isAvailable()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:27123/', expect.any(Object));
  });

  it('isAvailable returns false on network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    expect(await bridge.isAvailable()).toBe(false);
  });

  it('activeNote returns parsed note', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'daily.md', content: '# Daily Note' }),
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'https://localhost:27123', token: 'secret' });
    const note = await bridge.activeNote();
    expect(note?.path).toBe('daily.md');
    expect(note?.content).toBe('# Daily Note');
  });

  it('activeNote returns null on error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const note = await bridge.activeNote();
    expect(note).toBeNull();
  });

  it('activeNoteContent returns content string', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'daily.md', content: '# Daily Note' }),
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const content = await bridge.activeNoteContent();
    expect(content).toBe('# Daily Note');
  });

  it('getNote returns path, content, and frontmatter', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'notes/foo.md', content: 'body', frontmatter: { tags: ['a'] } }),
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const result = await bridge.getNote('notes/foo.md');
    expect(result).toEqual({ path: 'notes/foo.md', content: 'body', frontmatter: { tags: ['a'] } });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:27123/vault/notes%2Ffoo.md',
      expect.objectContaining({ signal: expect.any(Object) })
    );
  });

  it('writeNote posts content', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    await bridge.writeNote('notes/foo.md', '# Hello');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:27123/vault/notes%2Ffoo.md',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: '# Hello' }),
      })
    );
  });

  it('deleteNote sends DELETE', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    await bridge.deleteNote('notes/foo.md');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:27123/vault/notes%2Ffoo.md',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('listTags returns tag array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ['a', 'b'],
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const tags = await bridge.listTags();
    expect(tags).toEqual(['a', 'b']);
  });

  it('executeCommand posts to commands endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    await bridge.executeCommand('app:reload');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:27123/commands/app%3Areload/',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('search returns results', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ path: 'a.md', score: 1.2 }],
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const result = await bridge.search('foo');
    expect(result).toEqual([{ path: 'a.md', score: 1.2 }]);
  });

  it('executeDataview returns JSON', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ values: [['A', 'B']] }),
    } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    const result = await bridge.executeDataview('TABLE file.name FROM ""');
    expect(result).toEqual({ values: [['A', 'B']] });
  });

  it('executeDataview throws RestError on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    await expect(bridge.executeDataview('BAD')).rejects.toThrow(RestError);
  });

  it('throws RestNotFoundError on 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    await expect(bridge.getNote('missing.md')).rejects.toThrow(RestNotFoundError);
  });

  it('throws RestAuthError on 401/403', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123' });
    await expect(bridge.listTags()).rejects.toThrow(RestAuthError);
  });

  it('throws RestTimeoutError on timeout', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new DOMException('Timeout', 'AbortError'));
    const bridge = new RestBridge({ baseUrl: 'http://localhost:27123', timeoutMs: 1 });
    await expect(bridge.search('slow')).rejects.toThrow(RestTimeoutError);
  });
});
