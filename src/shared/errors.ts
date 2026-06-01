// v0.1b:
export class McpError extends Error {
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
  }) {
    super(options.message);
    this.name = 'McpError';
    this.code = options.code;
    this.layer = options.layer;
    this.severity = options.severity;
    this.recovery = options.recovery;
    this.fallback = options.fallback;
    this.retryable = options.retryable ?? false;
    this.maxRetries = options.maxRetries ?? 0;
  }
}

export class LayerUnavailableError extends McpError {
  constructor(message: string, fallback?: string) {
    super({
      code: 'E001',
      layer: 'shared',
      severity: 'warning',
      message,
      recovery: 'Try an alternative layer or check configuration.',
      fallback,
      retryable: true,
      maxRetries: 3,
    });
  }
}

// ───────────────────────────────────────────
// Layer 1: Filesystem
// ───────────────────────────────────────────

export class FileSystemError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'L1',
      severity: 'error',
      message,
      recovery: options?.recovery ?? 'Check file path and permissions.',
      retryable: options?.retryable ?? false,
      maxRetries: options?.maxRetries ?? 0,
      ...options,
    });
  }
}

export class PathSecurityError extends FileSystemError {
  constructor(path: string) {
    super(
      'E101',
      `Path traversal detected or path outside vault: ${path}`,
      {
        severity: 'fatal',
        recovery: 'Use a relative path within the vault root.',
        retryable: false,
      }
    );
  }
}

export class FileLockedError extends FileSystemError {
  constructor(path: string) {
    super(
      'E102',
      `Resource busy or locked: ${path}`,
      {
        severity: 'warning',
        recovery: 'Retry with jitter: delay = 100ms * (attempt + 1) + random(50ms)',
        retryable: true,
        maxRetries: 3,
      }
    );
  }
}

export class PermissionDeniedError extends FileSystemError {
  constructor(path: string) {
    super(
      'E103',
      `Permission denied: ${path}`,
      {
        severity: 'fatal',
        recovery: 'Check permissions: chmod -R 755 /path/to/vault',
        retryable: false,
      }
    );
  }
}

export class CorruptedCacheError extends FileSystemError {
  constructor(reason: string) {
    super(
      'E104',
      `Cache corrupted: ${reason}`,
      {
        severity: 'warning',
        recovery: 'Delete .mcp-cache and rebuild on next request.',
        retryable: true,
        maxRetries: 1,
      }
    );
  }
}

export class BM25IndexCorruptedError extends FileSystemError {
  constructor() {
    super(
      'E105',
      'BM25 index corrupted or incompatible version',
      {
        severity: 'warning',
        recovery: 'Remove .mcp-cache/search-index/; index will rebuild incrementally.',
        fallback: 'ripgrep',
        retryable: true,
        maxRetries: 1,
      }
    );
  }
}

export class FileNotFoundError extends FileSystemError {
  constructor(path: string) {
    super(
      'E106',
      `File not found: ${path}`,
      {
        severity: 'error',
        recovery: 'Check the path; if creating new — use write_note.',
        retryable: false,
      }
    );
  }
}

export class FileExistsError extends FileSystemError {
  constructor(path: string) {
    super(
      'E107',
      `File already exists: ${path}. Use overwrite=true to replace.`,
      {
        severity: 'error',
        recovery: 'Use overwrite=true or delete the existing file first.',
        retryable: false,
      }
    );
  }
}

export class UnknownOperationError extends FileSystemError {
  constructor(operation: string) {
    super(
      'E108',
      `Unknown operation: ${operation}`,
      {
        severity: 'error',
        recovery: 'Use a supported operation: replace, append, prepend, delete, add, remove, set.',
        retryable: false,
      }
    );
  }
}

export class ReadFailedError extends FileSystemError {
  constructor(path: string) {
    super(
      'E109',
      `Read failed: ${path}`,
      {
        severity: 'error',
        recovery: 'Check file permissions and disk health.',
        retryable: true,
        maxRetries: 1,
      }
    );
  }
}

export class NoBackupError extends FileSystemError {
  constructor(path: string) {
    super(
      'E110',
      `No backup found for ${path}`,
      {
        severity: 'error',
        recovery: 'Check .mcp-cache/backups/ or create a new backup before modifying.',
        retryable: false,
      }
    );
  }
}

