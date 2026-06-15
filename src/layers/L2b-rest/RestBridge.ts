// v0.2b:
import type { ILayer2bRestBridge, Note } from '../../shared/types.js';
import { RestAuthError, RestError, RestNotFoundError, RestQueryError, RestTimeoutError } from '../../shared/errors.js';

export interface RestBridgeConfig {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
}

export class RestBridge implements ILayer2bRestBridge {
  private baseUrl: string;
  private token?: string;
  private timeoutMs: number;

  constructor(config: RestBridgeConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.timeoutMs = config.timeoutMs ?? 30000;
    if (this.token && !this.baseUrl.startsWith('https://')) {
      throw new RestQueryError('REST_API_REQUIRES_TLS', 'REST API token requires HTTPS connection');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchSafe('/');
      return res.ok;
    } catch {
      return false;
    }
  }

  async activeNote(): Promise<Note | null> {
    const res = await this.fetchSafe('/active/');
    if (!res.ok) return null;
    const data = await res.json() as { path: string; content: string };
    return {
      path: data.path,
      content: data.content,
      frontmatter: {},
      title: data.path,
      tags: [],
      outboundLinks: [],
      inboundLinks: [],
    };
  }

  async activeNoteContent(): Promise<string> {
    const data = await this.fetchJson<{ content?: string }>('/active/');
    return data.content ?? '';
  }

  async getNote(path: string): Promise<{ path: string; content: string; frontmatter: Record<string, unknown> }> {
    return this.fetchJson<{ path: string; content: string; frontmatter: Record<string, unknown> }>(`/vault/${encodeURIComponent(path)}`);
  }

  async writeNote(path: string, content: string): Promise<void> {
    await this.fetchOk(`/vault/${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  }

  async deleteNote(path: string): Promise<void> {
    await this.fetchOk(`/vault/${encodeURIComponent(path)}`, { method: 'DELETE' });
  }

  async listTags(): Promise<string[]> {
    return this.fetchJson<string[]>('/tags/');
  }

  async executeCommand(commandId: string): Promise<void> {
    await this.fetchOk(`/commands/${encodeURIComponent(commandId)}/`, { method: 'POST' });
  }

  async search(query: string): Promise<Array<{ path: string; score: number }>> {
    return this.fetchJson<Array<{ path: string; score: number }>>('/search/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
  }

  async executeDataview(query: string): Promise<unknown> {
    return this.fetchJson<unknown>('/dataview/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchOk(path, init);
    return res.json() as Promise<T>;
  }

  private async fetchOk(path: string, init?: RequestInit): Promise<Response> {
    const res = await this.fetchSafe(path, init);
    if (!res.ok) {
      if (res.status === 404) throw new RestNotFoundError(path);
      if (res.status === 401 || res.status === 403) throw new RestAuthError(String(res.status));
      throw new RestError('E300', `REST request failed: ${res.status} ${res.statusText}`);
    }
    return res;
  }

  private async fetchSafe(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { ...this.authHeaders(), ...(init?.headers || {}) },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new RestTimeoutError(this.timeoutMs);
      }
      throw err;
    }
  }
}
