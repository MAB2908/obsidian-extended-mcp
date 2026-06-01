v0.1b: 
# Руководство по внедрению — Obsidian Extended MCP

> **Версия:** 0.1b  
> **Дата:** 2026-05-27  
> **Область:** TypeScript-интерфейсы, псевдокод компонентов, схемы БД, конфигурация, окружение  
> **Язык:** Русский (код на TypeScript)

---

## Содержание

1. [TypeScript Интерфейсы](#1-typescript-интерфейсы)
2. [Dispatcher (Диспетчер)](#2-dispatcher-диспетчер)
3. [Graph Engine](#3-graph-engine)
4. [Tag Engine](#4-tag-engine)
5. [BM25 Search Engine](#5-bm25-search-engine)
6. [SQLite Схема (Semantic Layer)](#6-sqlite-схема-semantic-layer)
7. [Конфигурация](#7-конфигурация)
8. [Переменные окружения](#8-переменные-окружения)
9. [MCP Client Config](#9-mcp-client-config)
10. [File Lock & Atomic Writes](#10-file-lock--atomic-writes)
11. [Background Indexer](#11-background-indexer)
12. [File Type Router](#12-file-type-router)
13. [LLM Adapter (AI Core)](#13-llm-adapter-ai-core)
14. [AI Agents](#14-ai-agents)

---

## 1. TypeScript Интерфейсы

### 1.1. Базовые типы

```typescript
// src/types/common.ts

export interface VaultConfig {
  vaultPath: string;
  cacheDir: string;
  backupBeforeWrite: boolean;
  softDeleteMode: 'local' | 'system' | 'none';
  pluginBridge: 'auto' | 'cli' | 'rest' | 'filesystem-only';
  obsidianCliPath?: string;
  restApiUrl?: string;
  restApiToken?: string;
  contextBootstrap: ContextBootstrapConfig;
  semantic?: SemanticConfig;
  llm?: LlmConfig;
}

export interface ContextBootstrapConfig {
  enabled: boolean;
  maxTokens: number; // max 20% of context window
  includeOntology: boolean;
  includeProtocol: boolean;
  includeLinkRules: boolean;
  includeStructure: boolean;
  includeSkills: boolean;
  includeSessionHistory: number; // last N sessions
}

export interface SemanticConfig {
  enabled: boolean;
  provider: 'transformers.js' | 'ollama' | 'openai';
  ollamaUrl?: string;
  ollamaModel?: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
}

export interface LlmConfig {
  provider: 'ollama' | 'claude' | 'openai' | 'kimi';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature: number;
}

export interface Note {
  path: string;
  content: string;
  frontmatter: Record<string, any>;
  title: string;
  tags: string[];
  outboundLinks: string[];
  inboundLinks: string[];
  created?: Date;
  modified?: Date;
}

export interface GraphNode {
  path: string;
  title: string;
  aliases: string[];
  tags: string[];
  frontmatter: Record<string, any>;
  outbound: string[];
  inbound: string[];
  isOrphan: boolean;
  isDeadend: boolean;
  hasUnresolvedLinks: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'wikilink' | 'backlink' | 'implicit' | 'alias';
  context?: string; // heading or surrounding text
}

export interface Graph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  unresolved: Array<{ source: string; link: string; line: number }>;
  orphans: string[];
  deadends: string[];
}

export interface SearchResult {
  path: string;
  score: number;
  snippet: string;
  highlights: string[];
}

export interface SuggestedEdit {
  file: string;
  action: 'create' | 'append' | 'prepend' | 'replace' | 'patch' | 'delete' | 'create_link' | 'rename';
  section?: string;
  content?: string;
  target?: string;
  reason?: string;
  confidence?: number;
}

// --- Вспомогательные типы (KP-3) ---

export interface ReadNoteOptions {
  includeFrontmatter?: boolean;
  includeContent?: boolean;
}

export interface WriteNoteOptions {
  frontmatter?: Record<string, any>;
  backup?: boolean;
  overwrite?: boolean;
}

export interface DeleteOptions {
  soft?: boolean; // true = move to .trash/, false = permanent delete
}

export interface ListFilter {
  folder?: string;
  tags?: string[];
  glob?: string;
  since?: Date;
  until?: Date;
}

export interface SearchOptions {
  folder?: string;
  limit?: number;
  offset?: number;
  includeSnippets?: boolean;
}

export type PatchOp = 'replace' | 'append' | 'prepend' | 'delete';

export interface CompileResult {
  newConcepts: string[];
  updatedConcepts: string[];
  updatedMocs: string[];
  orphanedSources: string[];
  errors: string[];
}

export interface LintReport {
  critical: Array<{ description: string; file: string; line?: number; suggestedAction: string }>;
  warnings: Array<{ description: string; file: string; suggestedAction: string }>;
  recommendations: Array<{ description: string; suggestedAction: string }>;
  suggestedEdits: SuggestedEdit[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FolderRules {
  requiredTags: string[];
  forbiddenTags: string[];
  minLinks?: number;
}
```

### 1.2. Интерфейсы слоёв

```typescript
// src/layers/interfaces.ts

export interface ILayer1Filesystem {
  readNote(path: string, opts?: ReadNoteOptions): Promise<Note>;
  writeNote(path: string, content: string, opts?: WriteNoteOptions): Promise<void>;
  appendNote(path: string, content: string): Promise<void>;
  patchNote(path: string, target: string, operation: PatchOp, content: string): Promise<void>;
  deleteNote(path: string, opts?: DeleteOptions): Promise<void>;
  moveNote(from: string, to: string): Promise<void>;
  listNotes(folder: string, filter?: ListFilter): Promise<string[]>;
  searchNotes(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  getBacklinks(path: string): Promise<string[]>;
  getForwardLinks(path: string): Promise<string[]>;
  getGraph(depth?: number): Promise<Graph>;
  getGraphNeighbors(path: string, depth: number, direction: 'both' | 'in' | 'out'): Promise<Graph>;
  manageTags(path: string, action: 'add' | 'remove' | 'set', tags: string[]): Promise<void>;
  listAllTags(): Promise<Record<string, number>>;
  batchEdit(filter: ListFilter, operation: string, target: string, replacement?: string): Promise<number>;
  readCanvas(path: string): Promise<any>;
  analyzeCentrality(path?: string): Promise<Record<string, number>>;
  detectCommunities(): Promise<Array<string[]>>;
  findPath(fromPath: string, toPath: string): Promise<string[] | null>;
  validateNote(path: string): Promise<ValidationResult>;
  getVaultRules(): Promise<{ ontology: string; protocol: string; linkRules: string }>;
}

export interface ILayer2CliBridge {
  isAvailable(): Promise<boolean>;
  eval(code: string, timeout?: number): Promise<any>;
  backlinks(path: string): Promise<Array<{ source: string; line: number; context?: string }>>;
  orphans(folder?: string): Promise<string[]>;
  unresolved(folder?: string): Promise<Array<{ link: string; source: string; line: number }>>;
  deadends(folder?: string): Promise<string[]>;
  properties(file: string, action: 'read' | 'set' | 'remove' | 'list', property?: string, value?: string): Promise<any>;
  search(query: string, context?: boolean): Promise<SearchResult[]>;
  daily(action: 'read' | 'append' | 'prepend', content?: string): Promise<string>;
  command(name: string): Promise<void>;
  plugin(action: string, id?: string): Promise<any>;

}

export interface ILayer2bRestBridge {
  isAvailable(): Promise<boolean>;
  activeNote(): Promise<Note | null>;
  executeDataview(query: string): Promise<any>;

}

export interface ILayer3Pipeline {
  ingest(rawPath: string, autoCompile?: boolean): Promise<string>; // returns concept path
  compile(sinceDays?: number, dryRun?: boolean): Promise<CompileResult>;
  query(userQuery: string, contextPaths?: string[]): Promise<{ answer: string; citations: string[]; suggestedEdits: SuggestedEdit[] }>;
  lint(fix?: boolean): Promise<LintReport>;
  sessionLog(query: string, response: string, suggestedEdits?: SuggestedEdit[], tags?: string[]): Promise<string>;
  autoLink(path: string): Promise<Array<{ phrase: string; target: string; confidence: number }>>;
  createMoc(domain: string): Promise<string>;
  suggestEdits(path: string): Promise<SuggestedEdit[]>;
}

export interface ILayer4Semantic {
  search(query: string, topK?: number): Promise<Array<{ path: string; score: number }>>;
  rag(query: string, topK?: number): Promise<Array<{ chunkId: number; content: string; path: string; score: number }>>;
  indexVault(): Promise<void>;

}

export interface ILayer5ContextBootstrap {
  generatePrompt(): Promise<string>;
  getTokenCount(): Promise<number>;
}
```

### 1.3. Интерфейс Dispatcher

```typescript
// src/dispatcher/interfaces.ts

export interface ToolRoute {
  toolName: string;
  preferredLayer: 'cli' | 'rest' | 'filesystem' | 'pipeline' | 'semantic' | 'none';
  fallbackLayers: Array<'cli' | 'rest' | 'filesystem' | 'pipeline' | 'semantic'>;
  requiresObsidian: boolean;
  readOnly: boolean;
}

export interface DispatchResult<T = any> {
  data: T;
  meta: {
    layer: string;
    durationMs: number;
    fallbackUsed: boolean;
    cached: boolean;
  };
}

export interface IDispatcher {
  register(route: ToolRoute): void;
  dispatch<T>(toolName: string, args: Record<string, any>): Promise<DispatchResult<T>>;
  getLayerStatus(): LayerStatus;
}

export interface LayerStatus {
  filesystem: 'active';
  cli: 'active' | 'unavailable' | 'reconnecting';
  rest: 'active' | 'unavailable';
  lastCheck: Date;
}
```

### 1.4. Базовые классы ошибок

```typescript
// src/errors/McpError.ts

export class McpError extends Error {
  code: string;
  layer: string;
  retryable: boolean;
  severity: 'info' | 'warning' | 'error' | 'fatal';

  constructor(code: string, message: string, layer: string, retryable = false, severity: 'info' | 'warning' | 'error' | 'fatal' = 'error') {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.layer = layer;
    this.retryable = retryable;
    this.severity = severity;
  }
}

// Layer 1: Filesystem
export class FileSystemError extends McpError {
  constructor(code: string, message: string, retryable = false) {
    super(code, message, 'filesystem', retryable, 'error');
    this.name = 'FileSystemError';
  }
}

// Layer 2: CLI Bridge
export class CliError extends McpError {
  constructor(code: string, message: string, retryable = true) {
    super(code, message, 'cli', retryable, 'error');
    this.name = 'CliError';
  }
}

// Layer 2b: REST Bridge
export class RestError extends McpError {
  constructor(code: string, message: string, retryable = true) {
    super(code, message, 'rest', retryable, 'error');
    this.name = 'RestError';
  }
}

// Layer 3: Pipeline
export class PipelineError extends McpError {
  constructor(code: string, message: string, retryable = false) {
    super(code, message, 'pipeline', retryable, 'error');
    this.name = 'PipelineError';
  }
}

// Layer 4: Semantic
export class SemanticError extends McpError {
  constructor(code: string, message: string, retryable = false) {
    super(code, message, 'semantic', retryable, 'error');
    this.name = 'SemanticError';
  }
}

// Layer 5: Context Bootstrap
export class BootstrapError extends McpError {
  constructor(code: string, message: string, retryable = false) {
    super(code, message, 'bootstrap', retryable, 'error');
    this.name = 'BootstrapError';
  }
}

// Security
export class SecurityError extends McpError {
  constructor(code: string, message: string) {
    super(code, message, 'security', false, 'fatal');
    this.name = 'SecurityError';
  }
}

// AI Core
export class AIError extends McpError {
  constructor(code: string, message: string, retryable = false) {
    super(code, message, 'ai', retryable, 'error');
    this.name = 'AIError';
  }
}

// Config
export class ConfigError extends McpError {
  constructor(code: string, message: string) {
    super(code, message, 'config', false, 'fatal');
    this.name = 'ConfigError';
  }
}

// Runtime
export class RuntimeError extends McpError {
  constructor(code: string, message: string, retryable = false) {
    super(code, message, 'runtime', retryable, 'error');
    this.name = 'RuntimeError';
  }
}

export class LayerUnavailableError extends Error {
  constructor(layer: string) {
    super(`Layer unavailable: ${layer}`);
    this.name = 'LayerUnavailableError';
  }
}
```

---

## 2. Dispatcher (Диспетчер)

### 2.1. Реализация

```typescript
// src/dispatcher/Dispatcher.ts

class Dispatcher implements IDispatcher {
  private routes = new Map<string, ToolRoute>();
  private layers: {
    filesystem: ILayer1Filesystem;
    cli: ILayer2CliBridge;
    rest: ILayer2bRestBridge;
    pipeline: ILayer3Pipeline;
    semantic: ILayer4Semantic;
  };
  private layerStatus: LayerStatus = {
    filesystem: 'active',
    cli: 'unavailable',
    rest: 'unavailable',
    lastCheck: new Date(),
  };

  constructor(layers: { filesystem: ILayer1Filesystem; cli: ILayer2CliBridge; rest: ILayer2bRestBridge; pipeline: ILayer3Pipeline; semantic: ILayer4Semantic }) {
    this.layers = layers;
    this.startHealthCheck();
  }

  register(route: ToolRoute): void {
    this.routes.set(route.toolName, route);
  }

  async dispatch<T>(toolName: string, args: Record<string, any>): Promise<DispatchResult<T>> {
    const route = this.routes.get(toolName);
    if (!route) throw new ConfigError('E205', `Unknown tool: ${toolName}`);

    const start = Date.now();
    let fallbackUsed = false;

    // Попытка 1: Preferred Layer
    try {
      const result = await this.executeOnLayer(route.preferredLayer, toolName, args);
      return {
        data: result,
        meta: { layer: route.preferredLayer, durationMs: Date.now() - start, fallbackUsed: false, cached: false },
      };
    } catch (e) {
      if (e instanceof LayerUnavailableError) {
        fallbackUsed = true;
      } else {
        throw e;
      }
    }

    // Попытка 2+: Fallback Layers
    for (const layer of route.fallbackLayers) {
      try {
        const result = await this.executeOnLayer(layer, toolName, args);
        return {
          data: result,
          meta: { layer, durationMs: Date.now() - start, fallbackUsed: true, cached: false },
        };
      } catch (e) {
        if (!(e instanceof LayerUnavailableError)) throw e;
      }
    }

    throw new RuntimeError('E202', `All layers unavailable for tool: ${toolName}`, true);
  }

  private readonly TOOL_METHOD_MAP: Record<string, string> = {
    'graph_analyze_centrality': 'analyzeCentrality',
    'graph_detect_communities': 'detectCommunities',
    'graph_find_path': 'findPath',
  };
  private readonly methodCache: Map<string, string> = new Map();

  private toCamelCase(snake: string): string {
    return snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private resolveMethodName(toolName: string): string {
    const cached = this.methodCache.get(toolName);
    if (cached) return cached;
    const method = this.TOOL_METHOD_MAP[toolName]
      || this.toCamelCase(toolName.replace(/^(cli_|rest_|semantic_)/, ''));
    this.methodCache.set(toolName, method);
    return method;
  }

  private async executeOnLayer(layer: string, toolName: string, args: any): Promise<any> {
    const methodName = this.resolveMethodName(toolName);
    switch (layer) {
      case 'cli':
        if (!await this.layers.cli.isAvailable()) throw new LayerUnavailableError('cli');
        return this.layers.cli[methodName as keyof ILayer2CliBridge](args);
      case 'rest':
        if (!await this.layers.rest.isAvailable()) throw new LayerUnavailableError('rest');
        return this.layers.rest[methodName as keyof ILayer2bRestBridge](args);
      case 'filesystem':
        return this.layers.filesystem[methodName as keyof ILayer1Filesystem](args);
      case 'pipeline':
        return this.layers.pipeline[methodName as keyof ILayer3Pipeline](args);
      case 'semantic':
        return this.layers.semantic[methodName as keyof ILayer4Semantic](args);
      default:
        throw new ConfigError('E901', `Unknown layer: ${layer}`);
    }
  }

  private startHealthCheck(): void {
    setInterval(async () => {
      this.layerStatus.cli = (await this.layers.cli.isAvailable()) ? 'active' : 'unavailable';
      this.layerStatus.rest = (await this.layers.rest.isAvailable()) ? 'active' : 'unavailable';
      this.layerStatus.lastCheck = new Date();
    }, 30000); // каждые 30 секунд
  }

  getLayerStatus(): LayerStatus {
    return { ...this.layerStatus };
  }
}
```

### 2.2. Таблица маршрутизации (регистрация)

```typescript
// src/dispatcher/routes.ts

export const DEFAULT_ROUTES: ToolRoute[] = [
  { toolName: 'read_note', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'write_note', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'patch_note', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'move_note', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: false },
  { toolName: 'search_notes', preferredLayer: 'filesystem', fallbackLayers: ['cli'], requiresObsidian: false, readOnly: true },
  { toolName: 'fs_get_graph', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: true },
  { toolName: 'fs_graph_find_path', preferredLayer: 'filesystem', fallbackLayers: ['cli'], requiresObsidian: false, readOnly: true },
  { toolName: 'batch_edit', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'cli_eval', preferredLayer: 'cli', fallbackLayers: [], requiresObsidian: true, readOnly: true },
  { toolName: 'cli_backlinks', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: true },
  { toolName: 'cli_orphans', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: true },
  { toolName: 'cli_unresolved', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: true },
  { toolName: 'rest_active_note', preferredLayer: 'rest', fallbackLayers: ['cli'], requiresObsidian: true, readOnly: true },
  { toolName: 'rest_dataview', preferredLayer: 'rest', fallbackLayers: ['cli'], requiresObsidian: true, readOnly: true },
  // L1 Filesystem — дополнительные
  { toolName: 'append_note', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'delete_note', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'fs_list_notes', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'manage_tags', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'list_all_tags', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: true },
  { toolName: 'validate_note', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'get_vault_rules', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  // L2 CLI Bridge — дополнительные
  { toolName: 'cli_deadends', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: true },
  { toolName: 'cli_properties', preferredLayer: 'cli', fallbackLayers: [], requiresObsidian: true, readOnly: false },
  { toolName: 'cli_search', preferredLayer: 'cli', fallbackLayers: ['filesystem'], requiresObsidian: true, readOnly: true },
  { toolName: 'cli_daily', preferredLayer: 'cli', fallbackLayers: [], requiresObsidian: true, readOnly: false },
  { toolName: 'cli_command', preferredLayer: 'cli', fallbackLayers: [], requiresObsidian: true, readOnly: false },
  { toolName: 'cli_plugin', preferredLayer: 'cli', fallbackLayers: [], requiresObsidian: true, readOnly: false },

  // L2b REST Fallback — дополнительные

  // L3 Pipeline
  { toolName: 'ai_ingest', preferredLayer: 'pipeline', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'ai_compile', preferredLayer: 'pipeline', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'ai_query', preferredLayer: 'pipeline', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'ai_link', preferredLayer: 'pipeline', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'ai_enrich', preferredLayer: 'pipeline', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  // L4 Semantic
  { toolName: 'semantic_search', preferredLayer: 'semantic', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'semantic_search_db', preferredLayer: 'semantic', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'db_stats', preferredLayer: 'semantic', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'semantic_rag', preferredLayer: 'semantic', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'graph_detect_communities', preferredLayer: 'semantic', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'bm25_search', preferredLayer: 'semantic', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  // L5 Bootstrap
  { toolName: 'get_context_bootstrap', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  // L6 Security & Backup
  { toolName: 'audit_log', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'list_backups', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'rollback', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  // L7 Pool
  { toolName: 'pool_list_vaults', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'pool_add_vault', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'pool_remove_vault', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  // L8 MABS
  { toolName: 'mabs_list_models', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'mabs_set_current_model', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'mabs_snapshot_artifact', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'mabs_list_artifacts', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'mabs_artifact_history', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'mabs_list_sessions', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'mabs_can_replay', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'mabs_export_backup', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'mabs_import_backup', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'mabs_export_agnostic_bundle', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'mabs_import_agnostic_bundle', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  // L9 Dreaming
  { toolName: 'dream_scan', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dream_finalize', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dream_undo', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  // L10 Dev System
  { toolName: 'dev_prompt_list', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_prompt_get', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_prompt_create', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_prompt_delete', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_prompt_execute', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_skill_list', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_skill_get', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_skill_create', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_skill_delete', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_skill_execute', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_agent_list', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_agent_get', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_agent_create', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_agent_delete', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_workflow_list', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_workflow_get', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_workflow_create', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_workflow_delete', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_workflow_advance', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_workflow_fail', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
  { toolName: 'dev_claude_md_get', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: true },
  { toolName: 'dev_claude_md_append', preferredLayer: 'filesystem', fallbackLayers: [], requiresObsidian: false, readOnly: false },
];
```

---

## 3. Graph Engine

### 3.1. Структура данных

```typescript
// src/shared/GraphEngine.ts

interface GraphCache {
  version: number;
  lastFullBuild: string;
  nodes: Record<string, GraphNode>;
  adjacency: Record<string, string[]>; // from → to[] (serializable)
}

class GraphEngine {
  // Runtime: Map-based adjacency for O(1) edge ops
  private nodes: Record<string, GraphNode> = {};
  private outEdges: Map<string, Set<string>> = new Map(); // from → Set<to>
  private inEdges: Map<string, Set<string>> = new Map();  // to → Set<from>
  // Link resolution indices: O(1) lookup instead of O(V) scan
  private basenameIndex: Map<string, string> = new Map();   // "note.md" → "folder/note.md"
  private aliasIndex: Map<string, string> = new Map();      // alias → "folder/note.md"
  private unresolved: Array<{ link: string; source: string }> = [];
  private orphans: string[] = [];
  private deadends: string[] = [];

  private cachePath: string;
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.cachePath = path.join(vaultPath, '.mcp-cache', 'graph.json');
  }

  async initialize(): Promise<void> {
    if (await fs.exists(this.cachePath)) {
      const cached = JSON.parse(await fs.readFile(this.cachePath, 'utf8'));
      this._load(cached);
    } else {
      await this.fullRebuild();
    }
  }

  // Deserialize from JSON-safe structure
  private _load(data: GraphCache): void {
    this.nodes = data.nodes || {};
    this.outEdges = new Map();
    this.inEdges = new Map();
    this.basenameIndex = new Map();
    this.aliasIndex = new Map();
    this.unresolved = (data as any).unresolved || [];
    this.orphans = (data as any).orphans || [];
    this.deadends = (data as any).deadends || [];

    // Rebuild adjacency + indices
    const adj = data.adjacency || {};
    for (const [from, tos] of Object.entries(adj)) {
      const outSet = new Set(tos);
      this.outEdges.set(from, outSet);
      for (const to of outSet) {
        if (!this.inEdges.has(to)) this.inEdges.set(to, new Set());
        this.inEdges.get(to)!.add(from);
      }
    }
    for (const [p, node] of Object.entries(this.nodes)) {
      this.basenameIndex.set(path.basename(p), p);
      for (const alias of node.aliases) this.aliasIndex.set(alias, p);
    }
  }

  // Serialize to JSON-safe structure
  private _serialize(): GraphCache {
    const adj: Record<string, string[]> = {};
    for (const [from, tos] of this.outEdges) {
      adj[from] = Array.from(tos);
    }
    return {
      version: 2,
      lastFullBuild: new Date().toISOString(),
      nodes: this.nodes,
      adjacency: adj,
      unresolved: this.unresolved,
      orphans: this.orphans,
      deadends: this.deadends,
    } as GraphCache;
  }

  // Инкрементальное обновление при изменении файла
  async onFileChange(event: 'create' | 'modify' | 'delete' | 'rename', filePath: string, oldPath?: string): Promise<void> {
    switch (event) {
      case 'create':
        await this._addNode(filePath);
        break;
      case 'modify':
        await this._updateNode(filePath);
        break;
      case 'delete':
        await this._removeNode(filePath);
        break;
      case 'rename':
        if (oldPath) await this._renameNode(oldPath, filePath);
        break;
    }
    // Note: unresolved links are lazily validated; run fullRebuild() or lint() for full consistency
    await this._persist();
  }

  private async _addNode(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf8');
    const node = this._parseNode(filePath, content);
    this.nodes[filePath] = node;
    // Update resolution indices
    const basename = path.basename(filePath);
    this.basenameIndex.set(basename, filePath);
    for (const alias of node.aliases) {
      this.aliasIndex.set(alias, filePath);
    }
  }

  private async _updateNode(filePath: string): Promise<void> {
    const oldNode = this.nodes[filePath];
    if (!oldNode) return this._addNode(filePath);

    const content = await fs.readFile(filePath, 'utf8');
    const newNode = this._parseNode(filePath, content);

    // Diff edges using O(1) Set lookups
    const oldSet = new Set(oldNode.outbound);
    const newSet = new Set(newNode.outbound);

    for (const edge of oldNode.outbound) {
      if (!newSet.has(edge)) this._removeEdge(filePath, edge);
    }
    for (const edge of newNode.outbound) {
      if (!oldSet.has(edge)) this._addEdge(filePath, edge);
    }

    // Update alias index if aliases changed
    const oldAliases = new Set(oldNode.aliases);
    const newAliases = new Set(newNode.aliases);
    for (const alias of oldNode.aliases) {
      if (!newAliases.has(alias)) this.aliasIndex.delete(alias);
    }
    for (const alias of newNode.aliases) {
      if (!oldAliases.has(alias)) this.aliasIndex.set(alias, filePath);
    }

    this.nodes[filePath] = newNode;
  }

  private async _removeNode(filePath: string): Promise<void> {
    const node = this.nodes[filePath];
    delete this.nodes[filePath];

    // Remove all outgoing edges: O(deg_out)
    const outs = this.outEdges.get(filePath);
    if (outs) {
      for (const to of outs) {
        this.inEdges.get(to)?.delete(filePath);
      }
      this.outEdges.delete(filePath);
    }

    // Remove all incoming edges: O(deg_in)
    const ins = this.inEdges.get(filePath);
    if (ins) {
      for (const from of ins) {
        this.outEdges.get(from)?.delete(filePath);
      }
      this.inEdges.delete(filePath);
    }

    // Update resolution indices
    this.basenameIndex.delete(path.basename(filePath));
    if (node) {
      for (const alias of node.aliases) {
        this.aliasIndex.delete(alias);
      }
    }
  }

  private async _renameNode(oldPath: string, newPath: string): Promise<void> {
    const node = this.nodes[oldPath];
    if (!node) return;

    delete this.nodes[oldPath];
    node.path = newPath;
    this.nodes[newPath] = node;

    // Migrate outgoing edges
    const outs = this.outEdges.get(oldPath);
    if (outs) {
      this.outEdges.delete(oldPath);
      this.outEdges.set(newPath, outs);
      for (const to of outs) {
        this.inEdges.get(to)?.delete(oldPath);
        this.inEdges.get(to)?.add(newPath);
      }
    }

    // Migrate incoming edges
    const ins = this.inEdges.get(oldPath);
    if (ins) {
      this.inEdges.delete(oldPath);
      this.inEdges.set(newPath, ins);
      for (const from of ins) {
        this.outEdges.get(from)?.delete(oldPath);
        this.outEdges.get(from)?.add(newPath);
      }
    }

    // Update resolution indices
    this.basenameIndex.delete(path.basename(oldPath));
    this.basenameIndex.set(path.basename(newPath), newPath);
    for (const alias of node.aliases) {
      this.aliasIndex.set(alias, newPath);
    }
  }

  private _addEdge(from: string, to: string): void {
    if (!this.outEdges.has(from)) this.outEdges.set(from, new Set());
    if (!this.inEdges.has(to)) this.inEdges.set(to, new Set());
    this.outEdges.get(from)!.add(to);
    this.inEdges.get(to)!.add(from);
  }

  private _removeEdge(from: string, to: string): void {
    this.outEdges.get(from)?.delete(to);
    this.inEdges.get(to)?.delete(from);
  }

  private _resolveLink(link: string, sourcePath: string): string | null {
    // O(1) exact match by full path
    if (this.nodes[link]) return link;
    // O(1) match by basename (e.g. "note.md" or "folder/note.md")
    const basename = link.endsWith('.md') ? link : link + '.md';
    const byBasename = this.basenameIndex.get(path.basename(basename));
    if (byBasename) return byBasename;
    // O(1) alias match
    const byAlias = this.aliasIndex.get(link);
    if (byAlias) return byAlias;
    return null;
  }

  private _parseNode(filePath: string, content: string): GraphNode {
    const frontmatter = parseFrontmatter(content);
    const outbound = extractWikilinks(content);
    return {
      path: filePath,
      title: frontmatter.title || path.basename(filePath, '.md'),
      aliases: frontmatter.aliases || [],
      tags: frontmatter.tags || [],
      frontmatter,
      outbound,
      inbound: [], // computed after all nodes loaded
      isOrphan: false,
      isDeadend: outbound.length === 0,
      hasUnresolvedLinks: false,
    };
  }

  // BFS/DFS — O(V + E_local) instead of O(V * E)
  getNeighbors(startPath: string, depth: number, direction: 'both' | 'in' | 'out' = 'both'): Graph {
    const visited = new Set<string>();
    const queue: Array<{ path: string; d: number }> = [{ path: startPath, d: 0 }];
    const result: Graph = { nodes: {}, edges: [], unresolved: [], orphans: [], deadends: [] };

    while (queue.length > 0) {
      const { path: current, d } = queue.shift()!;
      if (visited.has(current) || d > depth) continue;
      visited.add(current);

      const node = this.nodes[current];
      if (!node) continue;
      result.nodes[current] = node;

      const neighbors: string[] = [];
      if (direction === 'out' || direction === 'both') {
        neighbors.push(...(this.outEdges.get(current) || []));
      }
      if (direction === 'in' || direction === 'both') {
        neighbors.push(...(this.inEdges.get(current) || []));
      }

      for (const neighbor of neighbors) {
        result.edges.push({ from: current, to: neighbor, type: 'wikilink' });
        if (!visited.has(neighbor)) queue.push({ path: neighbor, d: d + 1 });
      }
    }

    return result;
  }

  // Shortest Path (F1.15)
  findPath(fromPath: string, toPath: string): string[] | null {
    const queue: Array<{ path: string; route: string[] }> = [{ path: fromPath, route: [fromPath] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { path: current, route } = queue.shift()!;
      if (current === toPath) return route;
      if (visited.has(current)) continue;
      visited.add(current);

      const outs = this.outEdges.get(current);
      if (!outs) continue;

      for (const neighbor of outs) {
        if (!visited.has(neighbor)) {
          queue.push({ path: neighbor, route: [...route, neighbor] });
        }
      }
    }
    return null;
  }

  // Louvain Communities (F1.14) — simplified greedy
  detectCommunities(): Array<string[]> {
    const communities = new Map<string, Set<string>>();
    let communityId = 0;

    for (const [nodePath, node] of Object.entries(this.nodes)) {
      let assigned = false;
      const outs = this.outEdges.get(nodePath) || new Set();
      const ins = this.inEdges.get(nodePath) || new Set();

      for (const [id, members] of communities) {
        const hasNeighbor = [...outs, ...ins].some(n => members.has(n));
        if (hasNeighbor) {
          members.add(nodePath);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        communities.set(communityId++, new Set([nodePath]));
      }
    }

    return Array.from(communities.values()).map(s => Array.from(s));
  }

  // PageRank — O(iterations × V) instead of O(iterations × V × E)
  computePageRank(iterations = 100, damping = 0.85, epsilon = 1e-6): Record<string, number> {
    const nodeList = Object.keys(this.nodes);
    const n = nodeList.length;
    if (n === 0) return {};

    const rank: Record<string, number> = {};
    nodeList.forEach(node => rank[node] = 1 / n);

    for (let i = 0; i < iterations; i++) {
      const newRank: Record<string, number> = {};
      let delta = 0;
      for (const node of nodeList) {
        let sum = 0;
        // Use reverse adjacency: only predecessors contribute
        const predecessors = this.inEdges.get(node);
        if (predecessors) {
          for (const pred of predecessors) {
            const outDegree = this.outEdges.get(pred)?.size || 1;
            sum += rank[pred] / outDegree;
          }
        }
        newRank[node] = (1 - damping) / n + damping * sum;
        delta += Math.abs(newRank[node] - rank[node]);
      }
      Object.assign(rank, newRank);
      if (delta < epsilon) break; // early termination
    }

    return rank;
  }

  // Full rebuild from filesystem (NP-10)
  async fullRebuild(): Promise<void> {
    const files = await glob('**/*.md', { cwd: this.vaultPath, absolute: true });
    this.nodes = {};
    this.outEdges = new Map();
    this.inEdges = new Map();
    this.unresolved = [];
    this.orphans = [];
    this.deadends = [];

    // Pass 1: build nodes + resolution indices (concurrent reads)
    const CONCURRENCY = 50;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (file) => {
        const relPath = path.relative(this.vaultPath, file);
        const content = await fs.readFile(file, 'utf8');
        const node = this._parseNode(relPath, content);
        this.nodes[relPath] = node;
        this.basenameIndex.set(path.basename(relPath), relPath);
        for (const alias of node.aliases) this.aliasIndex.set(alias, relPath);
      }));
    }

    // Pass 2: build edges and resolve inbound links
    for (const [nodePath, node] of Object.entries(this.nodes)) {
      for (const target of node.outbound) {
        const targetPath = this._resolveLink(target, nodePath);
        if (targetPath && this.nodes[targetPath]) {
          this._addEdge(nodePath, targetPath);
          this.nodes[targetPath].inbound.push(nodePath);
        } else {
          this.unresolved.push({ link: target, source: nodePath });
          node.hasUnresolvedLinks = true;
        }
      }
    }

    // Pass 3: compute orphans and deadends
    for (const [nodePath, node] of Object.entries(this.nodes)) {
      const inDegree = this.inEdges.get(nodePath)?.size || 0;
      const outDegree = this.outEdges.get(nodePath)?.size || 0;
      if (inDegree === 0) this.orphans.push(nodePath);
      if (outDegree === 0) this.deadends.push(nodePath);
    }

    await this._persist();
  }

  // Public wrapper for PageRank with optional single-node lookup
  analyzeCentrality(path?: string): Record<string, number> | number {
    const ranks = this.computePageRank();
    if (path) return ranks[path] ?? 0;
    return ranks;
  }

  hasNode(filePath: string): boolean {
    return filePath in this.nodes;
  }

  /** Backward-compatible accessor: returns legacy Graph shape from Map internals */
  getGraph(): Graph {
    const edges: GraphEdge[] = [];
    for (const [from, tos] of this.outEdges) {
      for (const to of tos) {
        edges.push({ from, to, type: 'wikilink' });
      }
    }
    return {
      nodes: this.nodes,
      edges,
      unresolved: this.unresolved,
      orphans: this.orphans,
      deadends: this.deadends,
    };
  }

  private async _persist(): Promise<void> {
    const tmp = this.cachePath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(this._serialize(), null, 2));
    await fs.rename(tmp, this.cachePath);
  }
}
```

---

## 4. Tag Engine

```typescript
// src/shared/TagEngine.ts

interface TagIndex {
  tags: Record<string, string[]>; // tag → file paths
  fileTags: Record<string, string[]>; // file → tags
  invalid: Array<{ file: string; tag: string }>;
}

class TagEngine {
  private ontology: Ontology;
  private index: TagIndex = { tags: {}, fileTags: {}, invalid: [] };

  constructor(ontologyPath: string) {
    this.ontology = this.loadOntology(ontologyPath);
  }

  validateNote(filePath: string, frontmatter: any, inlineTags: string[]): ValidationResult {
    const errors: string[] = [];
    const tags = [...(frontmatter.tags || []), ...inlineTags];

    // Check required tags by folder
    const folderRules = this.getFolderRules(filePath);
    for (const required of folderRules.requiredTags) {
      if (!tags.includes(required)) errors.push(`Missing required tag: ${required}`);
    }

    // Check forbidden tags
    for (const forbidden of folderRules.forbiddenTags) {
      if (tags.includes(forbidden)) errors.push(`Forbidden tag: ${forbidden}`);
    }

    // Check ontology compliance
    for (const tag of tags) {
      if (!this.ontology.allowedTags.includes(tag)) {
        errors.push(`Tag not in ontology: ${tag}`);
        this.index.invalid.push({ file: filePath, tag });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getFolderRules(filePath: string): FolderRules {
    if (filePath.startsWith('raw/')) return { requiredTags: ['source'], forbiddenTags: ['evergreen', 'concept', 'moc'] };
    if (filePath.startsWith('concepts/')) return { requiredTags: ['concept'], forbiddenTags: ['source', 'draft'] };
    if (filePath.startsWith('index/')) return { requiredTags: ['moc'], forbiddenTags: [] };
    if (filePath.startsWith('sessions/')) return { requiredTags: ['session'], forbiddenTags: ['concept', 'moc'] };
    return { requiredTags: [], forbiddenTags: [] };
  }
}
```

---

## 5. BM25 Search Engine

```typescript
// src/shared/BM25Engine.ts

interface BM25Document {
  path: string;
  terms: string[];
  tf: Record<string, number>;
  length: number;
}

interface BM25Index {
  documents: Map<string, BM25Document>;        // path → document (O(1) lookup)
  idf: Record<string, number>;
  avgDocLength: number;
  inverted: Map<string, Set<string>>;          // term → Set<path> (inverted index)
  N: number;
}

class BM25Engine {
  private index: BM25Index | null = null;
  private idfStale = false;
  private k1 = 1.5;
  private b = 0.75;

  async buildIndex(files: string[]): Promise<void> {
    const documents = new Map<string, BM25Document>();
    const inverted = new Map<string, Set<string>>();
    let totalLength = 0;

    // Concurrent reads with bounded parallelism
    const CONCURRENCY = 50;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (file) => {
        const content = await fs.readFile(file, 'utf8');
        const terms = this.tokenize(content);
        const tf: Record<string, number> = {};
        for (const term of terms) {
          tf[term] = (tf[term] || 0) + 1;
        }
        return { file, terms, tf };
      }));

      for (const { file, terms, tf } of results) {
        for (const term of terms) {
          if (!inverted.has(term)) inverted.set(term, new Set());
          inverted.get(term)!.add(file);
        }
        documents.set(file, { path: file, terms, tf, length: terms.length });
        totalLength += terms.length;
      }
    }

    // Compute IDF
    const idf: Record<string, number> = {};
    const N = documents.size;

    for (const [term, paths] of inverted) {
      const df = paths.size;
      idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    }

    this.index = { documents, idf, avgDocLength: totalLength / N, inverted, N };
  }

  search(query: string, limit = 10): SearchResult[] {
    if (!this.index) throw new SemanticError('E105', 'BM25 index not built');
    if (this.idfStale) this._recomputeIdf();

    const queryTerms = this.tokenize(query);
    // O(k * avg_df) instead of O(N) — only scan docs containing query terms
    const candidatePaths = new Set<string>();
    for (const term of queryTerms) {
      const paths = this.index.inverted.get(term);
      if (paths) paths.forEach(p => candidatePaths.add(p));
    }

    const scores: Array<{ path: string; score: number }> = [];
    for (const path of candidatePaths) {
      const doc = this.index.documents.get(path)!;
      let score = 0;
      for (const term of queryTerms) {
        const tf = doc.tf[term] || 0;
        const idf = this.index.idf[term] || 0;
        const norm = 1 - this.b + this.b * (doc.length / this.index.avgDocLength);
        score += idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * norm));
      }
      if (score > 0) scores.push({ path, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({ path: s.path, score: s.score, snippet: '', highlights: [] }));
  }

  // Incremental updates — O(terms) instead of full rebuild
  addDocument(filePath: string, content?: string): void {
    if (!this.index) return;
    const text = content || fs.readFileSync(filePath, 'utf8');
    const terms = this.tokenize(text);
    const tf: Record<string, number> = {};
    for (const term of terms) {
      tf[term] = (tf[term] || 0) + 1;
      if (!this.index.inverted.has(term)) this.index.inverted.set(term, new Set());
      this.index.inverted.get(term)!.add(filePath);
    }
    this.index.documents.set(filePath, { path: filePath, terms, tf, length: terms.length });
    this.index.N++;
    this.idfStale = true;
  }

  updateDocument(filePath: string): void {
    if (!this.index) return;
    this.removeDocument(filePath);
    this.addDocument(filePath);
  }

  removeDocument(filePath: string): void {
    if (!this.index) return;
    const doc = this.index.documents.get(filePath);
    if (!doc) return;
    for (const term of doc.terms) {
      this.index.inverted.get(term)?.delete(filePath);
    }
    this.index.documents.delete(filePath);
    this.index.N--;
    this.idfStale = true;
  }

  private _recomputeIdf(): void {
    if (!this.index) return;
    const N = this.index.N;
    for (const [term, paths] of this.index.inverted) {
      const df = paths.size;
      this.index.idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    }
    this.idfStale = false;
  }

  private tokenize(text: string): string[] {
    // Unicode-aware: supports Cyrillic, CJK, Arabic, etc.
    return text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}
```

---

## 6. SQLite Схема (Semantic Layer)

```sql
-- src/layer4/schema.sql
-- SQLite схема для семантического движка

-- WAL mode: better concurrency and write performance
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- Узлы (заметки)
CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  title TEXT,
  content_hash TEXT, -- для инвалидации кэша
  word_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Рёбра (ссылки)
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  type TEXT DEFAULT 'wikilink', -- wikilink, backlink, implicit, alias
  context TEXT, -- heading или окружающий текст
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_path) REFERENCES nodes(path) ON DELETE CASCADE,
  FOREIGN KEY (to_path) REFERENCES nodes(path) ON DELETE CASCADE,
  UNIQUE(from_path, to_path, type)
);

-- Чанки (для semantic search)
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  heading TEXT, -- заголовок секции
  content TEXT NOT NULL,
  token_count INTEGER,
  FOREIGN KEY (node_path) REFERENCES nodes(path) ON DELETE CASCADE,
  UNIQUE(node_path, chunk_index)
);

-- Эмбеддинги
CREATE TABLE IF NOT EXISTS embeddings (
  chunk_id INTEGER PRIMARY KEY,
  model TEXT NOT NULL, -- 'all-MiniLM-L6-v2', 'nomic-embed-text'
  vector BLOB NOT NULL, -- serialized float32 array
  dimensions INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
);

-- FTS5 для гибридного поиска (BM25 + semantic)
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  path,
  title,
  content,
  tokenize = 'porter'
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_path);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_path);
CREATE INDEX IF NOT EXISTS idx_chunks_node ON chunks(node_path);
CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path);

-- Триггер: автоматическое обновление FTS при изменении nodes
CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes
BEGIN
  INSERT INTO search_index(path, title, content)
  VALUES (NEW.path, NEW.title, '');
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes
BEGIN
  UPDATE search_index SET title = NEW.title WHERE path = NEW.path;
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes
BEGIN
  DELETE FROM search_index WHERE path = OLD.path;
END;
```

### 6.1. RRF Fusion (Reciprocal Rank Fusion)

```typescript
// src/layer4/RRFusion.ts

function reciprocalRankFusion(
  keywordResults: Array<{ path: string; score: number }>,
  semanticResults: Array<{ path: string; score: number }>,
  k = 60
): Array<{ path: string; score: number }> {
  const scores: Record<string, number> = {};

  // Keyword scores (BM25)
  keywordResults.forEach((r, i) => {
    scores[r.path] = (scores[r.path] || 0) + 1 / (k + i + 1);
  });

  // Semantic scores
  semanticResults.forEach((r, i) => {
    scores[r.path] = (scores[r.path] || 0) + 1 / (k + i + 1);
  });

  return Object.entries(scores)
    .map(([path, score]) => ({ path, score }))
    .sort((a, b) => b.score - a.score);
}
```

---

## 7. Конфигурация

### 7.1. JSON Schema конфига

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ObsidianExtendedMCPConfig",
  "type": "object",
  "required": ["vaultPath"],
  "properties": {
    "vaultPath": {
      "type": "string",
      "description": "Абсолютный путь к vault"
    },
    "cacheDir": {
      "type": "string",
      "default": ".mcp-cache",
      "description": "Папка для кэша относительно vault"
    },
    "backupBeforeWrite": {
      "type": "boolean",
      "default": true
    },
    "softDeleteMode": {
      "type": "string",
      "enum": ["local", "system", "none"],
      "default": "local"
    },
    "pluginBridge": {
      "type": "string",
      "enum": ["auto", "cli", "rest", "filesystem-only"],
      "default": "auto"
    },
    "obsidianCliPath": {
      "type": "string",
      "description": "Путь к бинарнику obsidian (опционально)"
    },
    "restApiUrl": {
      "type": "string",
      "description": "URL Local REST API plugin"
    },
    "restApiToken": {
      "type": "string",
      "description": "Bearer token для REST API"
    },
    "contextBootstrap": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "maxTokens": { "type": "integer", "default": 8000 },
        "includeOntology": { "type": "boolean", "default": true },
        "includeProtocol": { "type": "boolean", "default": true },
        "includeLinkRules": { "type": "boolean", "default": true },
        "includeStructure": { "type": "boolean", "default": true },
        "includeSkills": { "type": "boolean", "default": true },
        "includeSessionHistory": { "type": "integer", "default": 3 }
      }
    },
    "semantic": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "provider": { "type": "string", "enum": ["transformers.js", "ollama", "openai"] },
        "ollamaUrl": { "type": "string", "default": "http://localhost:11434" },
        "ollamaModel": { "type": "string", "default": "nomic-embed-text" },
        "chunkSize": { "type": "integer", "default": 512 },
        "chunkOverlap": { "type": "integer", "default": 64 },
        "topK": { "type": "integer", "default": 5 }
      }
    },
    "llm": {
      "type": "object",
      "properties": {
        "provider": { "type": "string", "enum": ["ollama", "claude", "openai", "kimi"] },
        "apiKey": { "type": "string" },
        "baseUrl": { "type": "string" },
        "model": { "type": "string", "default": "llama3.1" },
        "temperature": { "type": "number", "default": 0.7 }
      }
    },
    "security": {
      "type": "object",
      "properties": {
        "readOnly": { "type": "boolean", "default": false },
        "enableCommands": { "type": "boolean", "default": false },
        "allowedPaths": { "type": "array", "items": { "type": "string" } },
        "blockedPaths": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

### 7.2. Пример конфига

```json
{
  "vaultPath": "/Users/alice/Documents/MyVault",
  "cacheDir": ".mcp-cache",
  "backupBeforeWrite": true,
  "softDeleteMode": "local",
  "pluginBridge": "auto",
  "obsidianCliPath": "/Applications/Obsidian.app/Contents/MacOS/obsidian",
  "restApiUrl": "https://127.0.0.1:27124",
  "restApiToken": "...",
  "contextBootstrap": {
    "enabled": true,
    "maxTokens": 8000,
    "includeOntology": true,
    "includeProtocol": true,
    "includeLinkRules": true,
    "includeStructure": true,
    "includeSkills": true,
    "includeSessionHistory": 3
  },
  "semantic": {
    "enabled": true,
    "provider": "ollama",
    "ollamaUrl": "http://localhost:11434",
    "ollamaModel": "nomic-embed-text",
    "chunkSize": 512,
    "chunkOverlap": 64,
    "topK": 5
  },
  "llm": {
    "provider": "ollama",
    "model": "llama3.1",
    "temperature": 0.7
  },
  "security": {
    "readOnly": false,
    "enableCommands": true,
    "allowedPaths": ["raw/", "concepts/", "index/", "sessions/"],
    "blockedPaths": [".git/", ".obsidian/"]
  }
}
```

---

## 8. Переменные окружения

| Переменная | Тип | Default | Описание |
|------------|-----|---------|----------|
| `OBSIDIAN_VAULT_PATH` | string | — | Путь к vault (обязательно) |
| `MCP_CONFIG_PATH` | string | — | Путь к mcp-config.yaml |
| `PLUGIN_BRIDGE` | string | `auto` | `auto`, `cli`, `rest`, `filesystem-only` |
| `OBSIDIAN_CLI_PATH` | string | `obsidian` | Путь к бинарнику CLI |
| `REST_API_URL` | string | — | URL Local REST API |
| `REST_API_TOKEN` | string | — | Bearer token |
| `BACKUP_BEFORE_WRITE` | boolean | `true` | Делать .bak перед записью |
| `SOFT_DELETE_MODE` | string | `local` | `local`, `system`, `none` |
| `CACHE_DIR` | string | `.mcp-cache` | Папка кэша |
| `SEMANTIC_ENABLED` | boolean | `false` | Включить семантический поиск |
| `OLLAMA_BASE_URL` | string | `http://localhost:11434` | URL Ollama |
| `OLLAMA_MODEL` | string | `nomic-embed-text` | Модель эмбеддингов |
| `DEFAULT_LLM_PROVIDER` | string | `ollama` | `ollama`, `claude`, `openai`, `kimi` |
| `OPENAI_API_KEY` | string | — | API ключ OpenAI |
| `OPENAI_MODEL` | string | `llama3.1` | Название модели |
| `ANTHROPIC_API_KEY` | string | — | API ключ Anthropic |
| `ANTHROPIC_MODEL` | string | `claude-3-5-sonnet` | Название модели Claude |
| `KIMI_API_KEY` | string | — | API ключ Moonshot AI |
| `KIMI_MODEL` | string | `kimi-k2` | Название модели Kimi |
| `READ_ONLY` | boolean | `false` | Только чтение |
| `ENABLE_COMMANDS` | boolean | `true` | Разрешить cli_command / cli_plugin |
| `ENABLE_EVAL` | boolean | `false` | Разрешить cli_eval (sandboxed, отключено по умолчанию) |
| `ENABLE_BATCH_EDIT` | boolean | `true` | Разрешить batch_edit |
| `ENABLE_DELETE` | boolean | `true` | Разрешить delete_note |
| `SAFE_ZONES` | string[] | `raw/,sessions/` | Зоны, доступные для записи без подтверждения |
| `WRITE_PATHS` | string[] | `*` | Разрешённые пути для записи |
| `FORBIDDEN_PATHS` | string[] | `.git/,.obsidian/,.trash/` | Запрещённые пути |
| `APPROVAL_MODE` | string | `auto` | `auto`, `interactive`, `strict` |
| `MCP_AUTH_TOKEN` | string | — | Токен аутентификации (мин. 32 байта) |
| `MULTI_VAULT` | boolean | `false` | Включить поддержку нескольких vault |
| `ENFORCE_ONTOLOGY` | boolean | `false` | Строгая проверка онтологии |
| `ONTOLOGY_PATH` | string | `.mcp-cache/ontology.yaml` | Путь к файлу онтологии |
| `BM25_K1` | number | `1.5` | Параметр BM25 k1 |
| `BM25_B` | number | `0.75` | Параметр BM25 b |
| `VECTOR_DIM` | number | `768` | Размерность вектора эмбеддингов |
| `VECTOR_PROVIDER` | string | `ollama` | Провайдер эмбеддингов |
| `AUDIT_FORMAT` | string | `jsonl` | Формат audit.log: `jsonl`, `csv`, `markdown` |
| `AUDIT_MAX_AGE_DAYS` | number | `30` | Срок хранения audit.log |
| `AUDIT_BATCH_SIZE` | number | `100` | Размер batch для flush |
| `AUDIT_FLUSH_INTERVAL_MS` | number | `5000` | Интервал flush в ms |
| `FILE_LOCK_TIMEOUT_MS` | number | `30000` | Таймаут файловой блокировки |
| `SANDBOX_TIMEOUT_MS` | number | `5000` | Таймаут sandbox execution |
| `SANDBOX_ALLOWED_GLOBALS` | string[] | `console,Math,JSON,Date` | Разрешённые globals в sandbox |
| `LOG_LEVEL` | string | `info` | `debug`, `info`, `warn`, `error` |
| `LOG_DIR` | string | `sessions/` | Папка для audit.log |

---

## 9. MCP Client Config

### 9.1. Claude Desktop

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "@yourscope/obsidian-extended-mcp", "/path/to/vault"],
      "env": {
        "PLUGIN_BRIDGE": "auto",
        "SEMANTIC_ENABLED": "true",
        "OLLAMA_BASE_URL": "http://localhost:11434"
      }
    }
  }
}
```

### 9.2. Kimi CLI

```json
{
  "mcpServers": {
    "obsidian": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@yourscope/obsidian-extended-mcp", "/path/to/vault"]
    }
  }
}
```

### 9.3. Cursor

```json
{
  "mcpServers": [
    {
      "name": "obsidian",
      "type": "command",
      "command": "npx -y @yourscope/obsidian-extended-mcp /path/to/vault"
    }
  ]
}
```

---

## 10. File Lock & Atomic Writes

```typescript
// src/shared/AtomicFileWriter.ts

class AtomicFileWriter {
  private lockManager = new FileLockManager();

  async write(filePath: string, content: string, backup = true): Promise<void> {
    const release = await this.lockManager.acquire(filePath, 'write');

    try {
      const tmpPath = `${filePath}.tmp.${Date.now()}`;
      const bakPath = `${filePath}.bak`;

      // 1. Backup
      if (backup && await fs.exists(filePath)) {
        await fs.copy(filePath, bakPath);
      }

      // 2. Atomic write
      await fs.writeFile(tmpPath, content, { flag: 'wx' });
      await fs.rename(tmpPath, filePath);

      // 3. Cleanup backup
      if (backup) await fs.remove(bakPath).catch(() => {});

    } catch (e) {
      // Restore backup on failure
      if (await fs.exists(`${filePath}.bak`)) {
        await fs.copy(`${filePath}.bak`, filePath);
      }
      throw e;
    } finally {
      release();
    }
  }
}

class FileLockManager {
  private locks = new Map<string, { type: 'read' | 'write' | null; queue: Array<{ type: 'read' | 'write'; resolve: (fn: () => void) => void }> }>();

  async acquire(path: string, type: 'read' | 'write'): Promise<() => void> {
    if (!this.locks.has(path)) this.locks.set(path, { type: null, queue: [] });
    const lock = this.locks.get(path)!;

    return new Promise((resolve) => {
      if (lock.type === null || (lock.type === 'read' && type === 'read')) {
        lock.type = type;
        resolve(this._releaseFn(path));
      } else {
        lock.queue.push({ type, resolve });
      }
    });
  }

  private _releaseFn(path: string): () => void {
    return () => {
      const lock = this.locks.get(path)!;
      if (lock.queue.length > 0) {
        const next = lock.queue.shift()!;
        lock.type = next.type;
        next.resolve(this._releaseFn(path));
      } else {
        lock.type = null;
      }
    };
  }
}
```

---

## 11. Background Indexer

```typescript
// src/shared/BackgroundIndexer.ts

import chokidar from 'chokidar';

class BackgroundIndexer {
  private watcher: chokidar.FSWatcher | null = null;
  private dirtyFiles: Set<string> = new Set();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY_MS = 500;

  constructor(
    private vaultPath: string,
    private graphEngine: GraphEngine,
    private searchEngine: BM25Engine,
    private cliBridge?: ILayer2CliBridge
  ) {}

  start(): void {
    this.watcher = chokidar.watch('**/*.md', {
      cwd: this.vaultPath,
      ignored: /(^|[\/\])\../, // .mcp-cache, .git, .obsidian
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (p) => this._markDirty(p, 'create'))
      .on('change', (p) => this._markDirty(p, 'modify'))
      .on('unlink', (p) => this._markDirty(p, 'delete'));
  }

  /** Global batch debounce: O(1) timers regardless of file count */
  private _markDirty(filePath: string, event: 'create' | 'modify' | 'delete'): void {
    this.dirtyFiles.add(filePath);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => this._flushBatch(), this.BATCH_DELAY_MS);
  }

  private async _flushBatch(): Promise<void> {
    const batch = Array.from(this.dirtyFiles);
    this.dirtyFiles.clear();
    this.batchTimer = null;

    for (const filePath of batch) {
      // Determine event type heuristically: if file still exists → create/modify
      const absPath = path.join(this.vaultPath, filePath);
      const exists = await fs.access(absPath).then(() => true).catch(() => false);
      const event: 'create' | 'modify' | 'delete' = exists
        ? (await this.graphEngine.hasNode(filePath) ? 'modify' : 'create')
        : 'delete';

      await this.graphEngine.onFileChange(event, filePath);
      if (event === 'delete') {
        await this.searchEngine.removeDocument?.(filePath);
      } else {
        await this.searchEngine.updateDocument?.(filePath);
      }
    }
  }

  async stop(): Promise<void> {
    // Graceful shutdown: flush pending batch before closing
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      await this._flushBatch();
    }
    this.watcher?.close();
  }
}
```

---

## 12. File Type Router

```typescript
// src/shared/FileTypeRouter.ts

interface FileHandler {
  mimeTypes: string[];
  extensions: string[];
  read(path: string): Promise<any>;
  write?(path: string, data: any): Promise<void>;
}

class FileTypeRouter {
  private handlers: FileHandler[] = [];

  register(handler: FileHandler): void {
    this.handlers.push(handler);
  }

  async read(filePath: string): Promise<any> {
    const ext = path.extname(filePath).toLowerCase();
    const mime = this.detectMime(filePath);

    for (const handler of this.handlers) {
      if (handler.extensions.includes(ext) || handler.mimeTypes.includes(mime)) {
        return handler.read(filePath);
      }
    }

    // Default: read as text
    return fs.readFile(filePath, 'utf8');
  }

  private detectMime(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.md': 'text/markdown',
      '.canvas': 'application/json',
      '.json': 'application/json',
    };
    return map[ext] || 'application/octet-stream';
  }
}

// Registration
const router = new FileTypeRouter();
router.register(markdownHandler);
router.register(canvasHandler);
```

---

## 13. Security Engine (KP-4)

### 13.1. Transport Guard (Уровень 1)

```typescript
// src/security/TransportGuard.ts

class TransportGuard {
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  verifyToken(provided: string): boolean {
    if (!this.token) return true; // dev mode
    if (provided.length < 32) return false;
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(this.token));
  }

  requireTls(): boolean {
    return process.env.MCP_TRANSPORT === 'http';
  }
}
```

### 13.2. Vault Isolation (Уровень 2)

```typescript
// src/security/VaultIsolation.ts

function validateVaultPath(requestedPath: string, allowedRoot: string): boolean {
  const resolved = path.resolve(requestedPath);
  const root = path.resolve(allowedRoot);
  if (!resolved.startsWith(root)) return false;
  // Block traversal attacks
  if (resolved.includes('..')) return false;
  return true;
}
```

### 13.3. Folder ACL (Уровень 3)

```typescript
// src/security/FolderACL.ts

interface FolderPolicy {
  readPaths: string[];
  writePaths: string[];
  safeZones: string[];
  forbiddenPaths: string[];
}

class FolderACL {
  isReadAllowed(filePath: string, policy: FolderPolicy): boolean {
    if (policy.forbiddenPaths.some(p => filePath.startsWith(p))) return false;
    if (policy.readPaths.includes('*')) return true;
    return policy.readPaths.some(p => filePath.startsWith(p));
  }

  isWriteAllowed(filePath: string, policy: FolderPolicy): boolean {
    if (policy.forbiddenPaths.some(p => filePath.startsWith(p))) return false;
    if (policy.writePaths.includes('*')) return true;
    return policy.writePaths.some(p => filePath.startsWith(p));
  }

  isSafeZone(filePath: string, policy: FolderPolicy): boolean {
    return policy.safeZones.some(p => filePath.startsWith(p));
  }
}
```

### 13.4. Operation Gate (Уровень 4)

```typescript
// src/security/OperationGate.ts

interface OperationPolicy {
  readOnly: boolean;
  enableCommands: boolean;
  enableEval: boolean;
  enableBatchEdit: boolean;
  enableDelete: boolean;
}

class OperationGate {
  check(toolName: string, policy: OperationPolicy): boolean {
    const writeTools = ['write_note', 'append_note', 'patch_note', 'move_note', 'delete_note', 'batch_edit'];
    const commandTools = ['cli_command', 'cli_plugin'];
    const evalTools = ['cli_eval'];
    const deleteTools = ['delete_note'];
    const batchTools = ['batch_edit'];

    if (policy.readOnly && writeTools.includes(toolName)) return false;
    if (!policy.enableCommands && commandTools.includes(toolName)) return false;
    if (!policy.enableEval && evalTools.includes(toolName)) return false;
    if (!policy.enableDelete && deleteTools.includes(toolName)) return false;
    if (!policy.enableBatchEdit && batchTools.includes(toolName)) return false;

    return true;
  }
}
```

### 13.5. Approval Engine (Уровень 5)

```typescript
// src/security/ApprovalEngine.ts

type ApprovalLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

class ApprovalEngine {
  getApprovalLevel(toolName: string, args: any): ApprovalLevel {
    if (this.isReadOnly(toolName)) return 1;
    if (this.isSafeZoneWrite(toolName, args)) return 2;
    if (['write_note', 'append_note', 'patch_note'].includes(toolName)) return 3;
    if (['delete_note', 'move_note'].includes(toolName)) return 4;
    if (toolName === 'cli_eval') return 5;
    if (toolName === 'cli_plugin' || toolName === 'cli_command') return 6;
    if (toolName === 'batch_edit') return 7;
    return 3;
  }

  private isReadOnly(toolName: string): boolean {
    return [
      'read_note', 'search_notes',
      'fs_get_graph', 'fs_graph_find_path',
      'fs_list_notes', 'list_all_tags', 'get_vault_rules', 'validate_note',
      'cli_eval', 'cli_backlinks', 'cli_orphans', 'cli_unresolved', 'cli_deadends', 'cli_search',
      'rest_active_note', 'rest_dataview',
      'ai_query', 'semantic_search', 'semantic_rag',
    ].includes(toolName);
  }

  private isSafeZoneWrite(toolName: string, args: any): boolean {
    const p = args?.path || args?.raw_path || '';
    return ['write_note', 'append_note', 'patch_note'].includes(toolName) &&
           (p.startsWith('raw/') || p.startsWith('sessions/'));
  }
}
```

### 13.6. Batch Edit Guard (Уровень 6)

```typescript
// src/security/BatchEditGuard.ts

interface BatchPreview {
  affectedFiles: string[];
  changes: Array<{ file: string; before: string; after: string }>;
  backupPath: string;
}

class BatchEditGuard {
  async preview(filter: ListFilter, operation: string, target: string, replacement?: string): Promise<BatchPreview> {
    const files = await this.resolveFiles(filter);
    const changes = [];
    for (const file of files) {
      const before = await fs.readFile(file, 'utf8');
      const after = this.applyOperation(before, operation, target, replacement);
      if (before !== after) changes.push({ file, before, after });
    }
    const backupPath = `.mcp-cache/backups/${Date.now()}`;
    return { affectedFiles: files, changes, backupPath };
  }

  async apply(preview: BatchPreview): Promise<number> {
    for (const change of preview.changes) {
      await this.backup(change.file, preview.backupPath);
    }
    for (const change of preview.changes) {
      await fs.writeFile(change.file, change.after);
    }
    return preview.changes.length;
  }

  async rollback(backupPath: string): Promise<void> {
    const files = await glob(`${backupPath}/**/*.md`);
    for (const backupFile of files) {
      const relPath = path.relative(backupPath, backupFile);
      await fs.copyFile(backupFile, relPath);
    }
  }

  private async resolveFiles(filter: ListFilter): Promise<string[]> { /* ... */ }
  private applyOperation(content: string, operation: string, target: string, replacement?: string): string { /* ... */ }
  private async backup(filePath: string, backupDir: string): Promise<void> {
    const dest = path.join(backupDir, filePath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(filePath, dest);
  }
}
```

### 13.7. Eval Sandbox (Уровень 7)

```typescript
// src/security/EvalSandbox.ts

const ALLOWED_GLOBALS = ['app', 'DataviewAPI', 'moment', 'MetadataCache'];
const FORBIDDEN_PATTERNS = [
  /require\s*\(/,
  /fs\s*\./,
  /child_process/,
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /eval\s*\(/,
  /Function\s*\(/,
  /process\.exit/
];

class EvalSandbox {
  validate(code: string): { valid: boolean; reason?: string } {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) {
        return { valid: false, reason: `Forbidden pattern: ${pattern.source}` };
      }
    }
    return { valid: true };
  }

  async execute(code: string, timeoutMs = 5000): Promise<any> {
    const validation = this.validate(code);
    if (!validation.valid) {
      throw new SecurityError('E206', `Eval blocked: ${validation.reason}`);
    }
    // Execute with timeout via child_process or VM
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new CliError('E203', 'Eval timeout')), timeoutMs);
      // ... execution logic
    });
  }
}
```

### 13.8. Security Engine (координация всех уровней)

```typescript
// src/security/SecurityEngine.ts

interface SecurityPolicy {
  transport: { requireTls: boolean; token?: string };
  vault: { allowedRoots: string[] };
  folders: FolderPolicy;
  operations: OperationPolicy;
  approval: { mode: 'auto' | 'interactive' | 'strict' };
}

class SecurityEngine {
  constructor(
    private policy: SecurityPolicy,
    private transportGuard: TransportGuard,
    private folderACL: FolderACL,
    private operationGate: OperationGate,
    private approvalEngine: ApprovalEngine,
    private batchGuard: BatchEditGuard,
    private evalSandbox: EvalSandbox,
    private auditLogger: AuditLogger
  ) {}

  async authorize(toolName: string, args: Record<string, any>): Promise<{ allowed: boolean; level: ApprovalLevel; reason?: string }> {
    // 1. Operation gating
    if (!this.operationGate.check(toolName, this.policy.operations)) {
      await this.auditLog(toolName, args, 0, 'Operation disabled by policy');
      return { allowed: false, level: 0, reason: 'Operation disabled by policy' };
    }

    // 2. Folder ACL
    const filePath = args?.path || args?.from || args?.raw_path || '';
    if (filePath) {
      if (!this.folderACL.isReadAllowed(filePath, this.policy.folders) && this.isReadOp(toolName)) {
        await this.auditLog(toolName, args, 0, 'Read not allowed for this path');
        return { allowed: false, level: 0, reason: 'Read not allowed for this path' };
      }
      if (!this.folderACL.isWriteAllowed(filePath, this.policy.folders) && this.isWriteOp(toolName)) {
        await this.auditLog(toolName, args, 0, 'Write not allowed for this path');
        return { allowed: false, level: 0, reason: 'Write not allowed for this path' };
      }
    }

    // 3. Approval level
    const level = this.approvalEngine.getApprovalLevel(toolName, args);

    // 4. Audit log
    await this.auditLog(toolName, args, level, 'authorized');

    return { allowed: true, level };
  }

  async auditLog(toolName: string, args: any, level: number, result: string): Promise<void> {
    await this.auditLogger.log({
      event: 'tool_call',
      tool: toolName,
      args,
      level,
      result,
      timestamp: new Date().toISOString()
    });
  }

  private isReadOp(toolName: string): boolean {
    return toolName.startsWith('fs_get_') || toolName.startsWith('fs_read_') || toolName.startsWith('cli_');
  }

  private isWriteOp(toolName: string): boolean {
    return toolName.startsWith('fs_write_') || toolName.startsWith('fs_append_') ||
           toolName.startsWith('fs_patch_') || toolName.startsWith('fs_delete_') ||
           toolName.startsWith('fs_move_') || toolName.startsWith('fs_batch_');
  }
}
```

---

## 14. Audit Logger (KP-5)

```typescript
// src/audit/AuditLogger.ts

interface AuditEntry {
  timestamp: string;
  event: string;
  sessionId: string;
  [key: string]: any;
}

interface AuditLoggerConfig {
  vaultPath: string;
  format: 'jsonl' | 'csv' | 'markdown';
  maxAgeDays: number;
  maxEntries: number;
  batchSize: number;
  flushIntervalMs: number;
  sessionRetention: number;
}

class AuditLogger {
  private buffer: AuditEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private config: AuditLoggerConfig;

  constructor(config: AuditLoggerConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
  }

  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async log(entry: Omit<AuditEntry, 'timestamp' | 'sessionId'>): Promise<void> {
    const fullEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...entry
    };
    this.buffer.push(fullEntry);
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const entries = this.buffer.splice(0, this.buffer.length);

    const sessionPath = path.join(this.config.vaultPath, 'sessions', `mcp-audit-${this.sessionId}.jsonl`);
    const masterPath = path.join(this.config.vaultPath, '.mcp-cache', 'audit.log');

    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.mkdir(path.dirname(masterPath), { recursive: true });

    const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    await fs.appendFile(sessionPath, lines);
    await fs.appendFile(masterPath, lines);
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushIntervalMs);
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  async rotateIfNeeded(): Promise<void> {
    const masterPath = path.join(this.config.vaultPath, '.mcp-cache', 'audit.log');
    const stats = await fs.stat(masterPath).catch(() => null);
    if (!stats) return;
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > 100) {
      const rotated = `${masterPath}.${Date.now()}.jsonl`;
      await fs.rename(masterPath, rotated);
    }
  }

  async cleanupSessionLogs(): Promise<void> {
    const sessionsDir = path.join(this.config.vaultPath, 'sessions');
    const files = await fs.readdir(sessionsDir).catch(() => []);
    const cutoff = Date.now() - this.config.sessionRetention * 24 * 60 * 60 * 1000;
    for (const file of files) {
      if (!file.startsWith('mcp-audit-')) continue;
      const stat = await fs.stat(path.join(sessionsDir, file)).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) {
        await fs.unlink(path.join(sessionsDir, file));
      }
    }
  }
}
```

---

## 15. Context Bootstrap Cache (NP-9)

```typescript
// src/layer5/ContextBootstrapCache.ts