export class WriteFailedError extends FileSystemError {
  constructor(path: string, retries: number) {
    super(
      'E111',
      `Write failed after ${retries} retries: ${path}`,
      {
        severity: 'error',
        recovery: 'Check disk space, file locks, and permissions.',
        retryable: false,
      }
    );
  }
}

// ───────────────────────────────────────────
// Layer 2: CLI Bridge
// ───────────────────────────────────────────

export class CliError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'L2',
      severity: 'error',
      message,
      recovery: options?.recovery ?? 'Check CLI installation and Obsidian version.',
      fallback: options?.fallback ?? 'L1',
      retryable: options?.retryable ?? false,
      maxRetries: options?.maxRetries ?? 0,
      ...options,
    });
  }
}

export class CliNotFoundError extends CliError {
  constructor() {
    super(
      'E201',
      'Obsidian CLI not found. Is the CLI plugin installed?',
      {
        severity: 'warning',
        recovery: 'Install obsidian-cli plugin or check PATH.',
        retryable: true,
        maxRetries: 3,
      }
    );
  }
}

export class CliTimeoutError extends CliError {
  constructor(timeoutMs: number) {
    super(
      'E202',
      `CLI command timed out after ${timeoutMs}ms`,
      {
        severity: 'warning',
        recovery: 'Increase timeout or check Obsidian responsiveness.',
        retryable: true,
        maxRetries: 1,
      }
    );
  }
}

export class UnknownCliActionError extends CliError {
  constructor(action: string, context: string) {
    super(
      'E203',
      `Unknown ${context} action: ${action}`,
      {
        severity: 'error',
        recovery: `Use supported ${context} actions.`,
        retryable: false,
      }
    );
  }
}

export class CliResponseError extends CliError {
  constructor(details: string) {
    super(
      'E204',
      `CLI returned error: ${details}`,
      {
        severity: 'error',
        recovery: 'Check Obsidian state and plugin configuration.',
        retryable: false,
      }
    );
  }
}

export class CliExitError extends CliError {
  constructor(code: number, stderr?: string) {
    super(
      'E206',
      `CLI exited with code ${code}${stderr ? ': ' + stderr : ''}`,
      {
        severity: 'error',
        recovery: 'Check Obsidian console for errors.',
        retryable: false,
      }
    );
  }
}

export class CliParseError extends CliError {
  constructor(details: string) {
    super(
      'E207',
      `Failed to parse CLI output: ${details}`,
      {
        severity: 'error',
        recovery: 'Check CLI plugin version compatibility.',
        retryable: false,
      }
    );
  }
}

// ───────────────────────────────────────────
// Layer 2b: REST Fallback
// ───────────────────────────────────────────

export class RestError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'L2b',
      severity: 'error',
      message,
      recovery: options?.recovery ?? 'Check REST API plugin and URL/token.',
      fallback: options?.fallback ?? 'L1',
      retryable: options?.retryable ?? false,
      maxRetries: options?.maxRetries ?? 0,
      ...options,
    });
  }
}

export class RestQueryError extends RestError {
  constructor(query: string, details?: string) {
    super(
      'E301',
      `Dataview query failed: ${query}${details ? ' — ' + details : ''}`,
      {
        severity: 'error',
        recovery: 'Check Dataview plugin and query syntax.',
        retryable: true,
        maxRetries: 1,
      }
    );
  }
}

// ───────────────────────────────────────────
// Layer 3: Pipeline
// ───────────────────────────────────────────

export class PipelineError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'L3',
      severity: 'error',
      message,
      recovery: options?.recovery ?? 'Check pipeline inputs and retry.',
      retryable: options?.retryable ?? false,
      maxRetries: options?.maxRetries ?? 0,
      ...options,
    });
  }
}

// ───────────────────────────────────────────
// Layer 4: Semantic Engine
// ───────────────────────────────────────────

export class SemanticError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'L4',
      severity: 'warning',
      message,
      recovery: options?.recovery ?? 'Disable feature or rebuild index.',
      fallback: options?.fallback ?? 'bm25',
      retryable: options?.retryable ?? false,
      maxRetries: options?.maxRetries ?? 0,
      ...options,
    });
  }
}

// ───────────────────────────────────────────
// Layer 5: Config
// ───────────────────────────────────────────

export class ConfigError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'L5',
      severity: 'fatal',
      message,
      recovery: options?.recovery ?? 'Fix configuration and restart.',
      retryable: false,
      ...options,
    });
  }
}

