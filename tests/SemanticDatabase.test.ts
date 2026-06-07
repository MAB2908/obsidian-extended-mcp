// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticDatabase } from '../src/layers/L4-semantic/SemanticDatabase.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('SemanticDatabase', () => {
  let tmpDir: string;
  let db: SemanticDatabase;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-'));
    db = new SemanticDatabase(tmpDir);
    await db.initSchema();
  });

  afterEach(async () => {
    db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('upserts and gets a node', () => {
    db.upsertNode({ path: 'a.md', title: 'A', contentHash: 'abc', wordCount: 100 });
    const node = db.getNode('a.md');
    expect(node).toBeDefined();
    expect(node!.title).toBe('A');
    expect(node!.contentHash).toBe('abc');
  });

  it('updates node on conflict', () => {
    db.upsertNode({ path: 'a.md', title: 'A', contentHash: 'abc', wordCount: 100 });
    db.upsertNode({ path: 'a.md', title: 'A2', contentHash: 'def', wordCount: 200 });
    const node = db.getNode('a.md');
    expect(node!.title).toBe('A2');
    expect(node!.wordCount).toBe(200);
  });

  it('deletes node', () => {
    db.upsertNode({ path: 'a.md', title: 'A', contentHash: 'abc', wordCount: 100 });
    db.deleteNode('a.md');
    expect(db.getNode('a.md')).toBeUndefined();
  });

  it('upserts edges', () => {
    db.upsertEdge({ fromPath: 'a.md', toPath: 'b.md', type: 'wikilink' });
    db.upsertEdge({ fromPath: 'a.md', toPath: 'c.md', type: 'implicit', context: 'see also' });
    const edges = db.getEdges('a.md');
    expect(edges).toHaveLength(2);
    expect(edges[0].type).toBe('wikilink');
  });

  it('deletes edges from node', () => {
    db.upsertEdge({ fromPath: 'a.md', toPath: 'b.md', type: 'wikilink' });
    db.deleteEdgesFrom('a.md');
    expect(db.getEdges('a.md')).toHaveLength(0);
  });

  it('upserts chunks and returns id', () => {
    const id = db.upsertChunk({ nodePath: 'a.md', chunkIndex: 0, heading: 'Intro', content: 'Hello world', tokenCount: 2 });
    expect(id).toBeGreaterThan(0);
    const chunks = db.getChunks('a.md');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe('Intro');
  });

  it('upserts embeddings', () => {
    const chunkId = db.upsertChunk({ nodePath: 'a.md', chunkIndex: 0, content: 'Hello' });
    db.upsertEmbedding({ chunkId, model: 'test', vector: new Float32Array([1, 0, 0]), dimensions: 3 });
    const stats = db.getStats();
    expect(stats.embeddings).toBe(1);
  });

  it('searches FTS', () => {
    db.upsertNode({ path: 'a.md', title: 'Attention', contentHash: 'x', wordCount: 10 });
    db.updateFTSContent('a.md', 'Attention mechanism is all you need');
    const results = db.searchFTS('attention');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('a.md');
  });

  it('searches similar embeddings', () => {
    const c1 = db.upsertChunk({ nodePath: 'a.md', chunkIndex: 0, content: 'hello' });
    const c2 = db.upsertChunk({ nodePath: 'b.md', chunkIndex: 0, content: 'world' });
    db.upsertEmbedding({ chunkId: c1, model: 'm', vector: new Float32Array([1, 0, 0]), dimensions: 3 });
    db.upsertEmbedding({ chunkId: c2, model: 'm', vector: new Float32Array([0, 1, 0]), dimensions: 3 });
    const results = db.searchSimilar(new Float32Array([1, 0, 0]), 'm', 2);
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe('a.md');
    expect(results[0].score).toBeCloseTo(1, 5);
  });

  it('returns stats', () => {
    db.upsertNode({ path: 'a.md', title: 'A', contentHash: 'x', wordCount: 10 });
    db.upsertEdge({ fromPath: 'a.md', toPath: 'b.md', type: 'wikilink' });
    db.upsertChunk({ nodePath: 'a.md', chunkIndex: 0, content: 'hello' });
    const stats = db.getStats();
    expect(stats.nodes).toBe(1);
    expect(stats.edges).toBe(1);
    expect(stats.chunks).toBe(1);
    expect(stats.embeddings).toBe(0);
  });
});