class ContextBootstrapCache {
  private cache: {
    ontology: string | null;
    protocol: string | null;
    linkRules: string | null;
    structure: string | null;
    skills: string | null;
    mtime: Record<string, number>;
  } = {
    ontology: null,
    protocol: null,
    linkRules: null,
    structure: null,
    skills: null,
    mtime: {},
  };

  constructor(private vaultPath: string) {}

  async get(key: 'ontology' | 'protocol' | 'linkRules' | 'structure' | 'skills'): Promise<string | null> {
    const filePath = this.resolvePath(key);
    const currentMtime = (await fs.stat(filePath)).mtimeMs;

    if (this.cache.mtime[key] !== currentMtime) {
      this.cache[key] = await fs.readFile(filePath, 'utf8');
      this.cache.mtime[key] = currentMtime;
    }

    return this.cache[key];
  }

  private resolvePath(key: string): string {
    const map: Record<string, string> = {
      ontology: 'meta/ontology.md',
      protocol: 'meta/protocol.md',
      linkRules: 'meta/link-rules.md',
      structure: '.', // generated dynamically
      skills: 'meta/skills.md', // optional
    };
    return path.join(this.vaultPath, map[key]);
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache[key as keyof typeof this.cache] = null as any;
      this.cache.mtime[key] = 0;
    } else {
      this.cache.ontology = null;
      this.cache.protocol = null;
      this.cache.linkRules = null;
      this.cache.structure = null;
      this.cache.skills = null;
      Object.keys(this.cache.mtime).forEach(k => this.cache.mtime[k] = 0);
    }
  }
}
```

---

## 16. Сценарии использования (NP-3)

### 16.1. Rename с обновлением ссылок

**Цель:** Переместить заметку и обновить все wikilinks, указывающие на неё.

**Вариант A: CLI доступен**
```typescript
// Dispatcher выбирает CLI
const result = await dispatcher.dispatch('move_note', {
  from: 'concepts/old-name.md',
  to: 'concepts/new-name.md'
});
// CLI bridge выполняет: app.fileManager.renameFile(file, newPath)
// Obsidian автоматически обновляет metadataCache и все backlinks
```

**Вариант B: FS fallback**
```typescript
// Dispatcher выбирает Filesystem
const result = await dispatcher.dispatch('move_note', {
  from: 'concepts/old-name.md',
  to: 'concepts/new-name.md'
});
// Filesystem core:
// 1. Перемещает файл
// 2. Переименовывает папку если нужно
// 3. Рекурсивно сканирует все .md на [[old-name]]
// 4. Заменяет на [[new-name]] (сохраняя aliases)
// 5. Обновляет GraphEngine через onFileChange('rename', ...)
```

### 16.2. Auto-link suggestions

**Цель:** Предложить wikilinks для несвязанных упоминаний концепций в заметке.

**Алгоритм:**
```typescript
async function suggestLinks(path: string): Promise<Array<{ phrase: string; target: string; confidence: number }>> {
  const content = await fs.readFile(path, 'utf8');
  const existingLinks = extractWikilinks(content);
  const concepts = Object.keys(graphEngine.getGraph().nodes)
    .filter(p => p.startsWith('concepts/'));

  const suggestions = [];
  for (const concept of concepts) {
    const title = graphEngine.getGraph().nodes[concept].title;
    const aliases = graphEngine.getGraph().nodes[concept].aliases || [];
    const allNames = [title, ...aliases];

    for (const name of allNames) {
      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches && !existingLinks.includes(concept)) {
        // TF-IDF + semantic match hybrid scoring
        const tfidf = computeTfIdf(name, content);
        const semantic = await semanticEngine.similarity(path, concept);
        const confidence = 0.6 * tfidf + 0.4 * semantic;
        if (confidence > 0.5) {
          suggestions.push({ phrase: name, target: concept, confidence });
        }
      }
    }
  }
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}
```

### 16.3. Batch compile pipeline

**Цель:** Автоматическая компиляция всех raw-заметок за период.

**Workflow:**
```typescript
async function batchCompile(sinceDays: number): Promise<CompileResult> {
  const rawFiles = await glob('raw/**/*.md', { cwd: vaultPath });
  const recentFiles = rawFiles.filter(f => {
    const stat = fs.statSync(f);
    return Date.now() - stat.mtimeMs < sinceDays * 24 * 60 * 60 * 1000;
  });

  const result: CompileResult = {
    newConcepts: [],
    updatedConcepts: [],
    updatedMocs: [],
    orphanedSources: [],
    errors: []
  };

  // Phase 1: Ingest all
  for (const file of recentFiles) {
    try {
      const conceptPath = await pipeline.ingest(file, false); // no auto-compile
      if (conceptPath) result.newConcepts.push(conceptPath);
    } catch (e) {
      result.errors.push(`Ingest failed for ${file}: ${e.message}`);
    }
  }

  // Phase 2: Compile
  const compileResult = await pipeline.compile(sinceDays, false);
  result.updatedConcepts = compileResult.updatedConcepts;
  result.updatedMocs = compileResult.updatedMocs;

  // Phase 3: Lint
  const lint = await pipeline.lint(false);
  result.orphanedSources = lint.warnings
    .filter(w => w.description.includes('orphan'))
    .map(w => w.file);

  return result;
}
```

---

## 17. Multi-Vault Architecture (NP-7)

### 17.1. Изоляция процессов

```typescript
// src/multi-vault/VaultProcess.ts

