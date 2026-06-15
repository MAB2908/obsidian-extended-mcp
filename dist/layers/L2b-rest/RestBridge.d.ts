import type { ILayer2bRestBridge, Note } from '../../shared/types.js';
export interface RestBridgeConfig {
    baseUrl: string;
    token?: string;
    timeoutMs?: number;
}
export declare class RestBridge implements ILayer2bRestBridge {
    private baseUrl;
    private token?;
    private timeoutMs;
    constructor(config: RestBridgeConfig);
    isAvailable(): Promise<boolean>;
    activeNote(): Promise<Note | null>;
    activeNoteContent(): Promise<string>;
    getNote(path: string): Promise<{
        path: string;
        content: string;
        frontmatter: Record<string, unknown>;
    }>;
    writeNote(path: string, content: string): Promise<void>;
    deleteNote(path: string): Promise<void>;
    listTags(): Promise<string[]>;
    executeCommand(commandId: string): Promise<void>;
    search(query: string): Promise<Array<{
        path: string;
        score: number;
    }>>;
    executeDataview(query: string): Promise<unknown>;
    private authHeaders;
    private fetchJson;
    private fetchOk;
    private fetchSafe;
}
//# sourceMappingURL=RestBridge.d.ts.map