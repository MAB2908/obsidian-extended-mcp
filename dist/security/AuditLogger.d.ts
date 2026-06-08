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
export declare class AuditLogger {
    private buffer;
    private timer;
    private sessionId;
    private config;
    constructor(config: AuditLoggerConfig);
    private redact;
    private redactObject;
    log(entry: Omit<AuditEntry, 'timestamp' | 'sessionId'>): void;
    flush(): Promise<void>;
    query(options?: {
        event?: string;
        tool?: string;
        since?: Date;
        until?: Date;
        limit?: number;
    }): Promise<AuditEntry[]>;
    rotateIfNeeded(): Promise<void>;
    private generateSessionId;
}
//# sourceMappingURL=AuditLogger.d.ts.map