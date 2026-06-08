export class AuthTransportWrapper {
    transport;
    verify;
    logFailure;
    originalOnMessage;
    constructor(transport, verify, logFailure) {
        this.transport = transport;
        this.verify = verify;
        this.logFailure = logFailure;
    }
    wrap() {
        this.originalOnMessage = this.transport.onmessage;
        this.transport.onmessage = (message) => {
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
    handleSingleMessage(message) {
        const req = message;
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
                const errorResponse = {
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
    unwrap() {
        if (this.originalOnMessage) {
            this.transport.onmessage = this.originalOnMessage;
            this.originalOnMessage = undefined;
        }
    }
}
//# sourceMappingURL=AuthTransportWrapper.js.map