interface VaultProcess {
  vaultId: string;
  vaultPath: string;
  server: ExtendedMcpServer;
  worker: Worker | null; // For CPU-intensive tasks (indexing)
}

class VaultProcessPool {
  private processes = new Map<string, VaultProcess>();
  private maxWorkers = os.cpus().length;

  async spawn(vaultId: string, vaultPath: string, config: VaultConfig): Promise<VaultProcess> {
    const server = new ExtendedMcpServer({ ...config, vaultPath });
    await server.initialize();

    const proc: VaultProcess = { vaultId, vaultPath, server, worker: null };

    // Spawn worker for CPU-intensive indexing
    if (config.semantic?.enabled) {
      proc.worker = new Worker(path.join(__dirname, 'vault-worker.js'), {
        workerData: { vaultId, vaultPath }
      });
    }

    this.processes.set(vaultId, proc);
    return proc;
  }

  get(vaultId: string): VaultProcess | undefined {
    return this.processes.get(vaultId);
  }

  async terminate(vaultId: string): Promise<void> {
    const proc = this.processes.get(vaultId);
    if (!proc) return;
    proc.worker?.terminate();
    await proc.server.shutdown();
    this.processes.delete(vaultId);
  }
}
```

### 17.2. Routing по vault ID

```typescript
// src/multi-vault/VaultRouter.ts

