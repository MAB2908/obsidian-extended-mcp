// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { securityConfig } from '../shared/config.js';
import { safeJsonParse } from '../shared/utils.js';
export class AuditLogger {
    buffer = [];
    timer = null;
    sessionId;
    config;
    constructor(config) {
        this.config = {
            format: securityConfig.auditFormat,
            maxAgeDays: securityConfig.auditMaxAgeDays,
            batchSize: securityConfig.auditBatchSize,
            flushIntervalMs: securityConfig.auditFlushIntervalMs,
            maxBufferSize: securityConfig.auditMaxBufferSize,
            ...config,
        };
        this.sessionId = this.generateSessionId();
    }
    redact(entry) {
        const sensitiveKeys = ['code', 'content', 'password', 'token', 'apiKey', 'api_key', 'secret'];
        const clone = { ...entry };
        // Redact sensitive fields in args
        if (clone.args && typeof clone.args === 'object') {
            const redactedArgs = {};
            for (const [k, v] of Object.entries(clone.args)) {
                if (sensitiveKeys.includes(k)) {
                    const str = typeof v === 'string' ? v : JSON.stringify(v);
                    redactedArgs[k] = str.length > 4 ? str.slice(0, 2) + '***' + str.slice(-2) : '***';
                }
                else {
                    redactedArgs[k] = v;
                }
            }
            clone.args = redactedArgs;
        }
        // Redact sensitive content in result and message fields
        for (const field of ['result', 'message']) {
            const val = clone[field];
            if (val && typeof val === 'object') {
                // Recursively redact sensitive keys in object/array result
                clone[field] = this.redactObject(val, sensitiveKeys);
            }
            else if (typeof val === 'string' && val.length > 0) {
                for (const key of sensitiveKeys) {
                    if (val.toLowerCase().includes(key.toLowerCase()) || val.length > 4096) {
                        clone[field] = '[REDACTED]';
                        break;
                    }
                }
            }
        }
        return clone;
    }
    redactObject(obj, sensitiveKeys) {
        if (obj === null || obj === undefined)
            return obj;
        if (typeof obj === 'string') {
            if (obj.length > 4096) {
                return '[REDACTED]';
            }
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.redactObject(item, sensitiveKeys));
        }
        if (typeof obj === 'object') {
            const result = {};
            for (const [k, v] of Object.entries(obj)) {
                if (sensitiveKeys.includes(k)) {
                    const str = typeof v === 'string' ? v : JSON.stringify(v);
                    result[k] = str.length > 4 ? str.slice(0, 2) + '***' + str.slice(-2) : '***';
                }
                else {
                    result[k] = this.redactObject(v, sensitiveKeys);
                }
            }
            return result;
        }
        return obj;
    }
    log(entry) {
        // Prevent unbounded memory growth if flush repeatedly fails (V-005)
        while (this.buffer.length >= this.config.maxBufferSize) {
            this.buffer.shift();
        }
        this.buffer.push({
            ...this.redact(entry),
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
        });
        if (this.buffer.length >= this.config.batchSize) {
            this.flush().catch((err) => console.error('[AuditLogger] Flush failed:', err));
        }
        else if (!this.timer) {
            this.timer = setTimeout(() => {
                this.flush().catch((err) => console.error('[AuditLogger] Flush failed:', err));
            }, this.config.flushIntervalMs);
        }
    }
    async flush() {
        if (this.buffer.length === 0)
            return;
        // Atomic swap to prevent race between slice and splice (V-002)
        const entries = this.buffer;
        this.buffer = [];
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const sessionPath = path.join(this.config.vaultPath, 'sessions', `mcp-audit-${this.sessionId}.jsonl`);
        const masterPath = path.join(this.config.vaultPath, '.mcp-cache', 'audit.log');
        try {
            await fs.mkdir(path.dirname(sessionPath), { recursive: true });
            await fs.mkdir(path.dirname(masterPath), { recursive: true });
            const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
            await fs.appendFile(sessionPath, lines, 'utf-8');
            await fs.appendFile(masterPath, lines, 'utf-8');
        }
        catch (err) {
            // Restore entries to buffer for retry on next flush
            this.buffer.unshift(...entries);
            throw err;
        }
    }
    async query(options) {
        const masterPath = path.join(this.config.vaultPath, '.mcp-cache', 'audit.log');
        try {
            const raw = await fs.readFile(masterPath, 'utf-8');
            const lines = raw.split('\n').filter((l) => l.trim());
            let entries = [];
            for (const line of lines) {
                try {
                    entries.push(safeJsonParse(line));
                }
                catch {
                    // skip malformed or oversized line
                }
            }
            if (options?.event)
                entries = entries.filter((e) => e.event === options.event);
            if (options?.tool)
                entries = entries.filter((e) => e.tool === options.tool);
            if (options?.since)
                entries = entries.filter((e) => new Date(e.timestamp) >= options.since);
            if (options?.until)
                entries = entries.filter((e) => new Date(e.timestamp) <= options.until);
            entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            if (options?.limit)
                entries = entries.slice(0, options.limit);
            return entries;
        }
        catch {
            return [];
        }
    }
    async rotateIfNeeded() {
        const masterPath = path.join(this.config.vaultPath, '.mcp-cache', 'audit.log');
        try {
            const stat = await fs.stat(masterPath);
            const sizeMB = stat.size / (1024 * 1024);
            if (sizeMB > securityConfig.auditRotationMb) {
                const rotated = masterPath + `.${Date.now()}`;
                await fs.rename(masterPath, rotated);
            }
        }
        catch {
            // no audit log yet
        }
    }
    generateSessionId() {
        return `sess-${createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16)}`;
    }
}
//# sourceMappingURL=AuditLogger.js.map