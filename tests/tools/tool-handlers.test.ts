// v0.2b:
import { describe, it, expect, vi } from 'vitest';
import { createBridgeTools } from '../../src/tools/bridge.js';
import { createSecurityTools } from '../../src/tools/security.js';
import { createAiPipelineTools } from '../../src/tools/ai-pipeline.js';
import { createFilesystemTools } from '../../src/tools/filesystem.js';
import { createSemanticTools } from '../../src/tools/semantic.js';
import { createDreamingTools } from '../../src/tools/dreaming.js';
import { createCliTools } from '../../src/tools/cli.js';

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

    it('rollback calls vault.rollback with exact args', async () => {
      const ctx = { vault: { rollback: vi.fn().mockResolvedValue(undefined) }, vaultPath: '/v' };
      const resolve = vi.fn().mockReturnValue(ctx);
      const tools = createSecurityTools(resolve, null as any, null as any);
      const result = await tools[2].handler({ path: 'n.md', timestamp: 't1' });
      expect(ctx.vault.rollback).toHaveBeenCalledWith('n.md', 't1');
      expect((result as any).content[0].text).toBe('Rolled back n.md');
    });

    it('batch_edit blocks when unauthorized', async () => {
      const ctx = { vaultPath: '/v', vault: {} };
      const resolve = vi.fn().mockReturnValue(ctx);
      const security = { authorize: vi.fn().mockReturnValue({ allowed: false, reason: 'Blocked' }) };
      const audit = { log: vi.fn() } as any;
      const tools = createSecurityTools(resolve, audit, security as any);
      const result = await tools[3].handler({ filter: {}, operation: 'replace', target: 'x' });
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
      const result = await tools[3].handler({ filter: { folder: 'notes' }, operation: 'replace', target: 'x', replacement: 'y', preview: true });
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
      const result = await tools[3].handler({ filter: {}, operation: 'replace', target: 'x', replacement: 'y' });
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
        bm25: {},
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
    it('cli_eval returns sandbox result', async () => {
      const sandbox = { execute: vi.fn().mockResolvedValue({ result: 42 }) };
      const tools = createCliTools(vi.fn(), sandbox as any);
      const result = await tools[5].handler({ code: '1+1' });
      expect(sandbox.execute).toHaveBeenCalledWith('1+1');
      expect((result as any).content[0].text).toBe('{"result":42}');
    });

    it('cli_eval returns error on sandbox failure', async () => {
      const sandbox = { execute: vi.fn().mockRejectedValue(new Error('Timeout')) };
      const tools = createCliTools(vi.fn(), sandbox as any);
      const result = await tools[5].handler({ code: 'while(true){}' });
      expect((result as any).isError).toBe(true);
      expect((result as any).content[0].text).toContain('Sandbox error: Timeout');
    });
  });
});
