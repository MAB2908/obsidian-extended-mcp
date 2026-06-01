// v0.1b:
import type { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface TokenVerifier {
  (provided?: string): { valid: boolean; reason?: string };
}

export type AuthFailureLogger = (reason: string, token?: string) => void;

export class AuthTransportWrapper {
  private transport: StdioServerTransport;
  private verify: TokenVerifier;
  private logFailure?: AuthFailureLogger;
  private originalOnMessage?: (message: JSONRPCMessage) => void;

  constructor(transport: StdioServerTransport, verify: TokenVerifier, logFailure?: AuthFailureLogger) {
    this.transport = transport;
    this.verify = verify;
    this.logFailure = logFailure;
  }

  wrap(): void {
    this.originalOnMessage = this.transport.onmessage;
    this.transport.onmessage = (message: JSONRPCMessage) => {
      // Handle JSON-RPC batch requests (arrays of request objects)
      if (Array.isArray(message)) {
        for (const item of message) {
          this.handleSingleMessage(item);
        }
        return;
      }
      this.handleSingleMessage(message);
    };
  }

  private handleSingleMessage(message: JSONRPCMessage): void {
    const req = message as {
      method?: string;
      id?: string | number;
      params?: { _meta?: { authToken?: string } };
    };

    // Skip auth only for the initial handshake; all subsequent requests require token
    if (req.method === 'initialize') {
      this.originalOnMessage?.(message);
      return;
    }

    const token = req.params?._meta?.authToken;
    const result = this.verify(token);
    if (!result.valid) {
      this.logFailure?.(result.reason ?? 'unknown', token);
      // Return JSON-RPC error for unauthorized requests
      // Notifications (no id) must not receive responses per JSON-RPC spec
      if (req.id !== undefined) {
        const errorResponse: JSONRPCMessage = {
          jsonrpc: '2.0',
          id: req.id,
          error: {
            code: -32001,
            message: `Unauthorized: ${result.reason}`,
          },
        };
        this.transport.send(errorResponse).catch(() => {
          // ignore send errors
        });
      }
      return;
    }

    this.originalOnMessage?.(message);
  }

  unwrap(): void {
    if (this.originalOnMessage) {
      this.transport.onmessage = this.originalOnMessage;
      this.originalOnMessage = undefined;
    }
  }
}
