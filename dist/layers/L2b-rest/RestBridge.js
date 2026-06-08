import { RestQueryError } from '../../shared/errors.js';
export class RestBridge {
    baseUrl;
    token;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.token = config.token;
        if (this.token && !this.baseUrl.startsWith('https://')) {
            throw new RestQueryError('REST_API_REQUIRES_TLS', 'REST API token requires HTTPS connection');
        }
    }
    async isAvailable() {
        try {
            const res = await fetch(`${this.baseUrl}/`, {
                headers: this.authHeaders(),
            });
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
    async executeDataview(query) {
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
    authHeaders() {
        const headers = {};
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        return headers;
    }
    async fetchSafe(path, init) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: { ...this.authHeaders(), ...(init?.headers || {}) },
        });
        return res;
    }
}
//# sourceMappingURL=RestBridge.js.map