interface VaultRoute {
  vaultId: string;
  vaultPath: string;
  authToken: string;
  config: VaultConfig;
}

class VaultRouter {
  private vaults = new Map<string, VaultRoute>();
  private pool: VaultProcessPool;

  constructor(pool: VaultProcessPool) {
    this.pool = pool;
  }

  register(route: VaultRoute): void {
    this.vaults.set(route.vaultId, route);
    this.pool.spawn(route.vaultId, route.vaultPath, route.config);
  }

  async dispatch(vaultId: string, toolName: string, args: any): Promise<any> {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new ConfigError('E902', `Unknown vault: ${vaultId}`);

    const proc = this.pool.get(vaultId);
    if (!proc) throw new RuntimeError('E904', `Vault process not running: ${vaultId}`);

    return proc.server.dispatch(toolName, args);
  }

  getVaultList(): Array<{ vaultId: string; path: string; status: string }> {
    return Array.from(this.vaults.values()).map(v => ({
      vaultId: v.vaultId,
      path: v.vaultPath,
      status: this.pool.get(v.vaultId) ? 'active' : 'stopped'
    }));
  }
}
```

### 17.3. Конфигурация multi-vault

```yaml
# mcp-config.yaml
vaults:
  work:
    path: ~/vaults/work
    token: ${MCP_WORK_TOKEN}
    semantic:
      enabled: true
      model: ollama:llama3
  personal:
    path: ~/vaults/personal
    token: ${MCP_PERSONAL_TOKEN}
    semantic:
      enabled: false

