import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
export interface HttpMcpTransportOptions {
    host: string;
    port: number;
    path: string;
    authToken?: string;
    corsOrigins?: string[];
    version?: string;
    createServer: () => McpServer | Promise<McpServer>;
}
export declare class HttpMcpTransport {
    private readonly options;
    private server?;
    private sessions;
    private requestCount;
    private errorCount;
    constructor(options: HttpMcpTransportOptions);
    start(): Promise<void>;
    getAddress(): string | import('node:net').AddressInfo | null;
    private applyCors;
    private sendJson;
    private reject;
    private handleRequest;
    private handleMcpRequest;
    private createSession;
    close(): Promise<void>;
}
//# sourceMappingURL=HttpMcpTransport.d.ts.map