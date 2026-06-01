// v0.1b:
import { promises as fs } from 'fs';
import path from 'path';
import { VaultManager } from '../../src/layers/L1-filesystem/VaultManager.js';
import { GraphEngine } from '../../src/layers/L4-semantic/GraphEngine.js';
import { BM25Engine } from '../../src/layers/L4-semantic/BM25Engine.js';
import { BackgroundIndexer } from '../../src/layers/L4-semantic/BackgroundIndexer.js';
import { SemanticDatabase } from '../../src/layers/L4-semantic/SemanticDatabase.js';
import { Dispatcher } from '../../src/layers/L3-pipeline/Dispatcher.js';
import { FolderACL } from '../../src/security/FolderACL.js';
import { AuditLogger } from '../../src/security/AuditLogger.js';
import { OperationGate } from '../../src/security/OperationGate.js';
import { SecurityEngine } from '../../src/security/SecurityEngine.js';
import { Sandbox } from '../../src/security/Sandbox.js';
import { BatchEditGuard } from '../../src/security/BatchEditGuard.js';
import { FileTypeRouter, markdownHandler, canvasHandler, jsonHandler } from '../../src/shared/FileTypeRouter.js';
import { PipelineOrchestrator } from '../../src/layers/L3-pipeline/PipelineOrchestrator.js';
import { LLMAdapter } from '../../src/layers/L6-ai-core/LLMAdapter.js';
import { MockLLMProvider } from './mock-llm.js';

export interface TestServer {
  vault: VaultManager;
  graph: GraphEngine;
  bm25: BM25Engine;
  dispatcher: Dispatcher;
  indexer: BackgroundIndexer;
  semanticDb: SemanticDatabase;
  security: SecurityEngine;
  batchEditGuard: BatchEditGuard;
  fileRouter: FileTypeRouter;
  vaultPath: string;
  pipeline?: PipelineOrchestrator;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      // Retry on EBUSY / EPERM (Windows file locks, e.g. audit.log held by another process)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fs.copyFile(srcPath, destPath);
          break;
        } catch (e) {
          const err = e as { code?: string };
          if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < 2) {
            await new Promise((r) => setTimeout(r, 200));
          } else {
            throw e;
          }
        }
      }
    }
  }
}

async function collectAllMarkdownFiles(vault: VaultManager): Promise<string[]> {
  const results: string[] = [];
  const walk = async (dir: string) => {
    const entries = await vault.listDirectory(dir);
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory) {
        await walk(rel);
      } else if (e.name.endsWith('.md')) {
        results.push(rel);
      }
    }
  };
  await walk('');
  return results;
}

