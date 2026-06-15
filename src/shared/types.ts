// v0.2b:
// Domain types for Obsidian Extended MCP

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
  maxTokens: number;
  includeOntology: boolean;
  includeProtocol: boolean;
  includeLinkRules: boolean;
  includeStructure: boolean;
  includeSkills: boolean;
  includeSessionHistory: number;
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

import type { IVaultManager } from './interfaces/IVaultManager.js';
import type { IGraphEngine } from './interfaces/IGraphEngine.js';
import type { ISemanticDatabase } from './interfaces/ISemanticDatabase.js';
import type { IBackgroundIndexer } from './interfaces/IBackgroundIndexer.js';
import type { IVectorEngine } from './interfaces/IVectorEngine.js';
import type { IPipelineOrchestrator } from './interfaces/IPipelineOrchestrator.js';
import type { IDreamingEngine } from './interfaces/IDreamingEngine.js';

export interface VaultEntry {
  vault: IVaultManager;
  graph: IGraphEngine;
  semanticDb: ISemanticDatabase;
  acl: any;
  indexer?: IBackgroundIndexer;
  pipeline?: IPipelineOrchestrator;
  vector?: IVectorEngine;
  dreaming?: IDreamingEngine;
  /** Optional human-readable name for routing */
  name?: string;
  /** Optional tags for advanced routing */
  tags?: string[];
  /** Per-vault configuration overrides */
  config?: Record<string, unknown>;
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
  frontmatter: Record<string, unknown>;
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
  frontmatter: Record<string, unknown>;
  outbound: string[];
  inbound: string[];
  isOrphan: boolean;
  isDeadend: boolean;
  hasUnresolvedLinks: boolean;
  unresolvedLinks?: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'wikilink' | 'backlink' | 'implicit' | 'alias';
  context?: string;
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

export interface ReadNoteOptions {
  includeFrontmatter?: boolean;
  includeContent?: boolean;
}

export interface WriteNoteOptions {
  frontmatter?: Record<string, unknown>;
  backup?: boolean;
  overwrite?: boolean;
}

export interface DeleteOptions {
  soft?: boolean;
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
  /** Deterministic findings populated by PipelineOrchestrator.runLint for auto-fixing */
  invalidTags?: Array<{ tag: string; file: string }>;
  oldSeedlings?: string[];
}

// AI Core types

export interface AIResult<T> {
  data: T;
  confidence: number;
  reasoning: string;
  tokensUsed?: number;
  durationMs?: number;
}

export type TaskComplexity = 'light' | 'medium' | 'heavy';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseSchema?: unknown;
}

// Tool types

export type ToolName = string;

export interface ToolHandler {
  name: ToolName;
  description: string;
  inputSchema: unknown;
  handler: (args: unknown) => Promise<unknown>;
}

// Layer interfaces

export interface ILayer2CliBridge {
  isAvailable(): Promise<boolean>;
  eval(code: string, timeout?: number): Promise<unknown>;
  backlinks(path: string): Promise<Array<{ source: string; line: number; context?: string }>>;
  orphans(folder?: string): Promise<string[]>;
  unresolved(folder?: string): Promise<Array<{ link: string; source: string; line: number }>>;
  deadends(folder?: string): Promise<string[]>;
  properties(file: string, action: 'read' | 'set' | 'remove' | 'list', property?: string, value?: string): Promise<unknown>;
  search(query: string, context?: boolean): Promise<SearchResult[]>;
  daily(action: 'read' | 'append' | 'prepend', content?: string): Promise<string>;
  command(name: string): Promise<void>;
  plugin(action: string, id?: string): Promise<unknown>;
}

export interface ILayer2bRestBridge {
  isAvailable(): Promise<boolean>;
  activeNote(): Promise<Note | null>;
  executeDataview(query: string): Promise<unknown>;
}

// ───────────────────────────────────────────
// 4-Level Dev System types
// ───────────────────────────────────────────

export interface DevPrompt {
  id: string;
  name: string;
  role: string;
  context: string;
  task: string;
  acceptanceCriteria: string[];
  verificationCommand?: string;
  variables: string[];
  created: string;
  updated: string;
}

