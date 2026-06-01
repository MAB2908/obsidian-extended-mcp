// v0.1b:
import { describe, it, expect, vi } from 'vitest';
import { VaultManager } from '../src/layers/L1-filesystem/VaultManager.js';
import { GraphEngine } from '../src/layers/L4-semantic/GraphEngine.js';
import { BM25Engine } from '../src/layers/L4-semantic/BM25Engine.js';
import { BackgroundIndexer } from '../src/layers/L4-semantic/BackgroundIndexer.js';
import { SemanticDatabase } from '../src/layers/L4-semantic/SemanticDatabase.js';
import { PipelineOrchestrator } from '../src/layers/L3-pipeline/PipelineOrchestrator.js';
import { LLMAdapter } from '../src/layers/L6-ai-core/LLMAdapter.js';
import { MockLLMProvider } from './e2e/mock-llm.js';
import { generateSyntheticVault, cleanupVault } from './performance/synthetic.js';
import { promises as fs } from 'fs';

describe('PipelineOrchestrator', () => {
  it('runCompile rolls back written concepts on partial failure (C3)', async () => {
    const vaultPath = `./tests/performance/.perf-pipeline-rollback-${Date.now()}`;
    await generateSyntheticVault(vaultPath, { noteCount: 10, linksPerNote: 2, wordsPerNote: 50 });

    const vault = new VaultManager(vaultPath);
    const graph = new GraphEngine();
    const bm25 = new BM25Engine();
    const semanticDb = new SemanticDatabase(vaultPath);
    await semanticDb.initSchema();
    const indexer = new BackgroundIndexer(vault, graph, bm25, undefined, undefined, semanticDb);

    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(new MockLLMProvider());
    const pipeline = new PipelineOrchestrator(vault, graph, bm25, indexer, adapter);

    // Mock compileAgent to return multiple new concepts
    const originalExecute = pipeline['compileAgent'].execute.bind(pipeline['compileAgent']);
    pipeline['compileAgent'].execute = async (args: unknown) => {
      const result = await originalExecute(args);
      (result as { data: { newConcepts: Array<{ file: string; content: string; title: string; domain: string }> } }).data.newConcepts = [
        { file: 'concepts/c1.md', content: '# C1', title: 'C1', domain: 'test' },
        { file: 'concepts/c2.md', content: '# C2', title: 'C2', domain: 'test' },
        { file: 'concepts/c3.md', content: '# C3', title: 'C3', domain: 'test' },
      ];
      return result;
    };

    // Spy on writeNote to fail on 2nd concept
    let writeCount = 0;
    const originalWrite = vault.writeNote.bind(vault);
    vi.spyOn(vault, 'writeNote').mockImplementation(async (filePath, content, opts) => {
      if (typeof filePath === 'string' && filePath.startsWith('concepts/')) {
        writeCount++;
        if (writeCount === 2) {
          throw new Error('Simulated write failure');
        }
      }
      return originalWrite(filePath, content, opts);
    });

    await expect(pipeline.runCompile(365)).rejects.toThrow('Pipeline compile failed after writing 1 concepts');

    // Verify rollback: no concepts should exist
    let c1Exists = false;
    let c2Exists = false;
    let c3Exists = false;
    try { await fs.access(`${vaultPath}/concepts/c1.md`); c1Exists = true; } catch { /* */ }
    try { await fs.access(`${vaultPath}/concepts/c2.md`); c2Exists = true; } catch { /* */ }
    try { await fs.access(`${vaultPath}/concepts/c3.md`); c3Exists = true; } catch { /* */ }
    expect(c1Exists).toBe(false);
    expect(c2Exists).toBe(false);
    expect(c3Exists).toBe(false);

    semanticDb.close();
    await cleanupVault(vaultPath);
  }, 10000);
});
