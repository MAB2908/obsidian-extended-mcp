export interface AuditEntry {
    timestamp: string;
    sessionId: string;
    event: string;
    tool?: string;
    args?: unknown;
    result?: unknown;
    durationMs?: number;
    level?: 'info' | 'warn' | 'error' | 'security';
    reason?: string;
    blocked?: boolean;
    message?: string;
    vaultPath?: string;
}
export interface AuditLoggerConfig {
    vaultPath: string;
    format?: 'jsonl' | 'csv' | 'markdown';
    maxAgeDays?: number;
    batchSize?: number;
    flushIntervalMs?: number;
    maxBufferSize?: number;
}
export interface GdprPurgeCriteria {
    sessionId?: string;
    path?: string;
    before?: string;
    after?: string;
    operation?: string;
}
export interface RemoteFlushResult {
    success: boolean;
    statusCode?: number;
    error?: string;
}
export declare class AuditLogger {
    private buffer;
    private timer;
    private sessionId;
    private config;
    private pendingFailures;
    private lastRemoteError;
    constructor(config: AuditLoggerConfig);
    private redact;
    private redactObject;
    log(entry: Omit<AuditEntry, 'timestamp' | 'sessionId'>): void;
    flush(): Promise<void>;
    private formatChunk;
    private fileHasContent;
    private formatCsvContent;
    private formatCsvChunk;
    private fileHasContentSync;
    private escapeCsv;
    private formatMarkdownContent;
    private formatMarkdownChunk;
    query(options?: {
        event?: string;
        tool?: string;
        since?: Date;
        until?: Date;
        limit?: number;
    }): Promise<AuditEntry[]>;
    private parseCsv;
    private parseCsvLine;
    private parseMarkdown;
    rotateIfNeeded(): Promise<void>;
    rotateByAge(): Promise<number>;
    gdprPurge(criteria: GdprPurgeCriteria): Promise<number>;
    private getExtensions;
    private listAuditFiles;
    private parseFile;
    private serializeEntries;
    private normalizeAuditPath;
    private matchesGdprCriteria;
    flushRemote(entries: AuditEntry[]): Promise<RemoteFlushResult>;
    private flushRemoteBatch;
    private recordRemoteFailure;
    getFailedRemoteFlushes(): Promise<AuditEntry[]>;
    getRemoteStatus(): {
        configured: boolean;
        url: string | null;
        pendingFailures: number;
        lastError: string | null;
    };
    private generateSessionId;
}
//# sourceMappingURL=AuditLogger.d.ts.map