// v0.2b:
import { describe, it, expect, vi } from 'vitest';
import { VaultManager } from '../src/layers/L1-filesystem/VaultManager.js';
import { GraphEngine } from '../src/layers/L4-semantic/GraphEngine.js';
import { BackgroundIndexer } from '../src/layers/L4-semantic/BackgroundIndexer.js';
import { SemanticDatabase } from '../src/layers/L4-semantic/SemanticDatabase.js';
import { PipelineOrchestrator } from '../src/layers/L3-pipeline/PipelineOrchestrator.js';
import { LLMAdapter } from '../src/layers/L6-ai-core/LLMAdapter.js';
import { MockLLMProvider } from './e2e/mock-llm.js';
import { generateSyntheticVault, cleanupVault } from './performance/synthetic.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('PipelineOrchestrator', () => {
  it('runCompile rolls back written concepts on partial failure (C3)', async () => {
    const vaultPath = `./tests/performance/.perf-pipeline-rollback-${Date.now()}`;
    await generateSyntheticVault(vaultPath, { noteCount: 10, linksPerNote: 2, wordsPerNote: 50 });

    const vault = new VaultManager(vaultPath);
    const graph = new GraphEngine();
    const semanticDb = new SemanticDatabase(vaultPath);
    await semanticDb.initSchema();
    const indexer = new BackgroundIndexer(vault, graph, undefined, undefined, semanticDb);

    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(new MockLLMProvider());
    const pipeline = new PipelineOrchestrator(vault, graph, semanticDb, indexer, adapter);

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

  it('runLink replaces all occurrences and skips text inside existing wikilinks', async () => {
    const vaultPath = `./tests/.pipeline-link-${Date.now()}`;
    await fs.mkdir(vaultPath, { recursive: true });

    const vault = new VaultManager(vaultPath);
    await vault.writeNote('target.md', '# Target\ncontent');
    await vault.writeNote(
      'source.md',
      'Mention Target here and Target again. Also see [[Target|alias]] and [[Other]].'
    );

    const graph = new GraphEngine();
    const semanticDb = new SemanticDatabase(vaultPath);
    await semanticDb.initSchema();
    const indexer = new BackgroundIndexer(vault, graph, undefined, undefined, semanticDb);
    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(new MockLLMProvider());
    const pipeline = new PipelineOrchestrator(vault, graph, semanticDb, indexer, adapter);

    pipeline['linkAgent'].execute = async () => ({
      data: {
        suggestions: [{ phrase: 'Target', target: 'Target', confidence: 0.9 }],
      },
      confidence: 0.9,
      reasoning: 'mock',
    }) as any;

    await pipeline.runLink('source.md');
    const note = await vault.readNote('source.md');
    expect(note.content).toBe(
      'Mention [[Target|Target]] here and [[Target|Target]] again. Also see [[Target|alias]] and [[Other]].'
    );

    semanticDb.close();
    await fs.rm(vaultPath, { recursive: true, force: true });
  });

  it('runLint detects invalid tags from meta/ontology.md', async () => {
    const vaultPath = `./tests/.pipeline-lint-${Date.now()}`;
    await fs.mkdir(path.join(vaultPath, 'meta'), { recursive: true });

    const vault = new VaultManager(vaultPath);
    await vault.writeNote('meta/ontology.md', '# Ontology\n\n- #concept\n- #source');
    await vault.writeNote('note.md', '# Note\n', { frontmatter: { tags: ['concept', 'bad-tag'] } });

    const graph = new GraphEngine();
    const semanticDb = new SemanticDatabase(vaultPath);
    await semanticDb.initSchema();
    const indexer = new BackgroundIndexer(vault, graph, undefined, undefined, semanticDb);
    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(new MockLLMProvider());
    const pipeline = new PipelineOrchestrator(vault, graph, semanticDb, indexer, adapter);

    pipeline['lintAgent'].execute = async (input: any) => ({
      data: {},
      confidence: 0.9,
      reasoning: 'mock',
    }) as any;

    const result = (await pipeline.runLint()) as { data: { invalidTags: Array<{ tag: string; file: string }> } };
    expect(result.data.invalidTags).toEqual([{ tag: 'bad-tag', file: 'note.md' }]);

    semanticDb.close();
    await fs.rm(vaultPath, { recursive: true, force: true });
  });

  it('runLint skips invalidTags check when no ontology exists', async () => {
    const vaultPath = `./tests/.pipeline-lint-none-${Date.now()}`;
    await fs.mkdir(vaultPath, { recursive: true });

    const vault = new VaultManager(vaultPath);
    await vault.writeNote('note.md', '# Note\n', { frontmatter: { tags: ['anything'] } });

    const graph = new GraphEngine();
    const semanticDb = new SemanticDatabase(vaultPath);
    await semanticDb.initSchema();
    const indexer = new BackgroundIndexer(vault, graph, undefined, undefined, semanticDb);
    const adapter = new LLMAdapter('mock');
    adapter.registerProvider(new MockLLMProvider());
    const pipeline = new PipelineOrchestrator(vault, graph, semanticDb, indexer, adapter);

    pipeline['lintAgent'].execute = async (input: any) => ({
      data: {},
      confidence: 0.9,
      reasoning: 'mock',
    }) as any;

    const result = (await pipeline.runLint()) as { data: { invalidTags: Array<{ tag: string; file: string }> } };
    expect(result.data.invalidTags).toEqual([]);

    semanticDb.close();
    await fs.rm(vaultPath, { recursive: true, force: true });
  });
});
