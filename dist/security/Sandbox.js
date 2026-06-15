// v0.2b:
import { createContext, Script } from 'node:vm';
import { securityConfig } from '../shared/config.js';
import { SecurityError } from '../shared/errors.js';
const DEFAULT_FORBIDDEN = [
    // cli_eval hardening: explicit forbidden patterns
    /\brequire\s*\(/,
    /\brequire\s*\.\s*call\b/,
    /\bfs\s*\./,
    /\bfs\b/,
    /\bchild_process\b/,
    /\bprocess\./,
    /\bprocess\b/,
    /\beval\s*\(/,
    /\beval\s*\.\s*call\b/,
    /\beval\s*\.\s*apply\b/,
    /\beval\s*[`"]/,
    /\beval\?\.\s*\(/,
    /\bFunction\s*\(/,
    /\bFunction\s*\.\s*call\b/,
    /\bFunction\s*\.\s*apply\b/,
    /\bFunction\s*[`"]/,
    /\bFunction\?\.\s*\(/,
    /\.\s*constructor\b/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    // Bypass vectors: indirect eval, unicode escapes, bracket access, Reflect
    /\(0\s*,\s*eval\)/,
    /globalThis\s*\[/, // block all bracket access on globalThis
    /globalThis\s*\.\s*require/,
    /\[\s*['"`]constructor['"`]\s*\]/,
    new RegExp('\\\\u[0-9a-fA-F]{4}'),
    /\\u\{[0-9a-fA-F]+\}/, // ES6 unicode escapes
    /\\x[0-9a-fA-F]{2}/, // hex escapes
    /\bReflect\s*\.\s*construct\b/,
    /\bReflect\s*\.\s*apply\b/,
    /\bReflect\s*\.\s*get\b/,
    /\bReflect\s*\.\s*set\b/,
    /\bObject\.getPrototypeOf\b/,
    /\bString\.fromCharCode\b/, // dynamic string reconstruction
    /\bString\.fromCodePoint\b/,
    // Additional hardening against known vm escapes
    /\bProxy\b/,
    /\bwith\s*\(/,
    /\b__proto__\b/,
    /\bObject\.setPrototypeOf\b/,
    /\barguments\.callee\b/,
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
];
const DEFAULT_ALLOWED_GLOBALS = securityConfig.sandboxAllowedGlobals;
const DEFAULT_TIMEOUT_MS = securityConfig.sandboxTimeoutMs;
export class Sandbox {
    patterns;
    allowedGlobals;
    maxTimeoutMs;
    constructor(config) {
        this.patterns = config?.forbiddenPatterns ?? DEFAULT_FORBIDDEN;
        this.allowedGlobals = config?.allowedGlobals ?? DEFAULT_ALLOWED_GLOBALS;
        this.maxTimeoutMs = config?.maxTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    }
    validate(code) {
        const MAX_CODE_LENGTH = 100 * 1024; // 100 KB
        if (code.length > MAX_CODE_LENGTH) {
            return { allowed: false, reason: `Code exceeds maximum length of ${MAX_CODE_LENGTH} bytes` };
        }
        const normalized = code.normalize('NFC');
        for (const pattern of this.patterns) {
            if (pattern.test(normalized)) {
                return { allowed: false, reason: `Forbidden pattern matched: ${pattern.source}` };
            }
        }
        return { allowed: true };
    }
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
    async execute(code, context) {
        const validation = this.validate(code);
        if (!validation.allowed) {
            throw new SecurityError('E405', 'Forbidden pattern detected in eval code');
        }
        // Build a minimal global context exposing only allowed globals + user context
        const sandboxGlobals = {};
        for (const key of this.allowedGlobals) {
            if (key in globalThis) {
                sandboxGlobals[key] = globalThis[key];
            }
        }
        if (context) {
            Object.assign(sandboxGlobals, context);
        }
        // Freeze prototype chain of all exposed globals to prevent prototype pollution
        for (const key of Object.keys(sandboxGlobals)) {
            const val = sandboxGlobals[key];
            if (val && typeof val === 'object') {
                // CRITICAL FIX (SB-001): Shallow-clone before mutating so we don't corrupt host globals
                const clone = Object.create(Object.getPrototypeOf(val));
                Object.assign(clone, val);
                // Strip prototype BEFORE freezing; setPrototypeOf on a frozen object throws
                Object.setPrototypeOf(clone, null);
                Object.freeze(clone);
                sandboxGlobals[key] = clone;
            }
        }
        const vmContext = createContext(sandboxGlobals, {
            codeGeneration: { strings: false, wasm: false },
        });
        // Wrap code in an async IIFE so await works inside the vm
        const wrapped = `
      (async () => {
        ${code}
      })()
    `;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Sandbox execution timed out after ${this.maxTimeoutMs}ms`));
            }, this.maxTimeoutMs);
            try {
                const script = new Script(wrapped, { produceCachedData: false });
                const result = script.runInContext(vmContext, {
                    timeout: this.maxTimeoutMs,
                    displayErrors: true,
                });
                Promise.resolve(result)
                    .then((value) => {
                    clearTimeout(timer);
                    resolve(value);
                })
                    .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
            }
            catch (err) {
                clearTimeout(timer);
                reject(err);
            }
        });
    }
}
//# sourceMappingURL=Sandbox.js.map