#!/usr/bin/env node
// v0.3.0:
// v0.3.0:
// Load .env with override BEFORE any config imports (ESM hoisting safety)
import './shared/load-env.js';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';

import { Dispatcher } from './layers/L3-pipeline/Dispatcher.js';
import { LLMAdapter } from './layers/L6-ai-core/LLMAdapter.js';
import { OpenAIProvider } from './layers/L6-ai-core/providers/OpenAIProvider.js';
import { AnthropicProvider } from './layers/L6-ai-core/providers/AnthropicProvider.js';
import { OllamaProvider } from './layers/L6-ai-core/providers/OllamaProvider.js';

import { RestBridge } from './layers/L2b-rest/RestBridge.js';
import { ContextBootstrap } from './layers/L5-bootstrap/ContextBootstrap.js';
import { AuditLogger } from './security/AuditLogger.js';
import { OperationGate } from './security/OperationGate.js';
import { FolderACL } from './security/FolderACL.js';
import { SecurityEngine } from './security/SecurityEngine.js';
import { Sandbox } from './security/Sandbox.js';
import { IndexPersistence } from './layers/L4-semantic/IndexPersistence.js';
import { OllamaEmbeddingProvider, OpenAIEmbeddingProvider, type EmbeddingProvider } from './layers/L4-semantic/EmbeddingProvider.js';
// RRFusion imported in semantic tools module
import { FileTypeRouter, markdownHandler, canvasHandler, jsonHandler } from './shared/FileTypeRouter.js';

// BatchEditGuard imported in security tools module
import { AuthTransportWrapper } from './security/AuthTransportWrapper.js';
import { VaultPool } from './layers/L1-filesystem/VaultPool.js';
import { VaultRouter } from './layers/L1-filesystem/VaultRouter.js';
import { DevSystemEngine } from './layers/L7-dev-system/index.js';
import { VectorEngine } from './layers/L4-semantic/VectorEngine.js';
import { BackgroundIndexer } from './layers/L4-semantic/BackgroundIndexer.js';
import { PipelineOrchestrator } from './layers/L3-pipeline/PipelineOrchestrator.js';
import { VaultPathNotFoundError } from './shared/errors.js';
import { createDevSystemTools } from './tools/dev-system.js';
import { createDreamingTools } from './tools/dreaming.js';
import { createAutoDreamTools } from './tools/auto-dream.js';
import { createRestTools } from './tools/rest.js';
import { createBootstrapTools } from './tools/bootstrap.js';
import { createCliTools } from './tools/cli.js';
import { createSemanticTools } from './tools/semantic.js';
import { createAiPipelineTools } from './tools/ai-pipeline.js';
import { createFilesystemTools } from './tools/filesystem.js';
import { createSecurityTools } from './tools/security.js';
import { createBridgeTools } from './tools/bridge.js';
import { createBackupTools } from './tools/backup.js';
import { ModelAwareBackupService } from './shared/ModelAwareBackupService.js';
import {
  serverConfig,
  llmConfig,
  semanticConfig,
  securityConfig,
  bridgeConfig,
  validateConfig,
  autoDreamingConfig,
} from './shared/config.js';

