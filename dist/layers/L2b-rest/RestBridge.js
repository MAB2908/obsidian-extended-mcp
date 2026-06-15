import { RestAuthError, RestError, RestNotFoundError, RestQueryError, RestTimeoutError } from '../../shared/errors.js';
export class RestBridge {
    baseUrl;
    token;
    timeoutMs;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.token = config.token;
        this.timeoutMs = config.timeoutMs ?? 30000;
        if (this.token && !this.baseUrl.startsWith('https://')) {
            throw new RestQueryError('REST_API_REQUIRES_TLS', 'REST API token requires HTTPS connection');
        }
    }
    async isAvailable() {
        try {
            const res = await this.fetchSafe('/');
            return res.ok;
        }
        catch {
            return false;
        }
    }
    async activeNote() {
        const res = await this.fetchSafe('/active/');
        if (!res.ok)
            return null;
        const data = await res.json();
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
    async activeNoteContent() {
        const data = await this.fetchJson('/active/');
        return data.content ?? '';
    }
    async getNote(path) {
        return this.fetchJson(`/vault/${encodeURIComponent(path)}`);
    }
    async writeNote(path, content) {
        await this.fetchOk(`/vault/${encodeURIComponent(path)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
    }
    async deleteNote(path) {
        await this.fetchOk(`/vault/${encodeURIComponent(path)}`, { method: 'DELETE' });
    }
    async listTags() {
        return this.fetchJson('/tags/');
    }
    async executeCommand(commandId) {
        await this.fetchOk(`/commands/${encodeURIComponent(commandId)}/`, { method: 'POST' });
    }
    async search(query) {
        return this.fetchJson('/search/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
    }
    async executeDataview(query) {
        return this.fetchJson('/dataview/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
    }
    authHeaders() {
        const headers = {};
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        return headers;
    }
    async fetchJson(path, init) {
        const res = await this.fetchOk(path, init);
        return res.json();
    }
    async fetchOk(path, init) {
        const res = await this.fetchSafe(path, init);
        if (!res.ok) {
            if (res.status === 404)
                throw new RestNotFoundError(path);
            if (res.status === 401 || res.status === 403)
                throw new RestAuthError(String(res.status));
            throw new RestError('E300', `REST request failed: ${res.status} ${res.statusText}`);
        }
        return res;
    }
    async fetchSafe(path, init) {
        try {
            return await fetch(`${this.baseUrl}${path}`, {
                ...init,
                signal: AbortSignal.timeout(this.timeoutMs),
                headers: { ...this.authHeaders(), ...(init?.headers || {}) },
            });
        }
        catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                throw new RestTimeoutError(this.timeoutMs);
            }
            throw err;
        }
    }
}
//# sourceMappingURL=RestBridge.js.map