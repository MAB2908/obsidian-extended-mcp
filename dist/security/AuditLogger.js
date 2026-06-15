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
    formatCsvChunk(filePath, entries) {
        const columns = [
            'timestamp', 'sessionId', 'event', 'tool', 'args', 'result', 'durationMs', 'level', 'reason', 'blocked', 'message', 'vaultPath',
        ];
        const rows = [];
        if (!this.fileHasContentSync(filePath)) {
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
        return rows.join('\n') + '\n';
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
    async formatMarkdownChunk(filePath, entries) {
        const columns = [
            'timestamp', 'sessionId', 'event', 'tool', 'args', 'result', 'durationMs', 'level', 'reason', 'blocked', 'message', 'vaultPath',
        ];
        const hasContent = await this.fileHasContent(filePath);
        const lines = [];
        if (!hasContent) {
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
        return lines.join('\n') + '\n';
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
    generateSessionId() {
        return `sess-${createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16)}`;
    }
}
//# sourceMappingURL=AuditLogger.js.map