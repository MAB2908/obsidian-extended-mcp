// v0.1b:
/**
 * Centralized configuration for Obsidian Extended MCP.
 * Configuration hierarchy (highest → lowest priority):
 *   1. Environment variables
 *   2. mcp-config.yaml (if present)
 *   3. Hardcoded defaults in this file
 */

import { readFileSync, existsSync } from 'fs';
import { load as loadYaml } from 'js-yaml';
import { resolve } from 'path';
import { ConfigError } from './errors.js';

// ───────────────────────────────────────────
// YAML loader
// ───────────────────────────────────────────
function loadYamlConfig(): Record<string, unknown> | undefined {
  const configPath = process.env.MCP_CONFIG_PATH
    ? resolve(process.env.MCP_CONFIG_PATH)
    : resolve(process.cwd(), 'mcp-config.yaml');
  if (!existsSync(configPath)) return undefined;
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return loadYaml(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const yamlConfig = loadYamlConfig();

function yamlVal<T>(section: string, key: string): T | undefined {
  if (!yamlConfig) return undefined;
  const sec = yamlConfig[section] as Record<string, unknown> | undefined;
  if (!sec) return undefined;
  return sec[key] as T | undefined;
}

// ───────────────────────────────────────────
// Helper: read env with fallback
// ───────────────────────────────────────────
function env(key: string, fallback: string): string;
function env(key: string, fallback?: string): string | undefined;
function env(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const lower = val.trim().toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true;
  if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') return false;
  return fallback;
}

function envNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined || val.trim() === '') return fallback;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envList(key: string, fallback: string[]): string[] {
  const val = process.env[key];
  if (!val) return fallback;
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

// ───────────────────────────────────────────
// Server Configuration
// ───────────────────────────────────────────
export const serverConfig = {
  /** Path to Obsidian vault */
  vaultPath: env('OBSIDIAN_VAULT_PATH', yamlVal('server', 'vaultPath') ?? './vault'),

  /** Enable multi-vault mode */
  multiVault: envBool('MULTI_VAULT', yamlVal('server', 'multiVault') ?? false),

  /** Bearer token for transport auth (min 32 bytes recommended) */
  authToken: env('MCP_AUTH_TOKEN', yamlVal('server', 'authToken') ?? ''),

  /** Enforce ontology rules on writes */
  enforceOntology: envBool('ENFORCE_ONTOLOGY', yamlVal('server', 'enforceOntology') ?? false),
} as const;

// ───────────────────────────────────────────
// Auto-Dreaming Configuration
// ───────────────────────────────────────────
export const autoDreamingConfig = {
  /** Enable automatic dreaming pipeline */
  enabled: envBool('AUTO_DREAM_ENABLED', yamlVal('autoDreaming', 'enabled') ?? false),

  /** Interval between auto-dream runs (hours) */
  intervalHours: parseInt(env('AUTO_DREAM_INTERVAL', yamlVal('autoDreaming', 'intervalHours') ?? '24'), 10),

  /** Watch file changes and trigger auto-dream after debounce */
  watch: envBool('AUTO_DREAM_WATCH', yamlVal('autoDreaming', 'watch') ?? true),

  /** Debounce delay after file change (minutes) */
  debounceMinutes: parseInt(env('AUTO_DREAM_DEBOUNCE', yamlVal('autoDreaming', 'debounceMinutes') ?? '5'), 10),

  /** Only run dry-run (safe preview mode) */
  dryRun: envBool('AUTO_DREAM_DRY_RUN', yamlVal('autoDreaming', 'dryRun') ?? false),
} as const;

// ───────────────────────────────────────────
// LLM / AI Configuration
// ───────────────────────────────────────────
export const llmConfig = {
  /** Default LLM provider name */
  defaultProvider: env('DEFAULT_LLM_PROVIDER', yamlVal('llm', 'defaultProvider') ?? 'openai'),

  /** OpenAI API key */
  openAiKey: env('OPENAI_API_KEY', yamlVal('llm', 'openAiKey') ?? ''),

  /** OpenAI model name */
  openAiModel: env('OPENAI_MODEL', yamlVal('llm', 'openAiModel') ?? ''),

  /** Anthropic API key */
  anthropicKey: env('ANTHROPIC_API_KEY', yamlVal('llm', 'anthropicKey') ?? ''),

  /** Anthropic model name */
  anthropicModel: env('ANTHROPIC_MODEL', yamlVal('llm', 'anthropicModel') ?? ''),

  /** Ollama base URL */
  ollamaBaseUrl: env('OLLAMA_BASE_URL', yamlVal('llm', 'ollamaBaseUrl') ?? 'http://localhost:11434'),

  /** Ollama API key (for Ollama Cloud) */
  ollamaApiKey: env('OLLAMA_API_KEY', yamlVal('llm', 'ollamaApiKey') ?? ''),

  /** Ollama model name for LLM inference */
  ollamaModel: env('OLLAMA_MODEL', yamlVal('llm', 'ollamaModel') ?? 'nomic-embed-text'),

  /** Max LLM adapter cache size (entries) */
  maxCacheSize: envNumber('LLM_MAX_CACHE_SIZE', yamlVal('llm', 'maxCacheSize') ?? 1000),

  /** LLM adapter cache TTL in milliseconds */
  cacheTtlMs: envNumber('LLM_CACHE_TTL_MS', yamlVal('llm', 'cacheTtlMs') ?? 60 * 60 * 1000),

  /** Max retry attempts for LLM calls */
  maxRetries: envNumber('LLM_MAX_RETRIES', yamlVal('llm', 'maxRetries') ?? 3),

  /** Base retry delay in milliseconds */
  retryBaseDelayMs: envNumber('LLM_RETRY_BASE_DELAY_MS', yamlVal('llm', 'retryBaseDelayMs') ?? 1000),
} as const;

// ───────────────────────────────────────────
// Semantic / Embedding Configuration
// ───────────────────────────────────────────
export const semanticConfig = {
  /** Enable vector semantic search */
  enabled: envBool('SEMANTIC_ENABLED', yamlVal('semantic', 'enabled') ?? false),

  /** OpenAI embedding model */
  embedModel: env('EMBED_MODEL', yamlVal('semantic', 'embedModel') ?? 'text-embedding-3-small'),

  /** Ollama embedding model */
  ollamaEmbedModel: env('OLLAMA_EMBED_MODEL', yamlVal('semantic', 'ollamaEmbedModel') ?? 'nomic-embed-text'),

  /** BM25 parameter k1 */
  bm25K1: envNumber('BM25_K1', yamlVal('semantic', 'bm25K1') ?? 1.5),

  /** BM25 parameter b */
  bm25B: envNumber('BM25_B', yamlVal('semantic', 'bm25B') ?? 0.75),

  /** Default BM25 search limit */
  bm25DefaultLimit: envNumber('BM25_DEFAULT_LIMIT', yamlVal('semantic', 'bm25DefaultLimit') ?? 50),

  /** RRF fusion constant K */
  rrfK: envNumber('RRF_K', yamlVal('semantic', 'rrfK') ?? 60),

  /** Graph PageRank iterations */
  pageRankIterations: envNumber('GRAPH_PAGERANK_ITERATIONS', yamlVal('semantic', 'pageRankIterations') ?? 20),

  /** Graph PageRank damping factor */
  pageRankDamping: envNumber('GRAPH_PAGERANK_DAMPING', yamlVal('semantic', 'pageRankDamping') ?? 0.85),

  /** Graph community detection max passes */
  communityMaxPasses: envNumber('GRAPH_COMMUNITY_MAX_PASSES', yamlVal('semantic', 'communityMaxPasses') ?? 10),

  /** Graph BFS pathfinding max depth */
  pathMaxDepth: envNumber('GRAPH_PATH_MAX_DEPTH', yamlVal('semantic', 'pathMaxDepth') ?? 5),

  /** Background indexer debounce milliseconds */
  indexerDebounceMs: envNumber('INDEXER_DEBOUNCE_MS', yamlVal('semantic', 'indexerDebounceMs') ?? 2000),

  /** TopicLoader batch size for dreaming layer */
  topicLoaderBatchSize: envNumber('TOPIC_LOADER_BATCH_SIZE', yamlVal('semantic', 'topicLoaderBatchSize') ?? 10),

  /** Semantic search default limit */
  semanticSearchLimit: envNumber('SEMANTIC_SEARCH_LIMIT', yamlVal('semantic', 'semanticSearchLimit') ?? 20),

  /** Semantic RAG default top_k */
  semanticRagTopK: envNumber('SEMANTIC_RAG_TOP_K', yamlVal('semantic', 'semanticRagTopK') ?? 5),
} as const;

// ───────────────────────────────────────────
// Security Configuration
// ───────────────────────────────────────────
export const securityConfig = {
  /** Approval mode: auto | interactive | strict */
  approvalMode: env('APPROVAL_MODE', yamlVal('security', 'approvalMode') ?? 'auto') as 'auto' | 'interactive' | 'strict',

  /** Global read-only mode */
  readOnly: envBool('READ_ONLY', yamlVal('security', 'readOnly') ?? false),

  /** Enable cli_command / cli_plugin */
  enableCommands: envBool('ENABLE_COMMANDS', yamlVal('security', 'enableCommands') ?? false),

  /** Enable cli_eval */
  enableEval: envBool('ENABLE_EVAL', yamlVal('security', 'enableEval') ?? false),

  /** Enable batch_edit */
  enableBatchEdit: envBool('ENABLE_BATCH_EDIT', yamlVal('security', 'enableBatchEdit') ?? false),

  /** Enable delete_note */
  enableDelete: envBool('ENABLE_DELETE', yamlVal('security', 'enableDelete') ?? false),

  /** Safe zones (writable without confirmation) */
  safeZones: envList('SAFE_ZONES', yamlVal<string[]>('security', 'safeZones') ?? ['raw/', 'sessions/']),

  /** Writable paths */
  writePaths: envList('WRITE_PATHS', yamlVal<string[]>('security', 'writePaths') ?? ['*']),

  /** Forbidden paths */
  forbiddenPaths: envList('FORBIDDEN_PATHS', yamlVal<string[]>('security', 'forbiddenPaths') ?? ['.git/', '.obsidian/', '.trash/']),

  /** Sandbox timeout in milliseconds */
  sandboxTimeoutMs: envNumber('SANDBOX_TIMEOUT_MS', yamlVal('security', 'sandboxTimeoutMs') ?? 5000),

  /** Sandbox allowed globals (comma-separated) */
  sandboxAllowedGlobals: envList('SANDBOX_ALLOWED_GLOBALS', yamlVal<string[]>('security', 'sandboxAllowedGlobals') ?? ['app', 'DataviewAPI', 'moment', 'MetadataCache']),

  /** Audit log format */
  auditFormat: env('AUDIT_FORMAT', yamlVal('security', 'auditFormat') ?? 'jsonl') as 'jsonl' | 'csv' | 'markdown',

  /** Audit log max age in days */
  auditMaxAgeDays: envNumber('AUDIT_MAX_AGE_DAYS', yamlVal('security', 'auditMaxAgeDays') ?? 30),

  /** Audit log batch size */
  auditBatchSize: envNumber('AUDIT_BATCH_SIZE', yamlVal('security', 'auditBatchSize') ?? 100),

  /** Audit log flush interval in milliseconds */
  auditFlushIntervalMs: envNumber('AUDIT_FLUSH_INTERVAL_MS', yamlVal('security', 'auditFlushIntervalMs') ?? 5000),

  /** Audit log rotation threshold in MB */
  auditRotationMb: envNumber('AUDIT_ROTATION_MB', yamlVal('security', 'auditRotationMb') ?? 10),

  /** Audit log max in-memory buffer size (entries) */
  auditMaxBufferSize: envNumber('AUDIT_MAX_BUFFER_SIZE', yamlVal('security', 'auditMaxBufferSize') ?? 10000),
} as const;

// ───────────────────────────────────────────
// CLI / REST Bridge Configuration
// ───────────────────────────────────────────
export const bridgeConfig = {
  /** Path to obsidian-cli binary */
  obsidianCliPath: env('OBSIDIAN_CLI_PATH', yamlVal('bridge', 'obsidianCliPath') ?? ''),

  /** REST API base URL */
  restApiUrl: env('REST_API_URL', yamlVal('bridge', 'restApiUrl') ?? 'http://localhost:27123'),

  /** REST API bearer token */
  restApiToken: env('REST_API_TOKEN', yamlVal('bridge', 'restApiToken') ?? ''),
} as const;

// ───────────────────────────────────────────
// Pipeline / AI Agent Configuration
// ───────────────────────────────────────────
export const pipelineConfig = {
  /** Compile agent: look back N days for changes */
  compileSinceDays: envNumber('PIPELINE_COMPILE_SINCE_DAYS', yamlVal('pipeline', 'compileSinceDays') ?? 30),

  /** MOC staleness threshold in days */
  mocAgeDays: envNumber('PIPELINE_MOC_AGE_DAYS', yamlVal('pipeline', 'mocAgeDays') ?? 90),

  /** Minimum confidence for AI suggestions to be applied */
  minConfidence: envNumber('PIPELINE_MIN_CONFIDENCE', yamlVal('pipeline', 'minConfidence') ?? 0.7),

  /** Max age in days for a note to remain in 'seedling' status before lint flags it */
  seedlingMaxAgeDays: envNumber('PIPELINE_SEEDLING_MAX_AGE_DAYS', yamlVal('pipeline', 'seedlingMaxAgeDays') ?? 90),
} as const;

// ───────────────────────────────────────────
// Filesystem Path Configuration
// ───────────────────────────────────────────
export const fsConfig = {
  /** Trash directory name inside vault */
  trashDir: env('FS_TRASH_DIR', yamlVal('fs', 'trashDir') ?? '.trash'),

  /** Backup base directory relative to vault root */
  backupDir: env('FS_BACKUP_DIR', yamlVal('fs', 'backupDir') ?? '.mcp-cache/backups'),

  /** Maximum number of backups to retain */
  maxBackups: envNumber('FS_MAX_BACKUPS', yamlVal('fs', 'maxBackups') ?? 20),

  /** Maximum note size in bytes (10 MB) */
  maxNoteSize: envNumber('FS_MAX_NOTE_SIZE', yamlVal('fs', 'maxNoteSize') ?? 10 * 1024 * 1024),
} as const;

// ───────────────────────────────────────────
// File Type Router Configuration
// ───────────────────────────────────────────
export const fileTypeConfig = {
  /** Text file extensions recognized by FileTypeRouter */
  textExtensions: envList('FILE_TEXT_EXTENSIONS', yamlVal<string[]>('fileType', 'textExtensions') ?? [
    '.md', '.txt', '.json', '.canvas', '.svg', '.css', '.js', '.ts', '.html', '.xml', '.yaml', '.yml',
  ]),
} as const;

// ───────────────────────────────────────────
// Validation
// ───────────────────────────────────────────
export function validateConfig(): void {
  if (serverConfig.authToken && serverConfig.authToken.length < 32) {
    throw new ConfigError('AUTH_TOKEN_TOO_SHORT', 'MCP_AUTH_TOKEN must be at least 32 characters when provided');
  }
  if (semanticConfig.enabled && !llmConfig.openAiKey && llmConfig.ollamaBaseUrl === 'http://localhost:11434' && !process.env.OLLAMA_BASE_URL) {
    throw new ConfigError('SEMANTIC_MISSING_PROVIDER', 'SEMANTIC_ENABLED=true requires OPENAI_API_KEY or OLLAMA_BASE_URL');
  }
  if (!['auto', 'interactive', 'strict'].includes(securityConfig.approvalMode)) {
    throw new ConfigError('INVALID_APPROVAL_MODE', `Invalid APPROVAL_MODE: ${securityConfig.approvalMode}. Must be auto, interactive, or strict`);
  }
}