export interface DevSkill {
  id: string;
  name: string;
  description: string;
  permissions: Array<{ command: string; action: 'pre-approved' | 'ask' | 'deny' }>;
  preconditions: string[];
  steps: string[];
  postconditions: string[];
  examples: Array<{ scenario: string; input: string; expected: string }>;
  errorHandling: Array<{ error: string; fix: string }>;
  created: string;
  updated: string;
}

export interface DevAgent {
  id: string;
  name: string;
  role: string;
  tools: string[];
  constraints: string[];
  systemPrompt: string;
  complexity: TaskComplexity;
  created: string;
  updated: string;
}

export type WorkflowPhase = 'spec' | 'draft' | 'simplify' | 'verify';

export interface DevWorkflow {
  id: string;
  name: string;
  description: string;
  phases: Array<{
    phase: WorkflowPhase;
    agents: string[];
    artifact: string;
    exitCriteria: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  currentPhase: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created: string;
  updated: string;
}

export interface DevSystemConfig {
  promptsFolder: string;
  skillsFolder: string;
  agentsFolder: string;
  workflowsFolder: string;
  claudeMdPath: string;
}

// ───────────────────────────────────────────
// Model-Aware Backup System (MABS) types
// ───────────────────────────────────────────

export interface ModelProfile {
  /** Unique model profile ID */
  id: string;
  /** Provider name: openai | anthropic | ollama | kimi */
  provider: string;
  /** Model identifier: gpt-4o, claude-3-5-sonnet, llama3.1, etc. */
  model: string;
  /** Human-readable label */
  label: string;
  /** Model capabilities / features */
  capabilities: readonly ModelCapability[];
  /** When this profile was first registered */
  created: string;
  /** Last time this model was used */
  lastUsed: string;
  /** Embedding model associated (if different from inference model) */
  embedModel?: string;
  /** Custom parameters (temperature, maxTokens, etc.) */
  parameters: Record<string, number | string | boolean>;
}

export type ModelCapability =
  | 'chat'
  | 'function-calling'
  | 'vision'
  | 'code-generation'
  | 'long-context'
  | 'reasoning'
  | 'embedding'
  | 'json-mode'
  | 'streaming';

export interface ArtifactSnapshot {
  /** SHA-256 hash of serialized artifact content (CoGit-style addressing) */
  hash: string;
  /** Artifact type */
  type: 'prompt' | 'skill' | 'agent' | 'workflow' | 'claude-md' | 'bootstrap';
  /** Original artifact ID */
  artifactId: string;
  /** Snapshot timestamp */
  timestamp: string;
  /** Which model profile created/used this artifact */
  modelProfileId: string;
  /** Whether this artifact is model-agnostic (can be reused across models) */
  modelAgnostic: boolean;
  /** Serialized content */
  content: string;
  /** Parent snapshot hash (for versioning chain) */
  parentHash?: string;
  /** Commit message / change description */
  message: string;
  /** Author: user or agent ID */
  author: string;
}

export interface SessionContextSnapshot {
  /** Unique session snapshot ID */
  id: string;
  /** Model profile used in this session */
  modelProfileId: string;
  /** Session type: dreaming | pipeline | dev-system | interactive */
  sessionType: string;
  /** Timestamp */
  timestamp: string;
  /** Context payload (opaque, depends on session type) */
  payload: Record<string, unknown>;
  /** Relevant artifact hashes used in this session */
  artifactHashes: string[];
  /** User query / intent that started the session */
  userIntent?: string;
  /** Whether this context can be replayed with another model */
  replayable: boolean;
}

export interface BackupManifest {
  /** Backup version format */
  version: number;
  /** Backup creation time */
  createdAt: string;
  /** Included model profiles */
  models: ModelProfile[];
  /** All artifact snapshots */
  artifacts: ArtifactSnapshot[];
  /** All session context snapshots */
  sessions: SessionContextSnapshot[];
  /** Model-agnostic artifact index (hash → artifact IDs) */
  agnosticIndex: Record<string, string[]>;
  /** CoGit refs (branch → commit hash) */
  refs: Record<string, string>;
}

export interface MABSConfig {
  /** Base directory for backups relative to vault root */
  backupDir: string;
  /** Max backups to retain per model */
  maxModelBackups: number;
  /** Auto-backup on artifact change */
  autoBackup: boolean;
  /** Include session contexts in backups */
  includeSessions: boolean;
  /** Compress snapshots (gzip) */
  compress: boolean;
}
