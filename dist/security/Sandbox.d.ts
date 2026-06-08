export interface SandboxConfig {
    forbiddenPatterns?: RegExp[];
    allowedGlobals?: string[];
    maxTimeoutMs?: number;
}
export declare class Sandbox {
    private patterns;
    private allowedGlobals;
    private maxTimeoutMs;
    constructor(config?: SandboxConfig);
    validate(code: string): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Execute sandboxed JavaScript code with a timeout.
     * Code runs in an isolated vm.Context with only whitelisted globals exposed.
     * Returns a Promise that rejects if execution exceeds maxTimeoutMs.
     *
     * SECURITY NOTICE: node:vm is NOT a full security boundary. A determined
     * attacker may still escape via prototype chains or V8 bugs. For true
     * isolation, run untrusted code in a separate child_process or worker_thread.
     * This sandbox is a defense-in-depth layer for cli_eval (disabled by default).
     */
    execute<T = unknown>(code: string, context?: Record<string, unknown>): Promise<T>;
}
//# sourceMappingURL=Sandbox.d.ts.map