export class ConfigInvalidError extends ConfigError {
  constructor(reason: string) {
    super(
      'E901',
      `Config invalid: ${reason}`,
      {
        severity: 'fatal',
        recovery: 'Check .env.example and set required variables.',
        retryable: false,
      }
    );
  }
}

export class VaultPathNotFoundError extends ConfigError {
  constructor(path: string) {
    super(
      'E902',
      `Vault path not found: ${path}`,
      {
        severity: 'fatal',
        recovery: 'Set OBSIDIAN_VAULT_PATH to an existing directory.',
        retryable: false,
      }
    );
  }
}

export class AuditLogWriteFailedError extends ConfigError {
  constructor(details?: string) {
    super(
      'E903',
      `Audit log write failed${details ? ': ' + details : ''}`,
      {
        severity: 'error',
        recovery: 'Check disk space and permissions for .mcp-cache/.',
        retryable: true,
        maxRetries: 1,
      }
    );
  }
}

export class MemoryLimitExceededError extends ConfigError {
  constructor(limit: string) {
    super(
      'E904',
      `Memory limit exceeded: ${limit}`,
      {
        severity: 'fatal',
        recovery: 'Reduce batch size or enable chunked processing.',
        retryable: false,
      }
    );
  }
}

// ───────────────────────────────────────────
// Security
// ───────────────────────────────────────────

export class SecurityError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'security',
      severity: 'fatal',
      message,
      recovery: options?.recovery ?? 'Operation blocked. Check audit log.',
      retryable: false,
      ...options,
    });
  }
}

export class AclDeniedError extends SecurityError {
  constructor(path: string, action: 'read' | 'write' | 'delete' | 'move') {
    super(
      'E401',
      `${action.charAt(0).toUpperCase() + action.slice(1)} denied by ACL: ${path}`,
      {
        severity: 'fatal',
        recovery: 'Check folder ACL policy or request access.',
        retryable: false,
      }
    );
  }
}

export class OntologyViolationError extends SecurityError {
  constructor(path: string, violations: string[]) {
    super(
      'E402',
      `Ontology violation in ${path}: ${violations.join('; ')}`,
      {
        severity: 'error',
        recovery: 'Fix frontmatter tags to comply with ontology rules.',
        retryable: false,
      }
    );
  }
}

// ───────────────────────────────────────────
// Layer 6: LLM Provider
// ───────────────────────────────────────────

export class LLMProviderError extends McpError {
  constructor(code: string, message: string, options?: Partial<Omit<ConstructorParameters<typeof McpError>[0], 'code' | 'layer' | 'message'>>) {
    super({
      code,
      layer: 'L6',
      severity: 'error',
      message,
      recovery: options?.recovery ?? 'Check API key, model name, and provider status.',
      retryable: options?.retryable ?? true,
      maxRetries: options?.maxRetries ?? 3,
      ...options,
    });
  }
}

export class LLMHttpError extends LLMProviderError {
  constructor(status: number, body: string) {
    super(
      'E801',
      `LLM provider HTTP error ${status}: ${body}`,
      {
        severity: 'error',
        recovery: 'Check API key, rate limits, and provider status.',
        retryable: true,
        maxRetries: 3,
      }
    );
  }
}

// ───────────────────────────────────────────
// Reserved Error Codes (documented in ERROR_CATALOG.md)
// ───────────────────────────────────────────
// These codes are defined in docs/ERROR_CATALOG.md but not yet
// implemented as dedicated error classes. They are reserved for
// future use and kept here to keep the catalog in sync.
//
// E205 — Command Not Supported (reserved for v2.3+)
// E302 — TLS Certificate Error (reserved)
// E303 — REST Endpoint Not Found (reserved)
// E403 — Circular Link Detected (reserved)
// E404 — Insufficient Links (reserved)
// E501 — Embedding Model Not Found (reserved)
// E502 — Out of Memory (Indexing) (reserved)
// E503 — Vector Dimension Mismatch (reserved)
// E601 — Meta Files Missing (reserved for bootstrap validation v2.3+)
// E602 — Context Too Large (reserved for context truncation v2.3+)
// E802 — AIModelUnavailable (reserved)
// E803 — AIStructuredOutputError (reserved)
// E804 — AIOntologyViolation (reserved)
// E805 — AIIterationLimitExceeded (reserved)
