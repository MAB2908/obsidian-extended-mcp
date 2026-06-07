// v0.2b:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DevSystemEngine } from '../src/layers/L7-dev-system/DevSystemEngine.js';
import { VaultManager } from '../src/layers/L1-filesystem/VaultManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

async function createTempVault(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-devsystem-'));
  return dir;
}

describe('DevSystemEngine', () => {
  let vaultDir: string;
  let vault: VaultManager;
  let engine: DevSystemEngine;

  beforeEach(async () => {
    vaultDir = await createTempVault();
    vault = new VaultManager(vaultDir);
    engine = new DevSystemEngine(vault);
    await engine.initialize();
  });

  afterEach(async () => {
    await fs.rm(vaultDir, { recursive: true, force: true });
  });

  // ─── L1: Prompts ───

  it('creates and retrieves a prompt', async () => {
    const prompt = await engine.createPrompt({
      name: 'Test Prompt',
      role: 'Tester',
      context: 'Testing context',
      task: 'Run tests',
      acceptanceCriteria: ['All green'],
      variables: ['name'],
    });
    expect(prompt.id).toBeDefined();
    expect(prompt.name).toBe('Test Prompt');

    const retrieved = await engine.getPrompt(prompt.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('Test Prompt');
    expect(retrieved!.acceptanceCriteria).toContain('All green');
  });

  it('lists prompts', async () => {
    await engine.createPrompt({
      name: 'P1', role: 'R', context: 'C', task: 'T', acceptanceCriteria: ['A'], variables: [],
    });
    await engine.createPrompt({
      name: 'P2', role: 'R', context: 'C', task: 'T', acceptanceCriteria: ['A'], variables: [],
    });
    const list = await engine.listPrompts();
    expect(list.length).toBe(2);
  });

  it('deletes a prompt', async () => {
    const prompt = await engine.createPrompt({
      name: 'ToDelete', role: 'R', context: 'C', task: 'T', acceptanceCriteria: ['A'], variables: [],
    });
    const ok = await engine.deletePrompt(prompt.id);
    expect(ok).toBe(true);
    expect(await engine.getPrompt(prompt.id)).toBeNull();
  });

  it('executes a prompt with variable substitution', async () => {
    const prompt = await engine.createPrompt({
      name: 'Exec',
      role: 'Developer',
      context: 'Project: {project}',
      task: 'Fix bug in {module}',
      acceptanceCriteria: ['CI passes'],
      variables: ['project', 'module'],
    });
    const rendered = engine.executePrompt(prompt, { project: 'MyApp', module: 'auth' });
    expect(rendered).toContain('Project: MyApp');
    expect(rendered).toContain('Fix bug in auth');
  });

  // ─── L2: Skills ───

  it('creates and retrieves a skill', async () => {
    const skill = await engine.createSkill({
      name: 'Commit Skill',
      description: 'How to commit',
      permissions: [{ command: 'git commit', action: 'pre-approved' }],
      preconditions: ['Changes staged'],
      steps: ['git add .', 'git commit -m "{msg}"'],
      postconditions: ['Commit created'],
      examples: [{ scenario: 'Normal', input: 'msg=fix', expected: 'commit created' }],
      errorHandling: [{ error: 'nothing to commit', fix: 'stage files first' }],
    });
    expect(skill.id).toBeDefined();

    const retrieved = await engine.getSkill(skill.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.steps).toContain('git add .');
  });

  it('executes a skill', async () => {
    const skill = await engine.createSkill({
      name: 'Test Skill',
      description: 'D',
      permissions: [],
      preconditions: ['P'],
      steps: ['Step 1: {action}'],
      postconditions: ['Done'],
      examples: [],
      errorHandling: [],
    });
    const rendered = engine.executeSkill(skill, { action: 'run' });
    expect(rendered).toContain('Step 1: run');
  });

  // ─── L3: Agents ───

  it('creates and retrieves an agent', async () => {
    const agent = await engine.createAgent({
      name: 'Code Reviewer',
      role: 'Review code',
      tools: ['read', 'grep', 'diff'],
      constraints: ['No writes'],
      systemPrompt: 'You are a code reviewer.',
      complexity: 'medium',
    });
    expect(agent.id).toBeDefined();

    const retrieved = await engine.getAgent(agent.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.constraints).toContain('No writes');
  });

  // ─── L4: Workflows ───

  it('creates and advances a workflow', async () => {
    const workflow = await engine.createWorkflow({
      name: 'Feature Workflow',
      description: 'Build a feature',
      phases: [
        { phase: 'spec', agents: ['architect'], artifact: 'spec.md', exitCriteria: 'Approved', status: 'pending' },
        { phase: 'draft', agents: ['coder'], artifact: 'code.ts', exitCriteria: 'CI green', status: 'pending' },
      ],
    });
    expect(workflow.status).toBe('pending');
    expect(workflow.currentPhase).toBe(0);

    const advanced = await engine.advanceWorkflowPhase(workflow.id);
    expect(advanced).not.toBeNull();
    expect(advanced!.currentPhase).toBe(1);
    expect(advanced!.phases[0].status).toBe('completed');
    expect(advanced!.phases[1].status).toBe('running');

    const completed = await engine.advanceWorkflowPhase(workflow.id);
    expect(completed!.status).toBe('completed');
  });

  it('fails a workflow phase', async () => {
    const workflow = await engine.createWorkflow({
      name: 'Failing Workflow',
      description: 'D',
      phases: [
        { phase: 'spec', agents: ['a'], artifact: 'x', exitCriteria: 'ok', status: 'pending' },
      ],
    });
    const failed = await engine.failWorkflowPhase(workflow.id, 'Requirements unclear');
    expect(failed!.status).toBe('failed');
    expect(failed!.phases[0].status).toBe('failed');
  });

  // ─── CLAUDE.md ───

  it('appends and retrieves CLAUDE.md', async () => {
    await engine.appendClaudeMd('Architecture', 'Use hexagonal architecture.');
    await engine.appendClaudeMd('Style', 'Use strict TypeScript.');
    const content = await engine.getClaudeMd();
    expect(content).toContain('Architecture');
    expect(content).toContain('hexagonal architecture');
    expect(content).toContain('strict TypeScript');
  });

  it('executePrompt escapes regex special chars in variable keys (V-005)', () => {
    const prompt = {
      id: 'p1',
      name: 'Test',
      role: 'r',
      context: 'ctx',
      task: 'task',
      acceptanceCriteria: [],
      variables: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    // Without escaping, key '.' would match any char inside braces: {a}→replaced
    const result = engine.executePrompt(prompt, { '.': 'BAD' });
    // Default template has no {var} placeholders, so nothing is replaced
    expect(result).not.toContain('BAD');
    // Template with a literal placeholder — '.' must NOT match it
    const templateWithPlaceholder = engine.executePrompt({ ...prompt, task: 'do {X} and {Y}' }, { '.': 'BAD' });
    expect(templateWithPlaceholder).toContain('{X}');
    expect(templateWithPlaceholder).toContain('{Y}');
    expect(templateWithPlaceholder).not.toContain('BAD');
    // Valid key with regex specials should work when escaped
    const escapedResult = engine.executePrompt({ ...prompt, task: 'path is {C:\\Users}' }, { 'C:\\Users': 'ok' });
    expect(escapedResult).toContain('path is ok');
  });

  it('executeSkill escapes regex special chars in context keys (V-005)', () => {
    const skill = {
      id: 's1',
      name: 'Skill',
      description: 'desc',
      preconditions: [],
      steps: ['step'],
      postconditions: [],
      examples: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    // '.' as key without escaping would match any single char inside braces
    const result = engine.executeSkill(skill, { '.': 'BAD' });
    // Default skill template has no {var} placeholders
    expect(result).not.toContain('BAD');
    // Template with placeholders — '.' must NOT match them
    const withPlaceholder = engine.executeSkill({ ...skill, steps: ['run {cmd}', 'check {file}'] }, { '.': 'BAD' });
    expect(withPlaceholder).toContain('run {cmd}');
    expect(withPlaceholder).toContain('check {file}');
    expect(withPlaceholder).not.toContain('BAD');
    // Valid key with regex specials works when properly escaped
    const escapedResult = engine.executeSkill(
      { ...skill, steps: ['value is {test[key]}'] },
      { 'test[key]': 'replaced' }
    );
    expect(escapedResult).toContain('value is replaced');
  });
});