export async function setupTestServer(fixturePath: string, useMockLLM = false): Promise<TestServer> {
  const srcPath = path.resolve(fixturePath);
  const vaultPath = path.join(srcPath, '..', `.test-vault-${Date.now()}`);
  await copyDir(srcPath, vaultPath);

  const acl = new FolderACL();
  const audit = new AuditLogger({ vaultPath });
  const gate = new OperationGate();
  const sandbox = new Sandbox();

  const securityPolicy = {
    operations: {
      readOnly: false,
      enableCommands: true,
      enableEval: true,
      enableBatchEdit: true,
      enableDelete: true,
    },
    folders: {
      safeZones: undefined,
      writePaths: undefined,
      forbiddenPaths: undefined,
    },
    approval: {
      mode: 'auto' as const,
    },
  };
  const security = new SecurityEngine(securityPolicy, acl, gate, audit, sandbox);
  const vault = new VaultManager(vaultPath, acl);
  const graph = new GraphEngine();
  const bm25 = new BM25Engine();

  const semanticDb = new SemanticDatabase(vaultPath);
  await semanticDb.initSchema();
  const indexer = new BackgroundIndexer(vault, graph, bm25, undefined, undefined, semanticDb);

  let pipeline: PipelineOrchestrator | undefined;
  if (useMockLLM) {
    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(new MockLLMProvider());
    pipeline = new PipelineOrchestrator(vault, graph, bm25, indexer, adapter);
  }

  const batchEditGuard = new BatchEditGuard(vaultPath, vault);
  const fileRouter = new FileTypeRouter();
  fileRouter.register(markdownHandler);
  fileRouter.register(canvasHandler);
  fileRouter.register(jsonHandler);

  const dispatcher = new Dispatcher(audit);

  // Register core tools used in E2E tests
  dispatcher.register({
    name: 'read_note',
    description: 'Read a markdown note from the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        includeFrontmatter: { type: 'boolean' },
        includeContent: { type: 'boolean' },
      },
      required: ['path'],
    },
    handler: async (args) => {
      const { path: notePath, includeFrontmatter, includeContent } = args as {
        path: string; includeFrontmatter?: boolean; includeContent?: boolean;
      };
      const note = await vault.readNote(notePath, { includeFrontmatter, includeContent });
      return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
    },
  });

  dispatcher.register({
    name: 'write_note',
    description: 'Write a markdown note to the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        frontmatter: { type: 'object' },
        overwrite: { type: 'boolean' },
      },
      required: ['path', 'content'],
    },
    handler: async (args) => {
      const { path: notePath, content, frontmatter, overwrite } = args as {
        path: string; content: string; frontmatter?: Record<string, unknown>; overwrite?: boolean;
      };
      await vault.writeNote(notePath, content, { frontmatter, overwrite });
      indexer.markDirty(notePath);
      return { content: [{ type: 'text', text: `Wrote ${notePath}` }] };
    },
  });

  dispatcher.register({
    name: 'patch_note',
    description: 'Patch a note with replace/append/prepend/delete',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        target: { type: 'string' },
        operation: { type: 'string', enum: ['replace', 'append', 'prepend', 'delete'] },
        replacement: { type: 'string' },
      },
      required: ['path', 'target', 'operation'],
    },
    handler: async (args) => {
      const { path: notePath, target, operation, replacement } = args as {
        path: string; target: string; operation: 'replace' | 'append' | 'prepend' | 'delete'; replacement?: string;
      };
      await vault.patchNote(notePath, target, operation, replacement);
      indexer.markDirty(notePath);
      return { content: [{ type: 'text', text: `Patched ${notePath}` }] };
    },
  });

  dispatcher.register({
    name: 'move_note',
    description: 'Move or rename a note',
    inputSchema: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
      required: ['from', 'to'],
    },
    handler: async (args) => {
      const { from, to } = args as { from: string; to: string };
      await vault.moveNote(from, to);
      indexer.markDirty(to);
      return { content: [{ type: 'text', text: `Moved ${from} → ${to}` }] };
    },
  });

  dispatcher.register({
    name: 'graph_neighbors',
    description: 'Get graph neighbors of a note',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, direction: { type: 'string', enum: ['both', 'in', 'out'] } },
      required: ['path'],
    },
    handler: async (args) => {
      const { path: notePath, direction } = args as { path: string; direction?: 'both' | 'in' | 'out' };
      const neighbors = graph.getNeighbors(notePath, direction);
      return { content: [{ type: 'text', text: JSON.stringify(neighbors) }] };
    },
  });

  dispatcher.register({
    name: 'fs_get_graph',
    description: 'Export full vault graph as adjacency list',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const data = graph.getGraph();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  });

  dispatcher.register({
    name: 'bm25_search',
    description: 'BM25 full-text search over indexed notes',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
    handler: async (args) => {
      const { query, limit } = args as { query: string; limit?: number };
      const results = bm25.search(query, limit);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    },
  });

  dispatcher.register({
    name: 'semantic_search_db',
    description: 'Semantic search via SQLite FTS5 + persisted embeddings',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
    handler: async (args) => {
      const { query, limit } = args as { query: string; limit?: number };
      const results = semanticDb.searchFTS(query, limit ?? 20);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    },
  });

  dispatcher.register({
    name: 'build_index',
    description: 'Trigger a full vault reindex',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      indexer.markAllDirty();
      return { content: [{ type: 'text', text: 'Reindex scheduled' }] };
    },
  });

  if (pipeline) {
    dispatcher.register({
      name: 'ai_ingest',
      description: 'Run AI ingest on a note',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async (args) => {
        const { path: notePath } = args as { path: string };
        const result = await pipeline!.runIngest(notePath);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });

    dispatcher.register({
      name: 'ai_compile',
      description: 'Compile sources into concepts and update MOCs',
      inputSchema: { type: 'object', properties: { sinceDays: { type: 'number' } } },
      handler: async (args) => {
        const { sinceDays } = args as { sinceDays?: number };
        const result = await pipeline!.runCompile(sinceDays);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });

    dispatcher.register({
      name: 'ai_query',
      description: 'Ask a natural language question over the vault',
      inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
      handler: async (args) => {
        const { question } = args as { question: string };
        const result = await pipeline!.runQuery(question);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    });
  }

  // Manually build graph and BM25 index synchronously (avoid async background batch issues in tests)
  const files = await collectAllMarkdownFiles(vault);
  const linkMap = new Map<string, string>();
  for (const relPath of files) {
    const note = await vault.readNote(relPath, { includeFrontmatter: false, includeContent: false });
    const base = relPath.replace(/\.md$/, '');
    const basename = base.split('/').pop() || base;
    linkMap.set(basename, relPath);
    linkMap.set(base, relPath);
    for (const alias of (note.frontmatter.aliases as string[]) || []) {
      linkMap.set(alias, relPath);
    }
  }

  for (const relPath of files) {
    const note = await vault.readNote(relPath, { includeFrontmatter: true, includeContent: true });
    const resolvedOutbound = note.outboundLinks.map((target) => {
      if (linkMap.has(target)) return linkMap.get(target)!;
      const basename = target.split('/').pop() || target;
      return linkMap.get(basename) || target;
    });

    bm25.addDoc(relPath, `${note.title} ${note.content}`);
    graph.addNode({
      path: relPath,
      title: note.title,
      aliases: (note.frontmatter.aliases as string[]) || [],
      tags: note.tags,
      frontmatter: note.frontmatter,
      outbound: resolvedOutbound,
      inbound: [],
      isOrphan: resolvedOutbound.length === 0,
      isDeadend: false,
      hasUnresolvedLinks: resolvedOutbound.some((t) => !linkMap.has(t)),
    });
    for (const target of resolvedOutbound) {
      graph.addEdge(relPath, target, 'wikilink');
    }
    semanticDb.upsertNode({
      path: relPath,
      title: note.title,
      contentHash: '',
      wordCount: note.content.split(/\s+/).length,
    });
    semanticDb.deleteEdgesFrom(relPath);
    for (const target of resolvedOutbound) {
      semanticDb.upsertEdge({ fromPath: relPath, toPath: target, type: 'wikilink' });
    }
    semanticDb.updateFTSContent(relPath, `${note.title}\n${note.content}`);
  }

  return { vault, graph, bm25, dispatcher, indexer, semanticDb, security, batchEditGuard, fileRouter, vaultPath, pipeline };
}

export async function teardownTestServer(server: TestServer | undefined): Promise<void> {
  if (!server) return;
  server.indexer?.stop();
  server.semanticDb?.close();
  // Give SQLite a moment to release the file lock before deleting
  await new Promise((r) => setTimeout(r, 300));
  // Windows may need retries for EPERM on busy files
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await fs.rm(server.vaultPath, { recursive: true, force: true });
      break;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        await new Promise((r) => setTimeout(r, 500));
      } else {
        throw e;
      }
    }
  }
}
