export declare class McpError extends Error {
    readonly code: string;
    readonly layer: string;
    readonly severity: 'fatal' | 'error' | 'warning' | 'info';
    readonly recovery: string;
    readonly fallback?: string;
    readonly retryable: boolean;
    readonly maxRetries: number;
    constructor(options: {
        code: string;
        layer: string;
        severity: 'fatal' | 'error' | 'warning' | 'info';
        message: string;
        recovery: string;
        fallback?: string;
        retryable?: boolean;
        maxRetries?: number;
    });
}
export declare class LayerUnavailableError extends McpError {
    constructor(message: string, fallback?: string);
}
export declare class FileSystemError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class PathSecurityError extends FileSystemError {
    constructor(path: string);
}
export declare class FileLockedError extends FileSystemError {
    constructor(path: string);
}
export declare class PermissionDeniedError extends FileSystemError {
    constructor(path: string);
}
export declare class CorruptedCacheError extends FileSystemError {
    constructor(reason: string);
}
export declare class FileNotFoundError extends FileSystemError {
    constructor(path: string);
}
export declare class FileExistsError extends FileSystemError {
    constructor(path: string);
}
export declare class UnknownOperationError extends FileSystemError {
    constructor(operation: string);
}
export declare class ReadFailedError extends FileSystemError {
    constructor(path: string);
}
export declare class NoBackupError extends FileSystemError {
    constructor(path: string);
}
export declare class WriteFailedError extends FileSystemError {
    constructor(path: string, retries: number);
}
export declare class CliError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class CliNotFoundError extends CliError {
    constructor();
}
export declare class CliTimeoutError extends CliError {
    constructor(timeoutMs: number);
}
export declare class UnknownCliActionError extends CliError {
    constructor(action: string, context: string);
}
export declare class CliResponseError extends CliError {
    constructor(details: string);
}
export declare class CliExitError extends CliError {
    constructor(code: number, stderr?: string);
}
export declare class CliParseError extends CliError {
    constructor(details: string);
}
export declare class RestError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class RestQueryError extends RestError {
    constructor(query: string, details?: string);
}
export declare class RestNotFoundError extends RestError {
    constructor(path: string);
}
export declare class RestAuthError extends RestError {
    constructor(details?: string);
}
export declare class RestTimeoutError extends RestError {
    constructor(timeoutMs: number);
}
export declare class PipelineError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class SemanticError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class ConfigError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class ConfigInvalidError extends ConfigError {
    constructor(reason: string);
}
export declare class VaultPathNotFoundError extends ConfigError {
    constructor(path: string);
}
export declare class AuditLogWriteFailedError extends ConfigError {
    constructor(details?: string);
}
export declare class MemoryLimitExceededError extends ConfigError {
    constructor(limit: string);
}
export declare class SecurityError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class AclDeniedError extends SecurityError {
    constructor(path: string, action: 'read' | 'write' | 'delete' | 'move');
}
export declare class OntologyViolationError extends SecurityError {
    constructor(path: string, violations: string[]);
}
export declare class LLMProviderError extends McpError {
    constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>);
}
export declare class LLMHttpError extends LLMProviderError {
    constructor(status: number, body: string);
}
//# sourceMappingURL=errors.d.ts.map