```

---

## 18. CLI Commands (Bootstrap)

### 18.1. `init-meta` — Initialize vault metadata

```typescript
// src/cli/commands/initMeta.ts

async function initMeta(vaultPath: string): Promise<void> {
  const metaDir = path.join(vaultPath, 'meta');
  await fs.mkdir(metaDir, { recursive: true });

  const ontologyPath = path.join(metaDir, 'ontology.md');
  const protocolPath = path.join(metaDir, 'protocol.md');
  const linkRulesPath = path.join(metaDir, 'link-rules.md');

  if (!await fs.exists(ontologyPath)) {
    await fs.writeFile(ontologyPath, `---\ntype: ontology\n---\n# Ontology\n\n## Tags\n- concept\n- source\n- session\n\n## Folders\n- raw/ → source\n- concepts/ → concept\n- sessions/ → session\n`);
  }
  if (!await fs.exists(protocolPath)) {
    await fs.writeFile(protocolPath, `---\ntype: protocol\n---\n# Protocol\n\n## Pipeline\n1. Ingest raw → source\n2. Compile sources → concepts\n3. Query with context\n4. Lint & maintain\n`);
  }
  if (!await fs.exists(linkRulesPath)) {
    await fs.writeFile(linkRulesPath, `---\ntype: link-rules\n---\n# Link Rules\n\n- Concepts must have ≥ 3 inbound links\n- Sources must link to ≥ 1 concept\n- Sessions must reference source + concept\n`);
  }

  console.log(`✓ Meta initialized in ${metaDir}`);
}
```

Usage:
```bash
npx obsidian-extended-mcp init-meta --path /path/to/vault
```

### 18.2. `check` — Validate vault readiness

```typescript
// src/cli/commands/check.ts

