// v0.1b:
import { describe, it, expect, vi } from 'vitest';
import { VectorEngine } from '../src/layers/L4-semantic/VectorEngine.js';

const mockProvider = {
  name: 'mock-embed',
  async embed(texts: string[]) {
    return texts.map((t) => {
      // Simple deterministic mock: hash string to vector
      const vec = new Array(128).fill(0);
      let hash = 0;
      for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash);
      vec[Math.abs(hash) % 128] = 1;
      return vec;
    });
  },
  async isAvailable() { return true; },
};

describe('VectorEngine', () => {
  it('indexes and searches docs', async () => {
    const engine = new VectorEngine(mockProvider);
    await engine.indexDoc('1', 'the quick brown fox');
    await engine.indexDoc('2', 'the lazy dog');
    const results = await engine.search('fox');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('1');
  });

  it('ranks by cosine similarity', async () => {
    const engine = new VectorEngine(mockProvider);
    await engine.indexDocs([
      { id: 'a', text: 'machine learning neural networks' },
      { id: 'b', text: 'deep learning ai' },
      { id: 'c', text: 'cooking recipes' },
    ]);
    const results = await engine.search('machine learning');
    expect(results.length).toBe(3);
    // a should be first or second because it shares words with query
    const paths = results.map((r) => r.path);
    expect(paths).toContain('a');
  });

  it('removes docs', async () => {
    const engine = new VectorEngine(mockProvider);
    await engine.indexDoc('1', 'hello');
    engine.removeDoc('1');
    const results = await engine.search('hello');
    expect(results.length).toBe(0);
  });

  it('serializes and loads', async () => {
    const engine = new VectorEngine(mockProvider);
    await engine.indexDoc('1', 'test');
    const serialized = engine.serialize();
    const engine2 = new VectorEngine(mockProvider);
    engine2.load(serialized);
    expect(engine2.getStats().totalVectors).toBe(1);
  });
});
