import type { ILayer2bRestBridge, Note } from '../../shared/types.js';
export interface RestBridgeConfig {
    baseUrl: string;
    token?: string;
}
export declare class RestBridge implements ILayer2bRestBridge {
    private baseUrl;
    private token?;
    constructor(config: RestBridgeConfig);
    isAvailable(): Promise<boolean>;
    activeNote(): Promise<Note | null>;
    executeDataview(query: string): Promise<unknown>;
    private authHeaders;
    private fetchSafe;
}
//# sourceMappingURL=RestBridge.d.ts.map