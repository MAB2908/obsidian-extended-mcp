/**
 * Centralized configuration for Obsidian Extended MCP.
 * Configuration hierarchy (highest → lowest priority):
 *   1. Environment variables
 *   2. mcp-config.yaml (if present)
 *   3. Hardcoded defaults in this file
 */
export declare const serverConfig: {
    /** Path to Obsidian vault */
    readonly vaultPath: string;
    /** Enable multi-vault mode */
    readonly multiVault: boolean;
    /** Bearer token for transport auth (min 32 bytes recommended) */
    readonly authToken: string;
    /** Enforce ontology rules on writes */
    readonly enforceOntology: boolean;
};
export declare const autoDreamingConfig: {
    /** Enable automatic dreaming pipeline */
    readonly enabled: boolean;
    /** Interval between auto-dream runs (hours) */
    readonly intervalHours: number;
    /** Watch file changes and trigger auto-dream after debounce */
    readonly watch: boolean;
    /** Debounce delay after file change (minutes) */
    readonly debounceMinutes: number;
    /** Only run dry-run (safe preview mode) */
    readonly dryRun: boolean;
};
export declare const llmConfig: {
    /** Default LLM provider name */
    readonly defaultProvider: string;
    /** OpenAI API key */
    readonly openAiKey: string;
    /** OpenAI model name */
    readonly openAiModel: string;
    /** Anthropic API key */
    readonly anthropicKey: string;
    /** Anthropic model name */
    readonly anthropicModel: string;
    /** Ollama base URL */
    readonly ollamaBaseUrl: string;
    /** Ollama API key (for Ollama Cloud) */
    readonly ollamaApiKey: string;
    /** Ollama model name for LLM inference */
    readonly ollamaModel: string;
    /** Max LLM adapter cache size (entries) */
    readonly maxCacheSize: number;
    /** LLM adapter cache TTL in milliseconds */
    readonly cacheTtlMs: number;
    /** Max retry attempts for LLM calls */
    readonly maxRetries: number;
    /** Base retry delay in milliseconds */
    readonly retryBaseDelayMs: number;
};
export declare const semanticConfig: {
    /** Enable vector semantic search */
    readonly enabled: boolean;
    /** OpenAI embedding model */
    readonly embedModel: string;
    /** Ollama embedding model */
    readonly ollamaEmbedModel: string;
    /** BM25 parameter k1 */
    readonly bm25K1: number;
    /** BM25 parameter b */
    readonly bm25B: number;
    /** Default BM25 search limit */
    readonly bm25DefaultLimit: number;
    /** RRF fusion constant K */
    readonly rrfK: number;
    /** Graph PageRank iterations */
    readonly pageRankIterations: number;
    /** Graph PageRank damping factor */
    readonly pageRankDamping: number;
    /** Graph community detection max passes */
    readonly communityMaxPasses: number;
    /** Graph BFS pathfinding max depth */
    readonly pathMaxDepth: number;
    /** Background indexer debounce milliseconds */
    readonly indexerDebounceMs: number;
    /** TopicLoader batch size for dreaming layer */
    readonly topicLoaderBatchSize: number;
    /** Semantic search default limit */
    readonly semanticSearchLimit: number;
    /** Semantic RAG default top_k */
    readonly semanticRagTopK: number;
};
export declare const securityConfig: {
    /** Approval mode: auto | interactive | strict */
    readonly approvalMode: "auto" | "interactive" | "strict";
    /** Global read-only mode */
    readonly readOnly: boolean;
    /** Enable cli_command / cli_plugin */
    readonly enableCommands: boolean;
    /** Enable cli_eval */
    readonly enableEval: boolean;
    /** Enable batch_edit */
    readonly enableBatchEdit: boolean;
    /** Enable delete_note */
    readonly enableDelete: boolean;
    /** Safe zones (writable without confirmation) */
    readonly safeZones: string[];
    /** Writable paths */
    readonly writePaths: string[];
    /** Forbidden paths */
    readonly forbiddenPaths: string[];
    /** Sandbox timeout in milliseconds */
    readonly sandboxTimeoutMs: number;
    /** Sandbox allowed globals (comma-separated) */
    readonly sandboxAllowedGlobals: string[];
    /** Audit log format */
    readonly auditFormat: "jsonl" | "csv" | "markdown";
    /** Audit log max age in days */
    readonly auditMaxAgeDays: number;
    /** Audit log batch size */
    readonly auditBatchSize: number;
    /** Audit log flush interval in milliseconds */
    readonly auditFlushIntervalMs: number;
    /** Audit log rotation threshold in MB */
    readonly auditRotationMb: number;
    /** Audit log max in-memory buffer size (entries) */
    readonly auditMaxBufferSize: number;
};
export declare const bridgeConfig: {
    /** Path to obsidian-cli binary */
    readonly obsidianCliPath: string;
    /** REST API base URL */
    readonly restApiUrl: string;
    /** REST API bearer token */
    readonly restApiToken: string;
};
export declare const pipelineConfig: {
    /** Compile agent: look back N days for changes */
    readonly compileSinceDays: number;
    /** MOC staleness threshold in days */
    readonly mocAgeDays: number;
    /** Minimum confidence for AI suggestions to be applied */
    readonly minConfidence: number;
    /** Max age in days for a note to remain in 'seedling' status before lint flags it */
    readonly seedlingMaxAgeDays: number;
};
export declare const fsConfig: {
    /** Trash directory name inside vault */
    readonly trashDir: string;
    /** Backup base directory relative to vault root */
    readonly backupDir: string;
    /** Maximum number of backups to retain */
    readonly maxBackups: number;
    /** Maximum note size in bytes (10 MB) */
    readonly maxNoteSize: number;
};
export declare const fileTypeConfig: {
    /** Text file extensions recognized by FileTypeRouter */
    readonly textExtensions: string[];
};
export declare function validateConfig(): void;
//# sourceMappingURL=config.d.ts.map