// v0.2b:
import { promises as fs, statSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { securityConfig } from '../shared/config.js';
import { safeJsonParse } from '../shared/utils.js';
export class AuditLogger {
    buffer = [];
    timer = null;
    sessionId;
    config;
    pendingFailures = 0;
    lastRemoteError = null;
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
        const sessionExt = this.config.format === 'jsonl' ? 'jsonl' : this.config.format === 'csv' ? 'csv' : 'md';
        const masterExt = this.config.format === 'jsonl' ? 'log' : this.config.format === 'csv' ? 'csv' : 'md';
        const sessionPath = path.join(this.config.vaultPath, 'sessions', `mcp-audit-${this.sessionId}.${sessionExt}`);
        const masterPath = path.join(this.config.vaultPath, '.mcp-cache', `audit.${masterExt}`);
        try {
            await fs.mkdir(path.dirname(sessionPath), { recursive: true });
            await fs.mkdir(path.dirname(masterPath), { recursive: true });
            const sessionChunk = await this.formatChunk(sessionPath, entries);
            const masterChunk = await this.formatChunk(masterPath, entries);
            await fs.appendFile(sessionPath, sessionChunk, 'utf-8');
            await fs.appendFile(masterPath, masterChunk, 'utf-8');
            // After local persistence, attempt remote sink if configured.
            if (securityConfig.auditRemoteUrl) {
                await this.flushRemote(entries);
            }
        }
        catch (err) {
            // Restore entries to buffer for retry on next flush
            this.buffer.unshift(...entries);
            throw err;
        }
    }
    async formatChunk(filePath, entries) {
        switch (this.config.format) {
            case 'csv':
                return this.formatCsvChunk(filePath, entries);
            case 'markdown':
                return this.formatMarkdownChunk(filePath, entries);
            case 'jsonl':
            default:
                return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
        }
    }
    async fileHasContent(filePath) {
        try {
            const stat = await fs.stat(filePath);
            return stat.size > 0;
        }
        catch {
            return false;
        }
    }
    formatCsvContent(entries, includeHeader) {
        const columns = [
            'timestamp', 'sessionId', 'event', 'tool', 'args', 'result', 'durationMs', 'level', 'reason', 'blocked', 'message', 'vaultPath',
        ];
        const rows = [];
        if (includeHeader) {
            rows.push(columns.map((c) => this.escapeCsv(String(c))).join(','));
        }
        for (const entry of entries) {
            rows.push(columns
                .map((col) => {
                const value = entry[col];
                if (value === undefined)
                    return '';
                if (typeof value === 'object')
                    return this.escapeCsv(JSON.stringify(value));
                return this.escapeCsv(String(value));
            })
                .join(','));
        }
        return rows.join('\n') + (rows.length ? '\n' : '');
    }
    formatCsvChunk(filePath, entries) {
        return this.formatCsvContent(entries, !this.fileHasContentSync(filePath));
    }
    fileHasContentSync(filePath) {
        try {
            const stat = statSync(filePath);
            return stat.size > 0;
        }
        catch {
            return false;
        }
    }
    escapeCsv(value) {
        if (/[",\n\r]/.test(value)) {
            return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
    }
    formatMarkdownContent(entries, includeHeader) {
        const columns = [
            'timestamp', 'sessionId', 'event', 'tool', 'args', 'result', 'durationMs', 'level', 'reason', 'blocked', 'message', 'vaultPath',
        ];
        const lines = [];
        if (includeHeader) {
            lines.push('| ' + columns.join(' | ') + ' |');
            lines.push('| ' + columns.map(() => '---').join(' | ') + ' |');
        }
        for (const entry of entries) {
            lines.push('| ' +
                columns
                    .map((col) => {
                    const value = entry[col];
                    if (value === undefined)
                        return '';
                    const cell = typeof value === 'object' ? JSON.stringify(value) : String(value);
                    return cell.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
                })
                    .join(' | ') +
                ' |');
        }
        return lines.join('\n') + (lines.length ? '\n' : '');
    }
    async formatMarkdownChunk(filePath, entries) {
        return this.formatMarkdownContent(entries, !(await this.fileHasContent(filePath)));
    }
    async query(options) {
        const masterExt = this.config.format === 'jsonl' ? 'log' : this.config.format === 'csv' ? 'csv' : 'md';
        const masterPath = path.join(this.config.vaultPath, '.mcp-cache', `audit.${masterExt}`);
        try {
            const raw = await fs.readFile(masterPath, 'utf-8');
            let entries = [];
            switch (this.config.format) {
                case 'csv':
                    entries = this.parseCsv(raw);
                    break;
                case 'markdown':
                    entries = this.parseMarkdown(raw);
                    break;
                case 'jsonl':
                default:
                    entries = raw
                        .split('\n')
                        .filter((l) => l.trim())
                        .map((line) => safeJsonParse(line))
                        .filter(Boolean);
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
    parseCsv(raw) {
        const lines = raw.split('\n').filter((l) => l.trim());
        if (lines.length === 0)
            return [];
        const header = this.parseCsvLine(lines[0]);
        const entries = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            const entry = {};
            for (let j = 0; j < header.length; j++) {
                const value = values[j];
                if (value === undefined || value === '')
                    continue;
                if (header[j] === 'args' || header[j] === 'result') {
                    try {
                        entry[header[j]] = safeJsonParse(value);
                    }
                    catch {
                        entry[header[j]] = value;
                    }
                }
                else if (header[j] === 'durationMs') {
                    entry[header[j]] = Number(value);
                }
                else if (header[j] === 'blocked') {
                    entry[header[j]] = value === 'true';
                }
                else {
                    entry[header[j]] = value;
                }
            }
            entries.push(entry);
        }
        return entries;
    }
    parseCsvLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const next = line[i + 1];
            if (char === '"') {
                if (inQuotes && next === '"') {
                    current += '"';
                    i++;
                }
                else {
                    inQuotes = !inQuotes;
                }
            }
            else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            }
            else {
                current += char;
            }
        }
        values.push(current);
        return values;
    }
    parseMarkdown(raw) {
        const lines = raw.split('\n').filter((l) => l.trim());
        if (lines.length < 2)
            return [];
        const headerLine = lines[0];
        const header = headerLine
            .split('|')
            .map((c) => c.trim())
            .filter((c) => c && c !== '---');
        const entries = [];
        for (let i = 2; i < lines.length; i++) {
            const values = lines[i]
                .split('|')
                .map((c) => c.trim().replace(/\\\|/g, '|').replace(/<br>/g, '\n'));
            const entry = {};
            for (let j = 0; j < header.length; j++) {
                const value = values[j + 1];
                if (value === undefined || value === '')
                    continue;
                if (header[j] === 'args' || header[j] === 'result') {
                    try {
                        entry[header[j]] = safeJsonParse(value);
                    }
                    catch {
                        entry[header[j]] = value;
                    }
                }
                else if (header[j] === 'durationMs') {
                    entry[header[j]] = Number(value);
                }
                else if (header[j] === 'blocked') {
                    entry[header[j]] = value === 'true';
                }
                else {
                    entry[header[j]] = value;
                }
            }
            entries.push(entry);
        }
        return entries;
    }
    async rotateIfNeeded() {
        const masterExt = this.config.format === 'jsonl' ? 'log' : this.config.format === 'csv' ? 'csv' : 'md';
        const masterPath = path.join(this.config.vaultPath, '.mcp-cache', `audit.${masterExt}`);
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
    async rotateByAge() {
        await this.flush();
        const cutoff = Date.now() - this.config.maxAgeDays * 24 * 60 * 60 * 1000;
        let removed = 0;
        for (const file of await this.listAuditFiles()) {
            const raw = await fs.readFile(file, 'utf-8');
            const entries = this.parseFile(raw);
            const kept = [];
            for (const entry of entries) {
                const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : NaN;
                if (!Number.isNaN(ts) && ts < cutoff) {
                    removed++;
                }
                else {
                    kept.push(entry);
                }
            }
            await fs.writeFile(file, this.serializeEntries(kept), 'utf-8');
        }
        return removed;
    }
    async gdprPurge(criteria) {
        if (!criteria || Object.keys(criteria).length === 0) {
            throw new Error('gdprPurge requires at least one criterion; empty criteria would delete the entire audit log');
        }
        await this.flush();
        let removed = 0;
        for (const file of await this.listAuditFiles()) {
            const raw = await fs.readFile(file, 'utf-8');
            const entries = this.parseFile(raw);
            const kept = [];
            for (const entry of entries) {
                if (this.matchesGdprCriteria(entry, criteria)) {
                    removed++;
                    this.log({
                        event: 'GDPR_PURGE',
                        tool: 'audit_purge',
                        level: 'security',
                        args: { criteriaKeys: Object.keys(criteria) },
                    });
                }
                else {
                    kept.push(entry);
                }
            }
            await fs.writeFile(file, this.serializeEntries(kept), 'utf-8');
        }
        await this.flush();
        return removed;
    }
    getExtensions() {
        const session = this.config.format === 'jsonl' ? 'jsonl' : this.config.format === 'csv' ? 'csv' : 'md';
        const master = this.config.format === 'jsonl' ? 'log' : this.config.format === 'csv' ? 'csv' : 'md';
        return { session, master };
    }
    async listAuditFiles() {
        const { session, master } = this.getExtensions();
        const files = [];
        const masterPath = path.join(this.config.vaultPath, '.mcp-cache', `audit.${master}`);
        try {
            const stat = await fs.stat(masterPath);
            if (stat.isFile())
                files.push(masterPath);
        }
        catch {
            // master log does not exist yet
        }
        const sessionsDir = path.join(this.config.vaultPath, 'sessions');
        try {
            const entries = await fs.readdir(sessionsDir);
            for (const entry of entries) {
                if (entry.startsWith('mcp-audit-') && entry.endsWith(`.${session}`)) {
                    files.push(path.join(sessionsDir, entry));
                }
            }
        }
        catch {
            // sessions directory does not exist yet
        }
        return files;
    }
    parseFile(raw) {
        switch (this.config.format) {
            case 'csv':
                return this.parseCsv(raw);
            case 'markdown':
                return this.parseMarkdown(raw);
            case 'jsonl':
            default:
                return raw
                    .split('\n')
                    .filter((l) => l.trim())
                    .map((line) => safeJsonParse(line))
                    .filter(Boolean);
        }
    }
    serializeEntries(entries) {
        switch (this.config.format) {
            case 'csv':
                return this.formatCsvContent(entries, true);
            case 'markdown':
                return this.formatMarkdownContent(entries, true);
            case 'jsonl':
            default:
                return entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
        }
    }
    normalizeAuditPath(p) {
        return path.normalize(p).replace(/\\/g, '/').replace(/\/+$/, '');
    }
    matchesGdprCriteria(entry, criteria) {
        // Compliance traceability entries must never be purged.
        if (entry.event === 'GDPR_PURGE')
            return false;
        if (criteria.sessionId && entry.sessionId === criteria.sessionId)
            return true;
        if (criteria.operation && (entry.tool === criteria.operation || entry.event === criteria.operation))
            return true;
        if (criteria.before || criteria.after) {
            const ts = new Date(entry.timestamp).getTime();
            if (!Number.isNaN(ts)) {
                if (criteria.before) {
                    const before = new Date(criteria.before).getTime();
                    if (!Number.isNaN(before) && ts < before)
                        return true;
                }
                if (criteria.after) {
                    const after = new Date(criteria.after).getTime();
                    if (!Number.isNaN(after) && ts > after)
                        return true;
                }
            }
        }
        if (criteria.path) {
            const crit = this.normalizeAuditPath(criteria.path);
            const candidates = [entry.vaultPath, entry.message].filter((c) => typeof c === 'string' && c.length > 0);
            for (const candidate of candidates) {
                const norm = this.normalizeAuditPath(candidate);
                if (norm === crit || norm.startsWith(crit + '/'))
                    return true;
            }
        }
        return false;
    }
    async flushRemote(entries) {
        const url = securityConfig.auditRemoteUrl;
        if (!url) {
            return { success: false, error: 'Remote audit sink not configured' };
        }
        const batchSize = securityConfig.auditRemoteBatchSize;
        let lastError;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            const result = await this.flushRemoteBatch(batch, url);
            if (!result.success) {
                lastError = result.error;
            }
        }
        if (lastError) {
            return { success: false, error: lastError };
        }
        return { success: true };
    }
    async flushRemoteBatch(entries, url) {
        const token = securityConfig.auditRemoteToken;
        const timeoutMs = securityConfig.auditRemoteTimeoutMs;
        const maxAttempts = Math.max(1, securityConfig.auditRemoteRetryAttempts);
        const headers = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        let lastError;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(entries),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (response.ok) {
                    this.lastRemoteError = null;
                    return { success: true, statusCode: response.status };
                }
                lastError = `HTTP ${response.status}`;
            }
            catch (err) {
                clearTimeout(timeout);
                lastError = err instanceof Error ? err.message : String(err);
            }
            if (attempt < maxAttempts - 1) {
                const delay = 100 * 2 ** attempt;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        await this.recordRemoteFailure(entries, lastError ?? 'unknown error');
        return { success: false, error: lastError };
    }
    async recordRemoteFailure(entries, error) {
        const failureDir = path.join(this.config.vaultPath, '.mcp-cache', 'audit-failures');
        const failurePath = path.join(failureDir, 'remote-failures.jsonl');
        this.pendingFailures += entries.length;
        this.lastRemoteError = error;
        try {
            await fs.mkdir(failureDir, { recursive: true });
            const payload = entries.map((e) => JSON.stringify({ ...e, _remoteError: error, _failedAt: new Date().toISOString() })).join('\n') + '\n';
            await fs.appendFile(failurePath, payload, 'utf-8');
        }
        catch (writeErr) {
            console.error('[AuditLogger] Failed to write remote-failures.jsonl:', writeErr);
        }
        this.log({
            event: 'AUDIT_REMOTE_FAILED',
            tool: 'audit_remote_flush',
            level: 'error',
            message: error,
            args: { count: entries.length },
        });
    }
    async getFailedRemoteFlushes() {
        const failurePath = path.join(this.config.vaultPath, '.mcp-cache', 'audit-failures', 'remote-failures.jsonl');
        try {
            const raw = await fs.readFile(failurePath, 'utf-8');
            return raw
                .split('\n')
                .filter((l) => l.trim())
                .map((line) => safeJsonParse(line))
                .filter(Boolean);
        }
        catch {
            return [];
        }
    }
    getRemoteStatus() {
        return {
            configured: !!securityConfig.auditRemoteUrl,
            url: securityConfig.auditRemoteUrl || null,
            pendingFailures: this.pendingFailures,
            lastError: this.lastRemoteError,
        };
    }
    generateSessionId() {
        return `sess-${createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16)}`;
    }
}
//# sourceMappingURL=AuditLogger.js.map