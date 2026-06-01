// v0.1b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { ModelAwareBackupService } from '../src/shared/ModelAwareBackupService.js';
import type { DevPrompt, DevSkill, DevAgent } from '../src/shared/types.js';

const TEST_VAULT = path.resolve('./tests/fixtures/mabs-test-vault');

async function cleanDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

describe('ModelAwareBackupService', () => {
  let mabs: ModelAwareBackupService;

  beforeEach(async () => {
    await cleanDir(TEST_VAULT);
    await fs.mkdir(TEST_VAULT, { recursive: true });
    mabs = new ModelAwareBackupService(TEST_VAULT, { compress: false });
    await mabs.initialize();
  });

  afterEach(async () => {
    await cleanDir(TEST_VAULT);
  });

  describe('Model Profiles', () => {
    it('registers a model profile', async () => {
      const profile = await mabs.registerModelProfile({
        provider: 'openai',
        model: 'gpt-4o',
        label: 'OpenAI GPT-4o',
        capabilities: ['chat', 'vision'],
        parameters: { temperature: 0.7 },
      });
      expect(profile.id).toBe('model-openai/gpt-4o');
      expect(profile.provider).toBe('openai');
      expect(profile.capabilities).toContain('vision');
    });

    it('sets and gets current model', async () => {
      const profile = await mabs.registerModelProfile({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        label: 'Claude Sonnet',
        capabilities: ['chat'],
        parameters: {},
      });
      mabs.setCurrentModel(profile.id);
      const current = mabs.getCurrentModel();
      expect(current?.id).toBe(profile.id);
    });

    it('lists models sorted by lastUsed', async () => {
      const p1 = await mabs.registerModelProfile({ provider: 'openai', model: 'gpt-4o', label: 'A', capabilities: ['chat'], parameters: {} });
      await new Promise((r) => setTimeout(r, 10));
      const p2 = await mabs.registerModelProfile({ provider: 'anthropic', model: 'claude-3', label: 'B', capabilities: ['chat'], parameters: {} });
      const list = mabs.listModels();
      expect(list[0].id).toBe(p2.id);
      expect(list[1].id).toBe(p1.id);
    });
  });

  describe('Artifact Snapshots', () => {
    beforeEach(async () => {
      const profile = await mabs.registerModelProfile({
        provider: 'openai',
        model: 'gpt-4o',
        label: 'Test Model',
        capabilities: ['chat'],
        parameters: {},
      });
      mabs.setCurrentModel(profile.id);
    });

    it('snapshots a prompt and returns content hash', async () => {
      const prompt: DevPrompt = {
        id: 'prompt-1',
        name: 'Test Prompt',
        role: 'tester',
        context: 'ctx',
        task: 'task',
        acceptanceCriteria: ['a1'],
        variables: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      const hash = await mabs.snapshotPrompt(prompt, { modelAgnostic: true });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      const history = await mabs.getArtifactHistory('prompt-1');
      expect(history).toHaveLength(1);
      expect(history[0].artifactId).toBe('prompt-1');
      expect(history[0].modelAgnostic).toBe(true);
    });

    it('snapshots a skill', async () => {
      const skill: DevSkill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'desc',
        permissions: [],
        preconditions: [],
        steps: ['s1'],
        postconditions: [],
        examples: [],
        errorHandling: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      const hash = await mabs.snapshotSkill(skill);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('snapshots an agent', async () => {
      const agent: DevAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        role: 'helper',
        tools: ['read_note'],
        constraints: [],
        systemPrompt: 'Be helpful',
        complexity: 'medium',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      const hash = await mabs.snapshotAgent(agent);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('creates versioning chain with parentHash', async () => {
      const prompt: DevPrompt = {
        id: 'prompt-versioned',
        name: 'V1',
        role: 'r',
        context: 'c',
        task: 't',
        acceptanceCriteria: [],
        variables: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      const h1 = await mabs.snapshotPrompt(prompt, { message: 'v1' });
      const updated: DevPrompt = { ...prompt, name: 'V2', updated: new Date().toISOString() };
      const h2 = await mabs.snapshotPrompt(updated, { message: 'v2' });

      const history = await mabs.getArtifactHistory('prompt-versioned');
      expect(history).toHaveLength(2);
      // history is sorted desc (newest first)
      expect(history[0].hash).toBe(h2);
      expect(history[0].parentHash).toBe(h1);
      expect(history[1].hash).toBe(h1);
      expect(history[1].parentHash).toBeUndefined();
    });

    it('reads artifact content by hash', async () => {
      const prompt: DevPrompt = {
        id: 'prompt-read',
        name: 'Readable',
        role: 'r',
        context: 'c',
        task: 't',
        acceptanceCriteria: [],
        variables: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      const hash = await mabs.snapshotPrompt(prompt);
      const content = await mabs.readArtifact(hash);
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('Readable');
    });

    it('lists agnostic artifacts', async () => {
      const promptAgnostic: DevPrompt = {
        id: 'p-agnostic', name: 'Agnostic', role: 'r', context: 'c', task: 't',
        acceptanceCriteria: [], variables: [], created: new Date().toISOString(), updated: new Date().toISOString(),
      };
      const promptBound: DevPrompt = {
        id: 'p-bound', name: 'Bound', role: 'r', context: 'c', task: 't',
        acceptanceCriteria: [], variables: [], created: new Date().toISOString(), updated: new Date().toISOString(),
      };
      await mabs.snapshotPrompt(promptAgnostic, { modelAgnostic: true });
      await mabs.snapshotPrompt(promptBound, { modelAgnostic: false });

      const agnostic = await mabs.listAgnosticArtifacts();
      expect(agnostic.some((a) => a.artifactId === 'p-agnostic')).toBe(true);
      expect(agnostic.some((a) => a.artifactId === 'p-bound')).toBe(false);
    });

    it('imports artifact across models', async () => {
      const prompt: DevPrompt = {
        id: 'p-portable', name: 'Portable', role: 'r', context: 'c', task: 't',
        acceptanceCriteria: [], variables: [], created: new Date().toISOString(), updated: new Date().toISOString(),
      };
      const hash = await mabs.snapshotPrompt(prompt, { modelAgnostic: true });

      const p2 = await mabs.registerModelProfile({ provider: 'anthropic', model: 'claude', label: 'C', capabilities: ['chat'], parameters: {} });
      mabs.setCurrentModel(p2.id);
      const importedHash = await mabs.importArtifact(hash);
      expect(importedHash).toMatch(/^[a-f0-9]{64}$/);

      const modelArts = await mabs.listModelArtifacts(p2.id);
      expect(modelArts.some((a) => a.artifactId === 'p-portable')).toBe(true);
    });
  });

  describe('Session Context Snapshots', () => {
    beforeEach(async () => {
      const profile = await mabs.registerModelProfile({
        provider: 'openai', model: 'gpt-4o', label: 'T', capabilities: ['chat'], parameters: {},
      });
      mabs.setCurrentModel(profile.id);
    });

    it('snapshots and retrieves session context', async () => {
      const sess = await mabs.snapshotSessionContext('dreaming', { topicCount: 5 }, { userIntent: 'clean vault', replayable: true });
      expect(sess.id).toMatch(/^sess-/);
      expect(sess.modelProfileId).toBe('model-openai/gpt-4o');
      expect(sess.userIntent).toBe('clean vault');

      const history = await mabs.getSessionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(sess.id);
    });

    it('prunes old sessions per model', async () => {
      mabs = new ModelAwareBackupService(TEST_VAULT, { compress: false, maxModelBackups: 2 });
      await mabs.initialize();
      const profile = await mabs.registerModelProfile({
        provider: 'openai', model: 'gpt-4o', label: 'T', capabilities: ['chat'], parameters: {},
      });
      mabs.setCurrentModel(profile.id);

      await mabs.snapshotSessionContext('t1', {});
      await mabs.snapshotSessionContext('t2', {});
      await mabs.snapshotSessionContext('t3', {});

      const history = await mabs.getSessionHistory();
      expect(history.length).toBeLessThanOrEqual(2);
    });

    it('checks replay compatibility', async () => {
      const sess = await mabs.snapshotSessionContext('pipeline', {}, { replayable: true });
      const p2 = await mabs.registerModelProfile({ provider: 'ollama', model: 'llama3', label: 'L', capabilities: ['chat'], parameters: {} });
      const result = await mabs.canReplaySession(sess.id, p2.id);
      expect(result.canReplay).toBe(true);
    });

    it('blocks replay for non-replayable sessions', async () => {
      const sess = await mabs.snapshotSessionContext('interactive', {}, { replayable: false });
      const result = await mabs.canReplaySession(sess.id, 'model-openai/gpt-4o');
      expect(result.canReplay).toBe(false);
    });
  });

  describe('Backup Export / Import', () => {
    beforeEach(async () => {
      const profile = await mabs.registerModelProfile({
        provider: 'openai', model: 'gpt-4o', label: 'T', capabilities: ['chat'], parameters: {},
      });
      mabs.setCurrentModel(profile.id);
    });

    it('exports and imports backup manifest', async () => {
      const prompt: DevPrompt = {
        id: 'p-backup', name: 'Backup Prompt', role: 'r', context: 'c', task: 't',
        acceptanceCriteria: [], variables: [], created: new Date().toISOString(), updated: new Date().toISOString(),
      };
      await mabs.snapshotPrompt(prompt, { modelAgnostic: true });
      await mabs.snapshotSessionContext('test', { key: 'value' });

      const exported = await mabs.exportBackup();
      expect(exported.models).toHaveLength(1);
      expect(exported.artifacts).toHaveLength(1);
      expect(exported.sessions).toHaveLength(1);

      // Clear and re-import
      const mabs2 = new ModelAwareBackupService(path.join(TEST_VAULT, 'second'), { compress: false });
      await mabs2.initialize();
      await mabs2.importBackup(exported);

      const importedModels = mabs2.listModels();
      expect(importedModels).toHaveLength(1);
      const importedArts = await mabs2.listAgnosticArtifacts();
      expect(importedArts).toHaveLength(1);
    });

    it('exports agnostic bundle', async () => {
      const prompt: DevPrompt = {
        id: 'p-bundle', name: 'Bundle', role: 'r', context: 'c', task: 't',
        acceptanceCriteria: [], variables: [], created: new Date().toISOString(), updated: new Date().toISOString(),
      };
      await mabs.snapshotPrompt(prompt, { modelAgnostic: true });
      const bundle = await mabs.exportAgnosticBundle();
      const parsed = JSON.parse(bundle);
      expect(parsed.artifacts).toHaveLength(1);
      expect(parsed.artifacts[0].content).toContain('Bundle');
    });

    it('imports agnostic bundle', async () => {
      const prompt: DevPrompt = {
        id: 'p-import', name: 'ImportMe', role: 'r', context: 'c', task: 't',
        acceptanceCriteria: [], variables: [], created: new Date().toISOString(), updated: new Date().toISOString(),
      };
      await mabs.snapshotPrompt(prompt, { modelAgnostic: true });
      const bundle = await mabs.exportAgnosticBundle();

      const mabs2 = new ModelAwareBackupService(path.join(TEST_VAULT, 'third'), { compress: false });
      await mabs2.initialize();
      const imported = await mabs2.importAgnosticBundle(bundle);
      expect(imported).toBe(1);
      const arts = await mabs2.listAgnosticArtifacts();
      expect(arts.some((a) => a.artifactId === 'p-import')).toBe(true);
    });
  });

  describe('CoGit-style Refs', () => {
    it('writes and reads refs', async () => {
      await mabs.writeRef('heads/main', 'abc123');
      const val = await mabs.readRef('heads/main');
      expect(val).toBe('abc123');
    });

    it('lists refs with prefix', async () => {
      await mabs.writeRef('artifacts/prompt-1', 'hash1');
      await mabs.writeRef('artifacts/prompt-2', 'hash2');
      const refs = await mabs.listRefs('artifacts/');
      expect(Object.keys(refs)).toHaveLength(2);
    });
  });

  describe('C2 — Concurrent manifest writes', () => {
    beforeEach(async () => {
      const profile = await mabs.registerModelProfile({
        provider: 'openai',
        model: 'gpt-4o',
        label: 'Concurrent Model',
        capabilities: ['chat'],
        parameters: {},
      });
      mabs.setCurrentModel(profile.id);
    });

    it('concurrent snapshotPrompt calls do not lose artifacts', async () => {
      const prompts: DevPrompt[] = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-prompt-${i}`,
        name: `Prompt ${i}`,
        role: 'tester',
        context: 'ctx',
        task: 'task',
        acceptanceCriteria: [],
        variables: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }));

      await Promise.all(prompts.map((p) => mabs.snapshotPrompt(p, { modelAgnostic: true })));

      const manifestPath = path.join(TEST_VAULT, '.mcp-cache', 'backups', 'mabs', 'manifest.json');
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      expect(manifest.artifacts.length).toBe(10);
      const ids = new Set(manifest.artifacts.map((a: { artifactId: string }) => a.artifactId));
      expect(ids.size).toBe(10);
    });
  });

  describe('Security', () => {
    it('rejects path traversal in refName (sanitizeRefName)', async () => {
      await expect(mabs.writeRef('../../../etc/passwd', 'hash')).rejects.toThrow('Invalid ref name');
      await expect(mabs.writeRef('..\\..\\windows\\system32', 'hash')).rejects.toThrow('Invalid ref name');
    });

    it('rejects absolute path in refName', async () => {
      await expect(mabs.writeRef('/etc/passwd', 'hash')).rejects.toThrow('Invalid ref name');
    });

    it('allows valid refName', async () => {
      await mabs.writeRef('valid-ref', 'abc123');
      const result = await mabs.readRef('valid-ref');
      expect(result).toBe('abc123');
    });
  });
});