async function checkVault(vaultPath: string): Promise<{ ok: boolean; report: string[] }> {
  const report: string[] = [];
  let ok = true;

  // Count notes
  const files = await glob('**/*.md', { cwd: vaultPath, absolute: true });
  report.push(`✓ ${files.length} notes`);

  // Check meta files
  const metaFiles = ['ontology.md', 'protocol.md', 'link-rules.md'];
  for (const mf of metaFiles) {
    const p = path.join(vaultPath, 'meta', mf);
    if (await fs.exists(p)) {
      report.push(`✓ meta/${mf}`);
    } else {
      report.push(`✗ meta/${mf} — run: init-meta`);
      ok = false;
    }
  }

  // Check cache dir
  const cacheDir = path.join(vaultPath, '.mcp-cache');
  if (await fs.exists(cacheDir)) {
    report.push(`✓ .mcp-cache`);
  } else {
    report.push(`⚠ .mcp-cache — will be created on first run`);
  }

  // Check CLI availability
  const cliAvailable = await which('obsidian').then(() => true).catch(() => false);
  report.push(cliAvailable ? `✓ obsidian CLI` : `⚠ obsidian CLI not found (optional)`);

  return { ok, report };
}
```

Usage:
```bash
npx obsidian-extended-mcp check --path /path/to/vault
# ✓ 127 notes
# ✓ meta/ontology.md
# ✓ meta/protocol.md
# ✓ meta/link-rules.md
# ✓ .mcp-cache
# ⚠ obsidian CLI not found (optional)
```

---

---

## 13. LLM Adapter (AI Core)

```typescript
// src/ai-core/LLMAdapter.ts

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'transformers.js';
  model: string;
  apiKey?: string;
  baseUrl?: string;      // для Ollama/proxy
  temperature?: number;
  maxTokens?: number;
}

