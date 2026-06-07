// v0.2b:
import { describe, it, expect } from 'vitest';
import { TagEngine } from '../src/shared/TagEngine.js';

describe('TagEngine', () => {
  it('validates required tags by folder', () => {
    const engine = new TagEngine();
    const result = engine.validateNote('raw/article.md', [], []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required tag: source');
  });

  it('validates forbidden tags by folder', () => {
    const engine = new TagEngine();
    const result = engine.validateNote('concepts/nn.md', ['concept', 'source'], []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Forbidden tag: source');
  });

  it('passes valid note', () => {
    const engine = new TagEngine();
    const result = engine.validateNote('raw/article.md', ['source'], []);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('checks ontology when provided', () => {
    const engine = new TagEngine({ allowedTags: ['ai', 'ml'], folderRules: {} });
    const result = engine.validateNote('note.md', ['ai', 'physics'], []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Tag not in ontology: physics');
  });

  it('adds tags without duplicates', () => {
    const engine = new TagEngine();
    expect(engine.addTags(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('removes tags', () => {
    const engine = new TagEngine();
    expect(engine.removeTags(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });

  it('sets tags', () => {
    const engine = new TagEngine();
    expect(engine.setTags(['a', 'b'], ['c', 'c'])).toEqual(['c']);
  });
});

