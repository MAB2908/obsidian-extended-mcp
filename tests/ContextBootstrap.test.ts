// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { ContextBootstrap } from '../src/layers/L5-bootstrap/ContextBootstrap.js';

const TEST_VAULT = path.resolve('./test-vault-bootstrap');

describe('ContextBootstrap', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_VAULT, { recursive: true });
    await fs.mkdir(path.join(TEST_VAULT, 'meta'), { recursive: true });
    await fs.mkdir(path.join(TEST_VAULT, 'concepts'), { recursive: true });
    await fs.writeFile(path.join(TEST_VAULT, 'meta', 'ontology.md'), '# Ontology\n\n- #concept\n- #source', 'utf-8');
    await fs.writeFile(path.join(TEST_VAULT, 'meta', 'protocol.md'), '# Protocol\n\n1. Ingest\n2. Compile', 'utf-8');
    await fs.writeFile(path.join(TEST_VAULT, 'meta', 'link-rules.md'), '# Link Rules\n\nUse [[wikilinks]]', 'utf-8');
    await fs.writeFile(path.join(TEST_VAULT, 'concepts', 'idea.md'), '# Idea\n\nContent', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(TEST_VAULT, { recursive: true, force: true });
  });

  it('generates prompt with vault context', async () => {
    const bootstrap = new ContextBootstrap(TEST_VAULT);
    const result = await bootstrap.generatePrompt(4000);
    expect(result.prompt).toContain('Obsidian Knowledge Base Compiler');
    expect(result.prompt).toContain('#concept');
    expect(result.prompt).toContain('Ingest');
    expect(result.prompt).toContain('[[wikilinks]]');
    expect(result.prompt).toContain('concepts/');
  });

  it('includes folder structure', async () => {
    const bootstrap = new ContextBootstrap(TEST_VAULT);
    const result = await bootstrap.generatePrompt(4000);
    expect(result.prompt).toContain('concepts/');
    expect(result.prompt).toContain('idea.md');
  });

  it('estimates tokens', async () => {
    const bootstrap = new ContextBootstrap(TEST_VAULT);
    const result = await bootstrap.generatePrompt(4000);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('returns fallback when meta files missing', async () => {
    await fs.rm(path.join(TEST_VAULT, 'meta', 'ontology.md'));
    const bootstrap = new ContextBootstrap(TEST_VAULT);
    const result = await bootstrap.generatePrompt(4000);
    expect(result.prompt).toContain('No ontology defined');
  });
});
