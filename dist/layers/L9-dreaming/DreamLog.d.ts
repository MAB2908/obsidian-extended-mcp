import type { DreamLogEntry } from './types.js';
export declare class DreamLog {
    private logPath;
    private archiveDir;
    constructor(vaultPath: string);
    init(): Promise<void>;
    append(entry: DreamLogEntry): Promise<void>;
    readLastSession(sessionId: string): Promise<DreamLogEntry[]>;
    getArchivePath(relPath: string): string;
    archive(relPath: string, content: string): Promise<void>;
    restore(relPath: string): Promise<{
        content: string;
        mtime: number;
    } | null>;
    exists(relPath: string): Promise<boolean>;
}
//# sourceMappingURL=DreamLog.d.ts.map