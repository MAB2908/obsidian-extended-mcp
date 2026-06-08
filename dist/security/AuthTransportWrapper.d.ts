import type { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
export interface TokenVerifier {
    (provided?: string): {
        valid: boolean;
        reason?: string;
    };
}
export type AuthFailureLogger = (reason: string, token?: string) => void;
export declare class AuthTransportWrapper {
    private transport;
    private verify;
    private logFailure?;
    private originalOnMessage?;
    constructor(transport: StdioServerTransport, verify: TokenVerifier, logFailure?: AuthFailureLogger);
    wrap(): void;
    private handleSingleMessage;
    unwrap(): void;
}
//# sourceMappingURL=AuthTransportWrapper.d.ts.map