interface GenerateOptions {
  systemPrompt?: string;
  userPrompt: string;
  jsonMode?: boolean;    // force structured output
  temperature?: number;
}

interface AIResult<T> {
  model: string;
  confidence: number;
  reasoning: string;
  data: T;
  tokensUsed: number;
  latencyMs: number;
}

class LLMAdapter {
  private configs: Map<string, LLMConfig> = new Map();
  private defaultProvider: string = 'openai';
  private cache: Map<string, { result: any; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_MAX_SIZE = 1000;

  constructor(configs: Record<string, LLMConfig>) {
    for (const [key, cfg] of Object.entries(configs)) {
      this.configs.set(key, cfg);
    }
  }

  /** Auto-select model by task complexity */
  async generate<T>(options: GenerateOptions, taskComplexity: 'light' | 'medium' | 'heavy' = 'medium'): Promise<AIResult<T>> {
    const provider = this.selectProvider(taskComplexity);
    const cacheKey = this.buildCacheKey(provider, options);

    // Check cache (LRU: move to end on access)
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return { ...cached.result, cached: true } as AIResult<T>;
    }

    const start = Date.now();
    const response = await this.callProvider(provider, options);
    const parsed = options.jsonMode ? JSON.parse(response.text) : response.text;

    const result: AIResult<T> = {
      model: `${provider.provider}/${provider.model}`,
      confidence: this.estimateConfidence(response),
      reasoning: response.reasoning || '',
      data: parsed as T,
      tokensUsed: response.tokensUsed,
      latencyMs: Date.now() - start,
    };

    // LRU eviction
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { result, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return result;
  }

  private buildCacheKey(provider: LLMConfig, options: GenerateOptions): string {
    return `${provider.provider}/${provider.model}:${provider.temperature}:${options.jsonMode}:${options.userPrompt.slice(0, 200)}`;
  }

  private selectProvider(complexity: string): LLMConfig {
    // Light tasks → local (fast, private, cheap)
    if (complexity === 'light') {
      return this.configs.get('ollama') || this.configs.get('transformers') || this.configs.get(this.defaultProvider)!;
    }
    // Heavy tasks → cloud (accurate)
    if (complexity === 'heavy') {
      return this.configs.get('openai') || this.configs.get('anthropic') || this.configs.get(this.defaultProvider)!;
    }
    // Medium → default
    return this.configs.get(this.defaultProvider)!;
  }

  private async callProvider(config: LLMConfig, options: GenerateOptions): Promise<{ text: string; reasoning?: string; tokensUsed: number }> {
    switch (config.provider) {
      case 'openai': return this.callOpenAI(config, options);
      case 'anthropic': return this.callAnthropic(config, options);
      case 'ollama': return this.callOllama(config, options);
      case 'transformers.js': return this.callTransformers(config, options);
      default: throw new AIError('E801', `LLM provider '${config.provider}' is not supported. Available: openai, anthropic, ollama, transformers.js`);
    }
  }

  // Provider-specific implementations
  private async callOpenAI(config: LLMConfig, options: GenerateOptions): Promise<any> { /* ... */ }
  private async callAnthropic(config: LLMConfig, options: GenerateOptions): Promise<any> { /* ... */ }
  private async callOllama(config: LLMConfig, options: GenerateOptions): Promise<any> { /* ... */ }
  private async callTransformers(config: LLMConfig, options: GenerateOptions): Promise<any> { /* ... */ }

  private estimateConfidence(response: any): number {
    // Heuristic: longer reasoning = higher confidence for complex tasks
    const reasoningLength = response.reasoning?.length || 0;
    return Math.min(0.5 + reasoningLength / 1000, 0.99);
  }

  /** Embedding — unified interface for all providers */
  async embed(text: string, provider?: string): Promise<number[]> {
    const cfg = provider ? this.configs.get(provider) : this.configs.get('ollama');
    // Provider-specific embedding logic
    return [];
  }
}
```

### 13.1. Provider Configuration

```typescript
// src/ai-core/providers.ts

export const DEFAULT_PROVIDERS: Record<string, LLMConfig> = {
  openai: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
  },
  anthropic: {
    provider: 'anthropic',
    model: 'claude-sonnet-3-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.3,
  },
  ollama: {
    provider: 'ollama',
    model: 'llama3.1:8b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,
  },
  transformers: {
    provider: 'transformers.js',
    model: 'Xenova/all-MiniLM-L6-v2',
    temperature: 0.3,
  },
};
```

---

## 14. AI Agents

### 14.1. Agent Base Class

```typescript
// src/ai-core/agents/Agent.ts

