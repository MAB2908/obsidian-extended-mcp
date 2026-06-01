// v0.1b:
import type { ILayer2bRestBridge, Note } from '../../shared/types.js';
import { RestQueryError } from '../../shared/errors.js';

export interface RestBridgeConfig {
  baseUrl: string;
  token?: string;
}

export class RestBridge implements ILayer2bRestBridge {
  private baseUrl: string;
  private token?: string;

  constructor(config: RestBridgeConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    if (this.token && !this.baseUrl.startsWith('https://')) {
      throw new RestQueryError('REST_API_REQUIRES_TLS', 'REST API token requires HTTPS connection');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/`, {
        headers: this.authHeaders(),
      });
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

  async executeDataview(query: string): Promise<unknown> {
    const res = await this.fetchSafe('/dataview/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      throw new RestQueryError(query, String(res.status));
    }
    return res.json();
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async fetchSafe(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.authHeaders(), ...(init?.headers || {}) },
    });
    return res;
  }
}
