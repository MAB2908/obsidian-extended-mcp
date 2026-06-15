// v0.2b:
import { describe, it, expect, vi } from 'vitest';
import { createBridgeTools } from '../../src/tools/bridge.js';
import { createSecurityTools } from '../../src/tools/security.js';
import { createAiPipelineTools } from '../../src/tools/ai-pipeline.js';
import { createFilesystemTools } from '../../src/tools/filesystem.js';
import { createSemanticTools } from '../../src/tools/semantic.js';
import { createDreamingTools } from '../../src/tools/dreaming.js';
import { createCliTools } from '../../src/tools/cli.js';
import { createRestTools } from '../../src/tools/rest.js';

describe('Tool handlers', () => {
  describe('bridge', () => {
    it('pool_add_vault validates directory and adds', async () => {
      const pool = { addVault: vi.fn().mockResolvedValue({ vault: { root: '/tmp/v' } }) } as any;
      const init = vi.fn().mockResolvedValue(undefined);
      const tools = createBridgeTools(pool, null as any, false, undefined, null as any, init);
      expect(tools[1].name).toBe('pool_add_vault');

      const fs = await import('fs');
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({ isDirectory: () => true } as any);

      const result = await tools[1].handler({ path: '/tmp/v' });
      expect(pool.addVault).toHaveBeenCalledWith('/tmp/v', null, false);
      expect((result as any).content[0].text).toBe('Added vault: /tmp/v');
      statSpy.mockRestore();
    });
  });

  describe('security', () => {
    it('audit_log queries logger with defaults', async () => {
      const audit = { query: vi.fn().mockResolvedValue([{ event: 'x', tool: 't1' }]) } as any;
      const tools = createSecurityTools(vi.fn(), audit, null as any);
      const result = await tools[0].handler({ limit: 5 });
      expect(audit.query).toHaveBeenCalledWith({ event: undefined, tool: undefined, limit: 5 });
      expect((result as any).content[0].text).toContain('x');
    });

    it('audit_remote_status returns logger remote status', async () => {
      const audit = { getRemoteStatus: vi.fn().mockReturnValue({ configured: true, url: 'http://x', pendingFailures: 5, lastError: 'err' }) } as any;
      const tools = createSecurityTools(vi.fn(), audit, null as any);
      const statusTool = tools.find((t) => t.name === 'audit_remote_status');
      expect(statusTool).toBeDefined();
      const result = await statusTool!.handler({});
      expect(audit.getRemoteStatus).toHaveBeenCalled();
      expect((result as any).content[0].text).toContain('http://x');
      expect((result as any).content[0].text).toContain('pendingFailures');
    });

    it('rollback calls vault.rollback with exact args', async () => {
      const ctx = { vault: { rollback: vi.fn().mockResolvedValue(undefined) }, vaultPath: '/v' };
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createSecurityTools(resolve, null as any, null as any);
      const rollbackTool = tools.find((t) => t.name === 'rollback');
      expect(rollbackTool).toBeDefined();
      const result = await rollbackTool!.handler({ path: 'n.md', timestamp: 't1' });
      expect(ctx.vault.rollback).toHaveBeenCalledWith('n.md', 't1');
      expect((result as any).content[0].text).toBe('Rolled back n.md');
    });

    it('batch_edit blocks when unauthorized', async () => {
      const ctx = { vaultPath: '/v', vault: {} };
      const resolve = vi.fn().mockReturnValue(ctx);
      const security = { authorize: vi.fn().mockReturnValue({ allowed: false, reason: 'Blocked' }) };
      const audit = { log: vi.fn() } as any;
      const tools = createSecurityTools(resolve, audit, security as any);
      const batchEditTool = tools.find((t) => t.name === 'batch_edit');
      expect(batchEditTool).toBeDefined();
      const result = await batchEditTool!.handler({ filter: {}, operation: 'replace', target: 'x' });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain('Blocked');
    });

    it('batch_edit preview when authorized', async () => {
      const ctx = {
        vaultPath: '/v',
        vault: {
          batchEdit: vi.fn().mockResolvedValue({ modified: 1, paths: ['a.md'], previews: [{ path: 'a.md', before: 'x', after: 'y' }] }),
        },
      };
      const resolve = vi.fn().mockReturnValue(ctx);
      const security = { authorize: vi.fn().mockReturnValue({ allowed: true }) };
      const audit = { log: vi.fn() } as any;
      const tools = createSecurityTools(resolve, audit, security as any);
      const batchEditTool = tools.find((t) => t.name === 'batch_edit');
      expect(batchEditTool).toBeDefined();
      const result = await batchEditTool!.handler({ filter: { folder: 'notes' }, operation: 'replace', target: 'x', replacement: 'y', preview: true });
      expect(security.authorize).toHaveBeenCalledWith('batch_edit', expect.any(Object));
      expect((result as any).content[0].text).toContain('previews');
    });

    it('batch_edit apply when authorized', async () => {
      const ctx = {
        vaultPath: '/v',
        vault: {
          batchEdit: vi.fn().mockResolvedValue({ modified: 2, paths: [], previews: [] }),
        },
      };
      const resolve = vi.fn().mockReturnValue(ctx);
      const security = { authorize: vi.fn().mockReturnValue({ allowed: true }) };
      const audit = { log: vi.fn() } as any;
      const tools = createSecurityTools(resolve, audit, security as any);
      const batchEditTool = tools.find((t) => t.name === 'batch_edit');
      expect(batchEditTool).toBeDefined();
      const result = await batchEditTool!.handler({ filter: {}, operation: 'replace', target: 'x', replacement: 'y' });
      expect((result as any).content[0].text).toContain('modified');
      expect((result as any).content[0].text).toContain('2');
    });
  });

  describe('ai-pipeline', () => {
    it.each([
      { name: 'ai_ingest', idx: 0, args: { path: 'n.md' } },
      { name: 'ai_query', idx: 2, args: { question: 'q' } },
    ])('$name throws when pipeline missing', async ({ idx, args }) => {
      const resolve = vi.fn().mockReturnValue({ pipeline: null });
      const tools = createAiPipelineTools(resolve);
      await expect(tools[idx].handler(args)).rejects.toThrow('Pipeline not initialized');
    });

    it('ai_compile passes sinceDays to runCompile', async () => {
      const runCompile = vi.fn().mockResolvedValue({ concepts: [] });
      const resolve = vi.fn().mockReturnValue({ pipeline: { runCompile } });
      const tools = createAiPipelineTools(resolve);
      const result = await tools[3].handler({ sinceDays: 14 });
      expect(runCompile).toHaveBeenCalledWith(14);
      expect((result as any).content[0].text).toContain('concepts');
    });
  });

  describe('filesystem', () => {
    function makeFsCtx(overrides: Record<string, unknown> = {}) {
      return {
        vaultPath: '/v',
        vault: {
          writeNote: vi.fn().mockResolvedValue(undefined),
          deleteNote: vi.fn().mockResolvedValue(undefined),
        },
        indexer: { markDirty: vi.fn() },
        ...overrides,
      };
    }

    it('write_note calls vault.writeNote and marks dirty', async () => {
      const ctx = makeFsCtx();
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createFilesystemTools(resolve, { read: vi.fn() } as any);
      const result = await tools[1].handler({ path: 'n.md', content: '# Hello', frontmatter: { tags: ['t'] }, overwrite: true });
      expect(ctx.vault.writeNote).toHaveBeenCalledWith('n.md', '# Hello', { frontmatter: { tags: ['t'] }, overwrite: true });
      expect(ctx.indexer.markDirty).toHaveBeenCalledWith('n.md');
      expect((result as any).content[0].text).toBe('Wrote n.md');
    });

    it('delete_note calls vault.deleteNote', async () => {
      const ctx = makeFsCtx();
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createFilesystemTools(resolve, { read: vi.fn() } as any);
      const result = await tools[4].handler({ path: 'n.md', soft: true });
      expect(ctx.vault.deleteNote).toHaveBeenCalledWith('n.md', { soft: true });
      expect((result as any).content[0].text).toBe('Deleted n.md');
    });
  });

  describe('semantic', () => {
    function makeSemanticCtx(overrides: Record<string, unknown> = {}) {
      return {
        vaultPath: '/v',
        semanticDb: {
          searchFTS: vi.fn().mockReturnValue([
            { path: 'a.md', score: 1, snippet: 'snip' },
          ]),
        },
        vector: { search: vi.fn().mockResolvedValue([{ path: 'b.md', score: 0.9, snippet: 'snip2', highlights: ['q'] }]) },
        ...overrides,
      };
    }

    it('semantic_search fuses fts5 and vector results', async () => {
      const ctx = makeSemanticCtx();
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createSemanticTools(resolve);
      const result = await tools[5].handler({ query: 'test' });
      expect(ctx.semanticDb.searchFTS).toHaveBeenCalledWith('test', 20);
      expect(ctx.vector.search).toHaveBeenCalledWith('test', 20);
      expect((result as any).content[0].text).toContain('a.md');
      expect((result as any).content[0].text).toContain('b.md');
    });

    it('semantic_search falls back to fts5 when vector missing', async () => {
      const ctx = makeSemanticCtx({ vector: undefined });
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createSemanticTools(resolve);
      const result = await tools[5].handler({ query: 'test' });
      expect((result as any).content[0].text).toContain('a.md');
    });
  });

  describe('dreaming', () => {
    function makeDreamingCtx(engine: unknown) {
      return {
        vaultPath: '/v',
        vault: {},
        semanticDb: {},
        dreaming: engine,
      };
    }

    it('dream_scan uses cached engine with exact args', async () => {
      const mockEngine = {
        scan: vi.fn().mockResolvedValue({
          sessionId: 's1',
          timestamp: '2024-01-01',
          vaultPath: '/v',
          candidates: { link: [], merge: [], prune: [], synthesize: [] },
        }),
        finalize: vi.fn(),
        undo: vi.fn(),
      };
      const ctx = makeDreamingCtx(mockEngine);
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createDreamingTools(resolve);
      const result = await tools[0].handler({ vaultPath: '/v', kinds: ['link'], maxCandidates: 10 });
      expect(mockEngine.scan).toHaveBeenCalledWith({
        vaultPath: '/v',
        kinds: ['link'],
        maxCandidates: 10,
        scope: undefined,
      });
      expect((result as any).content[0].text).toContain('s1');
    });

    it('dream_finalize returns archived count', async () => {
      const mockEngine = {
        scan: vi.fn(),
        finalize: vi.fn().mockResolvedValue({ archived: ['a.md', 'b.md'] }),
        undo: vi.fn(),
      };
      const ctx = makeDreamingCtx(mockEngine);
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createDreamingTools(resolve);
      const result = await tools[1].handler({ sessionId: 's1', archivePaths: ['a.md', 'b.md'] });
      expect(mockEngine.finalize).toHaveBeenCalledWith({ sessionId: 's1', vaultPath: '/v', archivePaths: ['a.md', 'b.md'] });
      expect((result as any).content[0].text).toBe('Archived 2 path(s): a.md, b.md');
    });

    it('dream_undo returns restored count', async () => {
      const mockEngine = {
        scan: vi.fn(),
        finalize: vi.fn(),
        undo: vi.fn().mockResolvedValue({ restored: ['x.md'] }),
      };
      const ctx = makeDreamingCtx(mockEngine);
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createDreamingTools(resolve);
      const result = await tools[2].handler({ sessionId: 's1' });
      expect(mockEngine.undo).toHaveBeenCalledWith('s1');
      expect((result as any).content[0].text).toBe('Restored 1 path(s): x.md');
    });
  });

  describe('cli', () => {
    function makeCliCtx() {
      return {
        vaultPath: '/v',
        vault: { readNote: vi.fn(), writeNote: vi.fn() },
        graph: { getGraph: vi.fn().mockReturnValue({ orphans: [], deadends: [], unresolved: [] }), getNeighbors: vi.fn().mockReturnValue([]) },
        semanticDb: { getStats: vi.fn().mockReturnValue({ nodes: 0 }), searchFTS: vi.fn().mockReturnValue([]) },
      };
    }

    function getCliTools(sandbox: unknown) {
      const ctx = makeCliCtx();
      const tools = createCliTools(vi.fn().mockReturnValue(ctx), sandbox as any);
      const evalTool = tools.find((t) => t.name === 'cli_eval');
      return { evalTool, ctx };
    }

    it('cli_eval returns sandbox result', async () => {
      const sandbox = { execute: vi.fn().mockResolvedValue({ result: 42 }) };
      const { evalTool } = getCliTools(sandbox);
      if (!evalTool) {
        // cli_eval is filtered out when ENABLE_EVAL=false
        return;
      }
      const result = await evalTool.handler({ code: '1+1' });
      expect(sandbox.execute).toHaveBeenCalledWith('1+1');
      expect((result as any).content[0].text).toBe('{"result":42}');
    });

    it('cli_eval returns error on sandbox failure', async () => {
      const sandbox = { execute: vi.fn().mockRejectedValue(new Error('Timeout')) };
      const { evalTool } = getCliTools(sandbox);
      if (!evalTool) {
        // cli_eval is filtered out when ENABLE_EVAL=false
        return;
      }
      const result = await evalTool.handler({ code: 'while(true){}' });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain('Sandbox error: Timeout');
    });
  });

  describe('rest', () => {
    function makeRest() {
      return {
        isAvailable: vi.fn().mockResolvedValue(true),
        activeNote: vi.fn().mockResolvedValue({ path: 'a.md', content: '# A' }),
        executeDataview: vi.fn().mockResolvedValue({ values: [] }),
        getNote: vi.fn().mockResolvedValue({ path: 'n.md', content: 'c', frontmatter: {} }),
        writeNote: vi.fn().mockResolvedValue(undefined),
        deleteNote: vi.fn().mockResolvedValue(undefined),
        listTags: vi.fn().mockResolvedValue(['t1']),
        executeCommand: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([{ path: 'n.md', score: 1 }]),
      };
    }

    it('rest_active_note returns active note', async () => {
      const rest = makeRest();
      const tools = createRestTools(rest as any);
      const tool = tools.find((t) => t.name === 'rest_active_note');
      expect(tool).toBeDefined();
      const result = await tool!.handler({});
      expect(rest.activeNote).toHaveBeenCalled();
      expect((result as any).content[0].text).toContain('a.md');
    });

    it('rest_get_note calls getNote', async () => {
      const rest = makeRest();
      const tools = createRestTools(rest as any);
      const tool = tools.find((t) => t.name === 'rest_get_note');
      const result = await tool!.handler({ path: 'n.md' });
      expect(rest.getNote).toHaveBeenCalledWith('n.md');
      expect((result as any).content[0].text).toContain('n.md');
    });

    it('rest_write_note calls writeNote when enabled', async () => {
      const rest = makeRest();
      const tools = createRestTools(rest as any);
      const tool = tools.find((t) => t.name === 'rest_write_note');
      if (!tool) {
        // filtered out when ENABLE_COMMANDS=false
        return;
      }
      const result = await tool.handler({ path: 'n.md', content: '# Hello' });
      expect(rest.writeNote).toHaveBeenCalledWith('n.md', '# Hello');
      expect((result as any).content[0].text).toBe('Wrote n.md');
    });

    it('rest_delete_note calls deleteNote when enabled', async () => {
      const rest = makeRest();
      const tools = createRestTools(rest as any);
      const tool = tools.find((t) => t.name === 'rest_delete_note');
      if (!tool) {
        // filtered out when ENABLE_COMMANDS=false
        return;
      }
      const result = await tool.handler({ path: 'n.md' });
      expect(rest.deleteNote).toHaveBeenCalledWith('n.md');
      expect((result as any).content[0].text).toBe('Deleted n.md');
    });

    it('rest_list_tags calls listTags', async () => {
      const rest = makeRest();
      const tools = createRestTools(rest as any);
      const tool = tools.find((t) => t.name === 'rest_list_tags');
      const result = await tool!.handler({});
      expect(rest.listTags).toHaveBeenCalled();
      expect((result as any).content[0].text).toContain('t1');
    });

    it('rest_execute_command calls executeCommand when enabled', async () => {
      const rest = makeRest();
      const tools = createRestTools(rest as any);
      const tool = tools.find((t) => t.name === 'rest_execute_command');
      if (!tool) {
        // filtered out when ENABLE_COMMANDS=false
        return;
      }
      const result = await tool.handler({ commandId: 'app:reload' });
      expect(rest.executeCommand).toHaveBeenCalledWith('app:reload');
      expect((result as any).content[0].text).toContain('app:reload');
    });

    it('rest_search calls search', async () => {
      const rest = makeRest();
      const tools = createRestTools(rest as any);
      const tool = tools.find((t) => t.name === 'rest_search');
      const result = await tool!.handler({ query: 'foo' });
      expect(rest.search).toHaveBeenCalledWith('foo');
      expect((result as any).content[0].text).toContain('n.md');
    });
  });
});
