// v0.2b:
import { describe, it, expect } from 'vitest';
import { BM25Engine } from '../src/layers/L4-semantic/BM25Engine.js';

describe('BM25Engine', () => {
  it('indexes and searches docs', () => {
    const engine = new BM25Engine();
    engine.addDoc('1', 'the quick brown fox');
    engine.addDoc('2', 'the lazy dog');
    const results = engine.search('fox');
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('1');
  });

  it('ranks multiple matches', () => {
    const engine = new BM25Engine();
    engine.addDoc('a', 'machine learning is great');
    engine.addDoc('b', 'machine learning and deep learning');
    engine.addDoc('c', 'something else');
    const results = engine.search('machine learning');
    expect(results.length).toBe(2);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('removes docs', () => {
    const engine = new BM25Engine();
    engine.addDoc('1', 'hello world');
    engine.removeDoc('1');
    const results = engine.search('hello');
    expect(results.length).toBe(0);
  });

  it('handles 1000 docs', () => {
    const engine = new BM25Engine();
    for (let i = 0; i < 1000; i++) {
      engine.addDoc(String(i), `doc ${i} content about topic ${i % 100}`);
    }
    const results = engine.search('topic 42');
    expect(results.length).toBeGreaterThan(0);
  });
});