async function main() {
  // Validate centralized config first
  validateConfig();

  const vaultPath = serverConfig.vaultPath;
  const openAiKey = llmConfig.openAiKey;

  // Startup validation (E901, E902)
  try {
    const vaultStat = await fs.stat(vaultPath);
    if (!vaultStat.isDirectory()) {
      throw new VaultPathNotFoundError(vaultPath);
    }
  } catch (e) {
    if (e instanceof VaultPathNotFoundError) throw e;
    throw new VaultPathNotFoundError(vaultPath);
  }

  const acl = new FolderACL();
  const audit = new AuditLogger({ vaultPath });
  const gate = new OperationGate();
  const sandbox = new Sandbox();

  const securityPolicy = {
    transport: serverConfig.authToken ? { token: serverConfig.authToken } : undefined,
    operations: {
      readOnly: securityConfig.readOnly,
      enableCommands: securityConfig.enableCommands,
      enableEval: securityConfig.enableEval,
      enableBatchEdit: securityConfig.enableBatchEdit,
      enableDelete: securityConfig.enableDelete,
    },
    folders: {
      safeZones: securityConfig.safeZones,
      writePaths: securityConfig.writePaths,
      forbiddenPaths: securityConfig.forbiddenPaths,
    },
    vault: {
      allowedRoots: [vaultPath],
    },
    approval: {
      mode: securityConfig.approvalMode,
    },
  };
  const security = new SecurityEngine(securityPolicy, acl, gate, audit, sandbox);
  const enforceOntology = serverConfig.enforceOntology;
  const multiVault = serverConfig.multiVault;

  const pool = new VaultPool();
  const defaultEntry = await pool.addVault(vaultPath, acl, enforceOntology);

  const router = new VaultRouter(pool, vaultPath);

  function resolveVault(args: Record<string, unknown>) {
    return router.resolve(args);
  }

  // Semantic / Vector
  let embedProvider: EmbeddingProvider | undefined;
  if (semanticConfig.enabled) {
    embedProvider = llmConfig.openAiKey
      ? new OpenAIEmbeddingProvider(llmConfig.openAiKey, semanticConfig.embedModel)
      : new OllamaEmbeddingProvider(process.env.OLLAMA_EMBED_BASE_URL || llmConfig.ollamaBaseUrl, semanticConfig.ollamaEmbedModel);
    console.error(`[Semantic] Embedding provider: ${embedProvider?.name}, model: ${semanticConfig.ollamaEmbedModel}, baseUrl: ${(embedProvider as { baseUrl?: string } | undefined)?.baseUrl ?? (process.env.OLLAMA_EMBED_BASE_URL || llmConfig.ollamaBaseUrl)}`);
  }

  const persistence = multiVault ? undefined : new IndexPersistence(vaultPath);

  // Initialize L4 components on the vault entry (moved from VaultPool to avoid L1→L3/L6 dependency)
  async function initializeVaultEntry(
    entry: typeof defaultEntry,
    embedProviderArg?: EmbeddingProvider,
    adapter?: LLMAdapter
  ): Promise<void> {
    if (embedProviderArg && !entry.vector) {
      entry.vector = new VectorEngine(embedProviderArg);
    }
    if (!entry.indexer) {
      entry.indexer = new BackgroundIndexer(entry.vault, entry.graph, entry.vector, persistence, entry.semanticDb);
      await entry.indexer.initialize();
    }
    if (adapter && !entry.pipeline && entry.indexer) {
      entry.pipeline = new PipelineOrchestrator(entry.vault, entry.graph, entry.semanticDb, entry.indexer, adapter);
    }
  }

  await initializeVaultEntry(defaultEntry, embedProvider, undefined);

  const adapter = new LLMAdapter(llmConfig.defaultProvider);

  // Model-Aware Backup System (MABS) must be attached before providers register their profiles
  const mabs = new ModelAwareBackupService(vaultPath);
  await mabs.initialize();
  adapter.attachBackupService(mabs);

  if (openAiKey) {
    adapter.registerProvider(
      new OpenAIProvider({
        apiKey: openAiKey,
        model: llmConfig.openAiModel,
      })
    );
  }
  if (llmConfig.anthropicKey) {
    adapter.registerProvider(
      new AnthropicProvider({
        apiKey: llmConfig.anthropicKey,
        model: llmConfig.anthropicModel,
      })
    );
  }
  if (llmConfig.ollamaBaseUrl) {
    adapter.registerProvider(
      new OllamaProvider({
        baseUrl: llmConfig.ollamaBaseUrl,
        model: llmConfig.ollamaModel,
        apiKey: llmConfig.ollamaApiKey,
      })
    );
  }

  // Re-initialize with adapter for pipeline
  await initializeVaultEntry(defaultEntry, embedProvider, adapter);

  // CliBridge created per-vault on demand
  const rest = new RestBridge({
    baseUrl: bridgeConfig.restApiUrl,
    token: bridgeConfig.restApiToken,
  });

  const bootstrap = new ContextBootstrap(vaultPath);
  const dispatcher = new Dispatcher(audit);

  // L7: 4-Level Dev System
  const devSystem = new DevSystemEngine(defaultEntry.vault);
  await devSystem.initialize();
  devSystem.attachBackupService(mabs);

  // BatchEditGuard is created per-vault on demand

  const fileRouter = new FileTypeRouter(vaultPath);
  fileRouter.register(markdownHandler);
  fileRouter.register(canvasHandler);
  fileRouter.register(jsonHandler);
  // L1 + Extended Filesystem tools
  for (const tool of createFilesystemTools(resolveVault, fileRouter)) {
    dispatcher.register(tool);
  }

  // L4 Semantic + L6 AI Pipeline tools
  for (const tool of createSemanticTools(resolveVault)) {
    dispatcher.register(tool);
  }
  for (const tool of createAiPipelineTools(resolveVault)) {
    dispatcher.register(tool);
  }

  // Security / Audit tools
  for (const tool of createSecurityTools(resolveVault, audit, security)) {
    dispatcher.register(tool);
  }

  // L5 Bootstrap tools
  for (const tool of createBootstrapTools(bootstrap)) {
    dispatcher.register(tool);
  }

  // L2 CLI Bridge tools
  for (const tool of createCliTools(resolveVault, sandbox)) {
    dispatcher.register(tool);
  }

  // L2b REST Bridge tools
  for (const tool of createRestTools(rest)) {
    dispatcher.register(tool);
  }

  // Multi-vault management tools
  for (const tool of createBridgeTools(pool, acl, enforceOntology, embedProvider, adapter, initializeVaultEntry)) {
    dispatcher.register(tool);
  }
  // ─── L7: 4-Level Dev System Tools ───
  for (const tool of createDevSystemTools(devSystem)) {
    dispatcher.register(tool);
  }

  // ─── L9: Dreaming Tools ───
  for (const tool of createDreamingTools(resolveVault)) {
    dispatcher.register(tool);
  }

  // ─── L9: Auto-Dreaming Tools ───
  for (const tool of createAutoDreamTools()) {
    dispatcher.register(tool);
  }

  // ─── MABS: Model-Aware Backup Tools ───
  for (const tool of createBackupTools(mabs)) {
    dispatcher.register(tool);
  }

  // ─── Auto-Dreaming Bootstrap ───
  if (autoDreamingConfig.enabled) {
    const { spawn } = await import('child_process');
    const scriptPath = path.resolve(process.cwd(), 'scripts/auto-dream.mjs');

    function runAutoDream(vaultPath: string) {
      const args = [scriptPath, vaultPath];
      if (autoDreamingConfig.dryRun) args.push('--dry-run');
      if (autoDreamingConfig.watch) args.push('--watch');
      if (!autoDreamingConfig.watch && autoDreamingConfig.intervalHours > 0) {
        args.push('--cron', String(autoDreamingConfig.intervalHours));
      }
      console.error(`[AutoDream] Starting ${autoDreamingConfig.dryRun ? 'DRY-RUN' : ''} for ${vaultPath}`);
      const child = spawn(process.execPath, args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }

    // Run for default vault
    runAutoDream(vaultPath);

    // Run for all vaults in pool
    const allVaults = pool.listVaults ? pool.listVaults() : [];
    for (const v of allVaults) {
      if (v.path !== vaultPath) {
        runAutoDream(v.path);
      }
    }
  }

  const server = new Server(
    { name: 'obsidian-extended-mcp', version: '0.3.1' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: dispatcher.listTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>,
      })),
    };
  });

  // Serialize tool calls so that write→read operations in the same session
  // are processed in order. The MCP SDK may dispatch requests concurrently.
  let toolQueue: Promise<CallToolResult> = Promise.resolve({ content: [] });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return toolQueue = toolQueue.then(async () => {
      const { name, arguments: args } = request.params;
      try {
        const auth = security.authorize(name, args as Record<string, unknown>);
        if (!auth.allowed) {
          audit.log({ event: 'security', tool: name, reason: auth.reason, blocked: true, vaultPath: (args as Record<string, unknown>)?.vaultPath as string | undefined });
          return { content: [{ type: 'text', text: `Security blocked: ${auth.reason}` }], isError: true };
        }
        const result = await dispatcher.call(name, args);
        return result as CallToolResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        audit.log({ event: 'error', tool: name, message, blocked: false });
        return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
      }
    });
  });

  const transport = new StdioServerTransport();
  let authWrapper: AuthTransportWrapper | undefined;
  // Wire transport token verification for stdio transport
  if (serverConfig.authToken) {
    authWrapper = new AuthTransportWrapper(
      transport,
      (token) => security.verifyToken(token),
      (reason, token) => {
        audit.log({ event: 'security', tool: 'transport_auth', reason, blocked: true, message: token ? '***redacted***' : undefined });
      }
    );
    authWrapper.wrap();
  }
  await server.connect(transport);
  console.error('Obsidian Extended MCP server running on stdio');

  async function shutdown(signal: string) {
    console.error(`Received ${signal}, shutting down gracefully...`);
    try {
      await audit.flush();
      await pool.shutdown();
      authWrapper?.unwrap();
      await server.close();
    } catch (err) {
      console.error('Shutdown error:', err);
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