abstract class AIAgent<TInput, TOutput> {
  protected adapter: LLMAdapter;
  protected ontology: Ontology;
  protected graphEngine: GraphEngine;

  constructor(deps: { adapter: LLMAdapter; ontology: Ontology; graphEngine: GraphEngine }) {
    this.adapter = deps.adapter;
    this.ontology = deps.ontology;
    this.graphEngine = deps.graphEngine;
  }

  abstract getSystemPrompt(): string;
  abstract getTaskComplexity(): 'light' | 'medium' | 'heavy';

  async execute(input: TInput, retries = 3): Promise<AIResult<TOutput>> {
    const userPrompt = this.buildPrompt(input);
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.adapter.generate<TOutput>({
          systemPrompt: this.getSystemPrompt(),
          userPrompt,
          jsonMode: true,
        }, this.getTaskComplexity());
        this.logAction('execute', result);
        return result;
      } catch (e) {
        lastError = e as Error;
        if (i < retries - 1) {
          const delay = 1000 * Math.pow(2, i); // exponential backoff: 1s, 2s, 4s
          console.warn(`[${this.constructor.name}] Retry ${i + 1}/${retries - 1} after ${delay}ms: ${lastError.message}`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw new AIError('E802', `Agent ${this.constructor.name} failed after ${retries} retries: ${lastError?.message}`, true);
  }

  protected abstract buildPrompt(input: TInput): string;

  /** Log every action for transparency */
  protected logAction(action: string, result: AIResult<TOutput>): void {
    console.log(`[${this.constructor.name}] ${action} | model=${result.model} | confidence=${result.confidence.toFixed(2)} | tokens=${result.tokensUsed} | latency=${result.latencyMs}ms`);
  }
}
```

### 14.2. IngestAgent

```typescript
// src/ai-core/agents/IngestAgent.ts

class IngestAgent extends AIAgent<{ rawPath: string }, { sourcePath: string; frontmatter: any; tags: string[] }> {
  getSystemPrompt(): string {
    return `You are a knowledge ingestion expert. Read raw notes and transform them into structured sources.
Rules:
- Extract key entities, ideas, and claims
- Generate frontmatter: title, date, tags, sources
- Tags must be from ontology: ${this.ontology.allowedTags.join(', ')}
- Output JSON: { title, date, tags, keyIdeas, sources, summary }`;
  }

  getTaskComplexity(): 'light' | 'medium' | 'heavy' { return 'medium'; }

  protected buildPrompt(input: { rawPath: string }): string {
    const content = fs.readFileSync(input.rawPath, 'utf8');
    return `Transform this raw note into a structured source:\n\n${content}`;
  }
}
```

### 14.3. CompileAgent

```typescript
// src/ai-core/agents/CompileAgent.ts

class CompileAgent extends AIAgent<{ sourcePaths: string[] }, { concepts: string[]; mocUpdates: string[] }> {
  getSystemPrompt(): string {
    return `You are a knowledge synthesis expert. Read multiple sources and extract permanent concepts.
Rules:
- Each concept must have ≥ 3 inbound links or be explicitly defined
- Create MOC (Map of Content) updates
- Link concepts to each other where relevant
- Output JSON: { concepts: [{ path, title, definition, relatedConcepts }], mocUpdates }`;
  }

  getTaskComplexity(): 'light' | 'medium' | 'heavy' { return 'heavy'; }

  protected buildPrompt(input: { sourcePaths: string[] }): string {
    const sources = input.sourcePaths.map(p => fs.readFileSync(p, 'utf8')).join('\n---\n');
    return `Synthesize concepts from these sources:\n\n${sources}`;
  }
}
```

### 14.4. LinkAgent

```typescript
// src/ai-core/agents/LinkAgent.ts

class LinkAgent extends AIAgent<{ notePath: string }, { suggestions: Array<{ phrase: string; target: string; confidence: number }> }> {
  getSystemPrompt(): string {
    return `You are a link suggestion expert. Find unlinked mentions of concepts in notes and suggest wikilinks.`;
  }

  getTaskComplexity(): 'light' | 'medium' | 'heavy' { return 'light'; }

  protected buildPrompt(input: { notePath: string }): string {
    const content = fs.readFileSync(input.notePath, 'utf8');
    const concepts = Object.keys(this.graphEngine.getGraph().nodes).filter(p => p.startsWith('concepts/'));
    return `Note:\n${content}\n\nAvailable concepts:\n${concepts.join('\n')}\n\nSuggest wikilinks for unlinked mentions.`;
  }
}
```

### 14.5. TagAgent

```typescript
// src/ai-core/agents/TagAgent.ts

class TagAgent extends AIAgent<{ notePath: string }, { tags: string[]; newTags: string[] }> {
  getSystemPrompt(): string {
    return `You are a taxonomy expert. Classify notes using the ontology and suggest new tags when needed.`;
  }

  getTaskComplexity(): 'light' | 'medium' | 'heavy' { return 'light'; }

  protected buildPrompt(input: { notePath: string }): string {
    const content = fs.readFileSync(input.notePath, 'utf8');
    return `Classify this note. Allowed tags: ${this.ontology.allowedTags.join(', ')}\n\n${content}`;
  }
}
```

### 14.6. QueryAgent

```typescript
// src/ai-core/agents/QueryAgent.ts

class QueryAgent extends AIAgent<{ query: string; contextPaths: string[] }, { answer: string; citations: string[] }> {
  getSystemPrompt(): string {
    return `You are a knowledge retrieval expert. Answer user questions using ONLY the provided context from their vault.
Rules:
- Cite sources using [[Note Title]] format
- If context is insufficient, say so
- Synthesize information across multiple notes`;
  }

  getTaskComplexity(): 'light' | 'medium' | 'heavy' { return 'heavy'; }

  protected buildPrompt(input: { query: string; contextPaths: string[] }): string {
    const context = input.contextPaths.map(p => `[[${p}]]\n${fs.readFileSync(p, 'utf8')}`).join('\n---\n');
    return `Context:\n${context}\n\nQuestion: ${input.query}`;
  }
}
```

### 14.7. LintAgent

```typescript
// src/ai-core/agents/LintAgent.ts

class LintAgent extends AIAgent<void, { orphans: string[]; deadends: string[]; brokenLinks: string[]; suggestions: string[] }> {
  getSystemPrompt(): string {
    return `You are a vault health expert. Analyze the knowledge graph and suggest improvements.`;
  }

  getTaskComplexity(): 'light' | 'medium' | 'heavy' { return 'medium'; }

  protected buildPrompt(input: void): string {
    const graph = this.graphEngine.getGraph();
    const stats = `Nodes: ${Object.keys(graph.nodes).length}, Edges: ${graph.edges.length}, Orphans: ${graph.orphans.length}, Deadends: ${graph.deadends.length}`;
    return `Vault stats:\n${stats}\n\nSuggest improvements.`;
  }
}
```

### 14.8. EnrichAgent

```typescript
// src/ai-core/agents/EnrichAgent.ts

class EnrichAgent extends AIAgent<{ conceptPath: string }, { additions: string[] }> {
  getSystemPrompt(): string {
    return `You are a knowledge enrichment expert. Expand existing concepts with definitions, examples, and connections.`;
  }

  getTaskComplexity(): 'light' | 'medium' | 'heavy' { return 'medium'; }

  protected buildPrompt(input: { conceptPath: string }): string {
    const content = fs.readFileSync(input.conceptPath, 'utf8');
    const neighbors = this.graphEngine.getNeighbors(input.conceptPath, 1);
    return `Concept:\n${content}\n\nNeighbors:\n${Object.keys(neighbors.nodes).join('\n')}\n\nSuggest enrichments.`;
  }
}
```

---

## 15. Dreaming Layer (L9) — Autonomous Vault Maintenance

The Dreaming layer provides autonomous maintenance capabilities for Obsidian vaults. It operates on a Scan → Finalize → Undo pipeline with persistent logging.

### 15.1. Architecture

```
DreamingEngine
├── TopicLoader       (loads vault notes with signals)
├── SignalStore       (SQLite-backed importance/maturity tracking)
├── DreamLog          (JSONL append-only log with file locking)
└── Candidate Generators
    ├── GapDetector      (missing links between related notes)
    ├── MergeSuggester   (duplicate or overlapping concepts)
    ├── StaleDetector    (notes unchanged for long periods)
    └── Synthesizer      (MOC synthesis proposals)
```

### 15.2. DreamLog (Atomic Persistence)

`DreamLog` uses `FileLock.withLock()` to guarantee atomic append operations on the JSONL log. Reads are streamed via `readline` to avoid loading large logs into memory.

```typescript
// src/layers/L9-dreaming/DreamLog.ts
async append(entry: DreamLogEntry): Promise<void> {
  const line = JSON.stringify(entry) + '\n';
  await FileLock.withLock(this.logPath, async () => {
    await fs.appendFile(this.logPath, line, 'utf-8');
  });
}

async readLastSession(sessionId: string): Promise<DreamLogEntry[]> {
  // Streams line-by-line via readline instead of fs.readFile
}
```

### 15.3. TopicLoader (Bounded Concurrency)

`TopicLoader` processes notes in batches of 10 to prevent unbounded memory growth on large vaults.

```typescript
// src/layers/L9-dreaming/TopicLoader.ts
const topics = await batchMap(filtered, 10, (relPath) =>
  this.loadOne(relPath, signalMap),
);
```

### 15.4. Engine Lifecycle & Race Safety

`getEngine()` uses a module-level `enginePromises` Map to prevent duplicate `SignalStore` / SQLite opens when multiple tool calls arrive concurrently.

```typescript
const enginePromises = new Map<string, Promise<DreamingEngine>>();
```

`VaultPool.shutdown()` closes `entry.dreaming` to prevent file descriptor leaks.

### 15.5. Tools

| Tool | Purpose |
|------|---------|
| `dream_scan` | Run candidate generators and return suggestions |
| `dream_finalize` | Apply archive/remove operations, log to DreamLog |
| `dream_undo` | Restore archived notes and revert mtime |

*Руководство составлено на основе архитектурных спецификаций v1.6–v1.7 и аудита 52 MCP-реализаций.*
*Исправлено по результатам аудита v2.0: удалены bloat-функции (OCR, Whisper, PDF, Canvas, DevTools, Sync, Workspace, Backup), упрощена архитектура до core-уровней (L1, L2, L2b, L3, L4, L5).*
*Переориентировано на AI-first архитектуру: LLM Adapter + AI Agents для универсальной, прозрачной, модельно-агностичной обработки знаний.*
