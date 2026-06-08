// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import type {
  DevPrompt,
  DevSkill,
  DevAgent,
  DevWorkflow,
  WorkflowPhase,
  DevSystemConfig,
} from '../../shared/types.js';
import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import { ModelAwareBackupService } from '../../shared/ModelAwareBackupService.js';
import { FileNotFoundError } from '../../shared/errors.js';

const DEFAULT_CONFIG: DevSystemConfig = {
  promptsFolder: '.mcp-cache/dev-system/prompts',
  skillsFolder: '.mcp-cache/dev-system/skills',
  agentsFolder: '.mcp-cache/dev-system/agents',
  workflowsFolder: '.mcp-cache/dev-system/workflows',
  claudeMdPath: '.mcp-cache/dev-system/CLAUDE.md',
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 4-Level Dev System Engine.
 *
 * Manages Prompts (L1), Skills (L2), Agents (L3), and Workflows (L4)
 * as structured notes inside the Obsidian vault.
 */
export class DevSystemEngine {
  private config: DevSystemConfig;
  private mabs?: ModelAwareBackupService;

  constructor(
    private vault: IVaultManager,
    config?: Partial<DevSystemConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Attach Model-Aware Backup Service for automatic artifact versioning */
  attachBackupService(mabs: ModelAwareBackupService): void {
    this.mabs = mabs;
  }

  // ─── Lifecycle ───

  async initialize(): Promise<void> {
    const folders = [
      this.config.promptsFolder,
      this.config.skillsFolder,
      this.config.agentsFolder,
      this.config.workflowsFolder,
    ];
    for (const f of folders) {
      await fs.mkdir(path.join(this.vault.root, f), { recursive: true });
    }
  }

  // ─── L1: Prompts ───

  async createPrompt(data: Omit<DevPrompt, 'id' | 'created' | 'updated'>): Promise<DevPrompt> {
    const prompt: DevPrompt = {
      ...data,
      id: generateId('prompt'),
      created: nowIso(),
      updated: nowIso(),
    };
    await this.writeNote(this.config.promptsFolder, prompt.id, this.serializePrompt(prompt));
    await this.mabs?.snapshotPrompt(prompt, { message: 'Created prompt', modelAgnostic: (prompt.variables || []).length === 0 });
    return prompt;
  }

  async getPrompt(id: string): Promise<DevPrompt | null> {
    return this.readPrompt(id);
  }

  async listPrompts(): Promise<DevPrompt[]> {
    return this.listFolder(this.config.promptsFolder, (id) => this.readPrompt(id));
  }

  async updatePrompt(id: string, updates: Partial<Omit<DevPrompt, 'id' | 'created' | 'updated'>>): Promise<DevPrompt | null> {
    const existing = await this.readPrompt(id);
    if (!existing) return null;
    const updated: DevPrompt = { ...existing, ...updates, updated: nowIso() };
    await this.writeNote(this.config.promptsFolder, id, this.serializePrompt(updated));
    await this.mabs?.snapshotPrompt(updated, { message: 'Updated prompt', modelAgnostic: updated.variables.length === 0 });
    return updated;
  }

  async deletePrompt(id: string): Promise<boolean> {
    const existing = await this.readPrompt(id);
    const ok = await this.deleteNote(this.config.promptsFolder, id);
    if (ok && existing) {
      await this.mabs?.snapshotPrompt({ ...existing, updated: nowIso() }, { message: 'Deleted prompt', author: 'system', modelAgnostic: false });
    }
    return ok;
  }

  /**
   * Execute a prompt by substituting variables and returning the rendered text.
   */
  executePrompt(prompt: DevPrompt, variables: Record<string, string>): string {
    const criteria = (prompt.acceptanceCriteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n');
    let result = `[РОЛЬ]\n${prompt.role}\n\n[КОНТЕКСТ]\n${prompt.context}\n\n[ЗАДАЧА]\n${prompt.task}\n\n[КРИТЕРИИ ПРИЁМКИ]\n${criteria}`;
    if (prompt.verificationCommand) {
      result += `\n\n[ПРОВЕРКА]\n${prompt.verificationCommand}`;
    }
    for (const [key, value] of Object.entries(variables)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), value);
    }
    return result;
  }

  // ─── L2: Skills ───

  async createSkill(data: Omit<DevSkill, 'id' | 'created' | 'updated'>): Promise<DevSkill> {
    const skill: DevSkill = {
      ...data,
      id: generateId('skill'),
      created: nowIso(),
      updated: nowIso(),
    };
    await this.writeNote(this.config.skillsFolder, skill.id, this.serializeSkill(skill));
    await this.mabs?.snapshotSkill(skill, { message: 'Created skill', modelAgnostic: true });
    return skill;
  }

  async getSkill(id: string): Promise<DevSkill | null> {
    return this.readSkill(id);
  }

  async listSkills(): Promise<DevSkill[]> {
    return this.listFolder(this.config.skillsFolder, (id) => this.readSkill(id));
  }

  async updateSkill(id: string, updates: Partial<Omit<DevSkill, 'id' | 'created' | 'updated'>>): Promise<DevSkill | null> {
    const existing = await this.readSkill(id);
    if (!existing) return null;
    const updated: DevSkill = { ...existing, ...updates, updated: nowIso() };
    await this.writeNote(this.config.skillsFolder, id, this.serializeSkill(updated));
    await this.mabs?.snapshotSkill(updated, { message: 'Updated skill', modelAgnostic: true });
    return updated;
  }

  async deleteSkill(id: string): Promise<boolean> {
    const existing = await this.readSkill(id);
    const ok = await this.deleteNote(this.config.skillsFolder, id);
    if (ok && existing) {
      await this.mabs?.snapshotSkill({ ...existing, updated: nowIso() }, { message: 'Deleted skill', author: 'system', modelAgnostic: false });
    }
    return ok;
  }

  /**
   * Render a skill as an executable checklist / algorithm.
   */
  executeSkill(skill: DevSkill, context: Record<string, string>): string {
    const preconditions = (skill.preconditions || []).map((p) => `- [ ] ${p}`).join('\n');
    const steps = (skill.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
    const postconditions = (skill.postconditions || []).map((p) => `- [ ] ${p}`).join('\n');
    let result = `# ${skill.name}\n\n${skill.description}\n\n## Предусловия\n${preconditions}\n\n## Пошаговый алгоритм\n${steps}\n\n## Постусловия / Проверка\n${postconditions}`;
    const examples = skill.examples || [];
    if (examples.length > 0) {
      result += `\n\n## Примеры\n${examples.map((e) => `### ${e.scenario}\n**Вход:** ${e.input}\n**Ожидаемый результат:** ${e.expected}`).join('\n\n')}`;
    }
    for (const [key, value] of Object.entries(context)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), value);
    }
    return result;
  }

  // ─── L3: Agents ───

  async createAgent(data: Omit<DevAgent, 'id' | 'created' | 'updated'>): Promise<DevAgent> {
    const agent: DevAgent = {
      ...data,
      id: generateId('agent'),
      created: nowIso(),
      updated: nowIso(),
    };
    await this.writeNote(this.config.agentsFolder, agent.id, this.serializeAgent(agent));
    await this.mabs?.snapshotAgent(agent, { message: 'Created agent', modelAgnostic: false });
    return agent;
  }

  async getAgent(id: string): Promise<DevAgent | null> {
    return this.readAgent(id);
  }

  async listAgents(): Promise<DevAgent[]> {
    return this.listFolder(this.config.agentsFolder, (id) => this.readAgent(id));
  }

  async updateAgent(id: string, updates: Partial<Omit<DevAgent, 'id' | 'created' | 'updated'>>): Promise<DevAgent | null> {
    const existing = await this.readAgent(id);
    if (!existing) return null;
    const updated: DevAgent = { ...existing, ...updates, updated: nowIso() };
    await this.writeNote(this.config.agentsFolder, id, this.serializeAgent(updated));
    await this.mabs?.snapshotAgent(updated, { message: 'Updated agent', modelAgnostic: false });
    return updated;
  }

  async deleteAgent(id: string): Promise<boolean> {
    const existing = await this.readAgent(id);
    const ok = await this.deleteNote(this.config.agentsFolder, id);
    if (ok && existing) {
      await this.mabs?.snapshotAgent({ ...existing, updated: nowIso() }, { message: 'Deleted agent', author: 'system', modelAgnostic: false });
    }
    return ok;
  }

  // ─── L4: Workflows ───

  async createWorkflow(data: Omit<DevWorkflow, 'id' | 'currentPhase' | 'status' | 'created' | 'updated'>): Promise<DevWorkflow> {
    const workflow: DevWorkflow = {
      ...data,
      id: generateId('workflow'),
      currentPhase: 0,
      status: 'pending',
      created: nowIso(),
      updated: nowIso(),
    };
    await this.writeNote(this.config.workflowsFolder, workflow.id, this.serializeWorkflow(workflow));
    await this.mabs?.snapshotWorkflow(workflow, { message: 'Created workflow', modelAgnostic: true });
    return workflow;
  }

  async getWorkflow(id: string): Promise<DevWorkflow | null> {
    return this.readWorkflow(id);
  }

  async listWorkflows(): Promise<DevWorkflow[]> {
    return this.listFolder(this.config.workflowsFolder, (id) => this.readWorkflow(id));
  }

  async updateWorkflow(id: string, updates: Partial<Omit<DevWorkflow, 'id' | 'created' | 'updated'>>): Promise<DevWorkflow | null> {
    const existing = await this.readWorkflow(id);
    if (!existing) return null;
    const updated: DevWorkflow = { ...existing, ...updates, updated: nowIso() };
    await this.writeNote(this.config.workflowsFolder, id, this.serializeWorkflow(updated));
    await this.mabs?.snapshotWorkflow(updated, { message: 'Updated workflow', modelAgnostic: true });
    return updated;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const existing = await this.readWorkflow(id);
    const ok = await this.deleteNote(this.config.workflowsFolder, id);
    if (ok && existing) {
      await this.mabs?.snapshotWorkflow({ ...existing, updated: nowIso() }, { message: 'Deleted workflow', author: 'system', modelAgnostic: false });
    }
    return ok;
  }

  async advanceWorkflowPhase(id: string): Promise<DevWorkflow | null> {
    const workflow = await this.readWorkflow(id);
    if (!workflow) return null;
    if (workflow.status === 'completed' || workflow.status === 'failed') return workflow;

    const phase = workflow.phases[workflow.currentPhase];
    if (!phase) {
      workflow.status = 'completed';
    } else {
      phase.status = 'completed';
      workflow.currentPhase += 1;
      if (workflow.currentPhase >= workflow.phases.length) {
        workflow.status = 'completed';
      } else {
        workflow.phases[workflow.currentPhase].status = 'running';
      }
    }
    workflow.updated = nowIso();
    await this.writeNote(this.config.workflowsFolder, id, this.serializeWorkflow(workflow));
    await this.mabs?.snapshotWorkflow(workflow, { message: `Advanced to phase ${workflow.currentPhase}`, modelAgnostic: true });
    return workflow;
  }

  async failWorkflowPhase(id: string, reason: string): Promise<DevWorkflow | null> {
    const workflow = await this.readWorkflow(id);
    if (!workflow) return null;
    const phase = workflow.phases[workflow.currentPhase];
    if (phase) {
      phase.status = 'failed';
      phase.exitCriteria = reason;
    }
    workflow.status = 'failed';
    workflow.updated = nowIso();
    await this.writeNote(this.config.workflowsFolder, id, this.serializeWorkflow(workflow));
    await this.mabs?.snapshotWorkflow(workflow, { message: `Failed phase: ${reason}`, modelAgnostic: true });
    return workflow;
  }

  // ─── CLAUDE.md Management ───

  async getClaudeMd(): Promise<string> {
    try {
      return await this.vault.readRawContent(this.config.claudeMdPath);
    } catch (err) {
      console.error('[DevSystemEngine] Failed to read CLAUDE.md:', err);
      return '';
    }
  }

  async appendClaudeMd(section: string, content: string): Promise<void> {
    const existing = await this.getClaudeMd();
    const separator = existing.length > 0 ? '\n\n' : '';
    const newContent = `${existing}${separator}## ${section}\n\n${content}`;
    await this.vault.writeNote(this.config.claudeMdPath, newContent, { overwrite: true });
    await this.mabs?.snapshotClaudeMd(newContent, { message: `Appended section: ${section}`, modelAgnostic: true });
  }

  // ─── Serialization ───

  private serializePrompt(p: DevPrompt): string {
    const fm = [
      `---`,
      `id: ${p.id}`,
      `name: ${p.name}`,
      `role: ${p.role}`,
      `variables: [${(p.variables || []).map((v) => `"${v}"`).join(', ')}]`,
      `created: ${p.created}`,
      `updated: ${p.updated}`,
      `---`,
    ].join('\n');
    const body = [
      `## Context`,
      p.context,
      ``,
      `## Task`,
      p.task,
      ``,
      `## Acceptance Criteria`,
      (p.acceptanceCriteria || []).map((c) => `- ${c}`).join('\n'),
      p.verificationCommand ? `\n## Verification\n${p.verificationCommand}` : '',
    ].join('\n');
    return `${fm}\n${body}`;
  }

  private serializeSkill(s: DevSkill): string {
    const fm = [
      `---`,
      `id: ${s.id}`,
      `name: ${s.name}`,
      `description: ${s.description}`,
      `created: ${s.created}`,
      `updated: ${s.updated}`,
      `---`,
    ].join('\n');
    const body = [
      `## Permissions`,
      (s.permissions || []).map((p) => `- \`${p.command}\`: ${p.action}`).join('\n'),
      ``,
      `## Preconditions`,
      (s.preconditions || []).map((p) => `- [ ] ${p}`).join('\n'),
      ``,
      `## Steps`,
      (s.steps || []).map((step, i) => `${i + 1}. ${step}`).join('\n'),
      ``,
      `## Postconditions`,
      (s.postconditions || []).map((p) => `- [ ] ${p}`).join('\n'),
      ``,
      `## Examples`,
      (s.examples || []).map((e) => `### ${e.scenario}\n**Input:** ${e.input}\n**Expected:** ${e.expected}`).join('\n\n'),
      ``,
      `## Error Handling`,
      (s.errorHandling || []).map((e) => `- **${e.error}** → ${e.fix}`).join('\n'),
    ].join('\n');
    return `${fm}\n${body}`;
  }

  private serializeAgent(a: DevAgent): string {
    const fm = [
      `---`,
      `id: ${a.id}`,
      `name: ${a.name}`,
      `role: ${a.role}`,
      `complexity: ${a.complexity}`,
      `created: ${a.created}`,
      `updated: ${a.updated}`,
      `---`,
    ].join('\n');
    const body = [
      `## Tools`,
      (a.tools || []).map((t) => `- ${t}`).join('\n'),
      ``,
      `## Constraints`,
      (a.constraints || []).map((c) => `- ${c}`).join('\n'),
      ``,
      `## System Prompt`,
      a.systemPrompt,
    ].join('\n');
    return `${fm}\n${body}`;
  }

  private serializeWorkflow(w: DevWorkflow): string {
    const fm = [
      `---`,
      `id: ${w.id}`,
      `name: ${w.name}`,
      `description: ${w.description}`,
      `currentPhase: ${w.currentPhase}`,
      `status: ${w.status}`,
      `created: ${w.created}`,
      `updated: ${w.updated}`,
      `---`,
    ].join('\n');
    const body = [
      `## Phases`,
      (w.phases || []).map((p, i) => {
        const phaseName = (p.phase || 'unknown').toUpperCase();
        const header = `### ${i + 1}. ${phaseName}`;
        const agents = `**Agents:** ${(p.agents || []).join(', ')}`;
        const artifact = `**Artifact:** ${p.artifact || ''}`;
        const criteria = `**Exit Criteria:** ${p.exitCriteria || ''}`;
        const status = `**Status:** ${p.status || 'pending'}`;
        return [header, agents, artifact, criteria, status].join('\n');
      }).join('\n\n'),
    ].join('\n');
    return `${fm}\n${body}`;
  }

  // ─── Deserialization ───



  private isEnoent(err: unknown): boolean {
    return err instanceof FileNotFoundError || (err instanceof Error && 'code' in err && (err as { code: string }).code === 'ENOENT');
  }

  private async readPrompt(id: string): Promise<DevPrompt | null> {
    try {
      const note = await this.vault.readNote(path.join(this.config.promptsFolder, `${id}.md`), { includeContent: true });
      const fm = note.frontmatter;
      const lines = note.content.split('\n');
      const sections = this.extractSections(lines);
      return {
        id: String(fm.id || id),
        name: String(fm.name || note.title || id),
        role: String(fm.role || ''),
        context: sections['context'] || '',
        task: sections['task'] || '',
        acceptanceCriteria: (sections['acceptance criteria'] || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()),
        verificationCommand: sections['verification'] || undefined,
        variables: Array.isArray(fm.variables) ? fm.variables.map(String) : [],
        created: String(fm.created || nowIso()),
        updated: String(fm.updated || nowIso()),
      };
    } catch (err: unknown) {
      if (this.isEnoent(err)) return null;
      throw err;
    }
  }

  private async readSkill(id: string): Promise<DevSkill | null> {
    try {
      const note = await this.vault.readNote(path.join(this.config.skillsFolder, `${id}.md`), { includeContent: true });
      const fm = note.frontmatter;
      const lines = note.content.split('\n');
      const sections = this.extractSections(lines);
      return {
        id: String(fm.id || id),
        name: String(fm.name || note.title || id),
        description: String(fm.description || ''),
        permissions: (sections['permissions'] || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => {
          const match = l.match(/- `(.+?)`: (.+)/);
          return { command: match?.[1] || '', action: (match?.[2] || 'ask') as 'pre-approved' | 'ask' | 'deny' };
        }),
        preconditions: (sections['preconditions'] || '').split('\n').filter((l) => l.includes('[ ]')).map((l) => l.replace(/- \[ \] /, '').trim()),
        steps: (sections['steps'] || '').split('\n').filter((l) => /^\d+\./.test(l.trim())).map((l) => l.replace(/^\d+\.\s*/, '').trim()),
        postconditions: (sections['postconditions'] || '').split('\n').filter((l) => l.includes('[ ]')).map((l) => l.replace(/- \[ \] /, '').trim()),
        examples: this.parseExamples(sections['examples'] || ''),
        errorHandling: (sections['error handling'] || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => {
          const match = l.match(/- \*\*(.+?)\*\* → (.+)/);
          return { error: match?.[1] || '', fix: match?.[2] || '' };
        }),
        created: String(fm.created || nowIso()),
        updated: String(fm.updated || nowIso()),
      };
    } catch (err: unknown) {
      if (this.isEnoent(err)) return null;
      throw err;
    }
  }

  private async readAgent(id: string): Promise<DevAgent | null> {
    try {
      const note = await this.vault.readNote(path.join(this.config.agentsFolder, `${id}.md`), { includeContent: true });
      const fm = note.frontmatter;
      const lines = note.content.split('\n');
      const sections = this.extractSections(lines);
      return {
        id: String(fm.id || id),
        name: String(fm.name || note.title || id),
        role: String(fm.role || ''),
        tools: (sections['tools'] || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()),
        constraints: (sections['constraints'] || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()),
        systemPrompt: sections['system prompt'] || '',
        complexity: (fm.complexity as 'light' | 'medium' | 'heavy') || 'medium',
        created: String(fm.created || nowIso()),
        updated: String(fm.updated || nowIso()),
      };
    } catch (err: unknown) {
      if (this.isEnoent(err)) return null;
      throw err;
    }
  }

  private async readWorkflow(id: string): Promise<DevWorkflow | null> {
    try {
      const note = await this.vault.readNote(path.join(this.config.workflowsFolder, `${id}.md`), { includeContent: true });
      const fm = note.frontmatter;
      const phases = this.extractWorkflowPhases(note.content);
      return {
        id: String(fm.id || id),
        name: String(fm.name || note.title || id),
        description: String(fm.description || ''),
        phases,
        currentPhase: Number(fm.currentPhase || 0),
        status: (fm.status as 'pending' | 'running' | 'completed' | 'failed') || 'pending',
        created: String(fm.created || nowIso()),
        updated: String(fm.updated || nowIso()),
      };
    } catch (err: unknown) {
      if (this.isEnoent(err)) return null;
      throw err;
    }
  }

  private extractWorkflowPhases(content: string): DevWorkflow['phases'] {
    const phases: DevWorkflow['phases'] = [];
    const lines = content.split('\n');
    let inPhases = false;
    let currentPhase: Partial<DevWorkflow['phases'][0]> | null = null;
    for (const line of lines) {
      if (line.match(/^##\s+Phases/i)) {
        inPhases = true;
        continue;
      }
      if (inPhases && line.match(/^##\s/)) {
        inPhases = false;
        if (currentPhase) {
          phases.push(currentPhase as DevWorkflow['phases'][0]);
          currentPhase = null;
        }
        continue;
      }
      if (!inPhases) continue;
      const headingMatch = line.match(/^###\s+(?:\d+\.\s*)?(\w+)/i);
      if (headingMatch) {
        if (currentPhase) {
          phases.push(currentPhase as DevWorkflow['phases'][0]);
        }
        currentPhase = {
          phase: headingMatch[1].toLowerCase() as WorkflowPhase,
          agents: [],
          artifact: '',
          exitCriteria: '',
          status: 'pending',
        };
        continue;
      }
      if (!currentPhase) continue;
      const agentsMatch = line.match(/\*\*Agents:\*\*\s*(.+)/);
      if (agentsMatch) currentPhase.agents = agentsMatch[1].split(',').map((s) => s.trim());
      const artifactMatch = line.match(/\*\*Artifact:\*\*\s*(.+)/);
      if (artifactMatch) currentPhase.artifact = artifactMatch[1].trim();
      const criteriaMatch = line.match(/\*\*Exit Criteria:\*\*\s*(.+)/);
      if (criteriaMatch) currentPhase.exitCriteria = criteriaMatch[1].trim();
      const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
      if (statusMatch) currentPhase.status = statusMatch[1].trim() as 'pending' | 'running' | 'completed' | 'failed';
    }
    if (currentPhase) {
      phases.push(currentPhase as DevWorkflow['phases'][0]);
    }
    return phases;
  }

  // ─── Helpers ───

  private extractSections(lines: string[]): Record<string, string> {
    const sections: Record<string, string> = {};
    let current = '';
    let buffer: string[] = [];
    for (const line of lines) {
      const heading = line.match(/^#{2,3}\s+(.+)$/);
      if (heading) {
        if (current) {
          sections[current.toLowerCase()] = buffer.join('\n').trim();
        }
        current = heading[1].trim();
        buffer = [];
      } else if (current) {
        buffer.push(line);
      }
    }
    if (current) {
      sections[current.toLowerCase()] = buffer.join('\n').trim();
    }
    return sections;
  }

  private parseExamples(text: string): DevSkill['examples'] {
    const examples: DevSkill['examples'] = [];
    const blocks = text.split(/\n### /).filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n');
      const scenario = lines[0].trim();
      const inputMatch = block.match(/\*\*Input:\*\*\s*(.+)/);
      const expectedMatch = block.match(/\*\*Expected:\*\*\s*(.+)/);
      examples.push({
        scenario,
        input: inputMatch ? inputMatch[1].trim() : '',
        expected: expectedMatch ? expectedMatch[1].trim() : '',
      });
    }
    return examples;
  }

  private async writeNote(folder: string, id: string, content: string): Promise<void> {
    const relPath = path.join(folder, `${id}.md`);
    await this.vault.writeNote(relPath, content, { overwrite: true });
  }

  private async deleteNote(folder: string, id: string): Promise<boolean> {
    try {
      const relPath = path.join(folder, `${id}.md`);
      await this.vault.deleteNote(relPath, { soft: false });
      return true;
    } catch {
      return false;
    }
  }

  private async listFolder<T>(folder: string, reader: (id: string) => Promise<T | null>): Promise<T[]> {
    try {
      const entries = await this.vault.listDirectory(folder);
      const results: T[] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.name.endsWith('.md')) {
          const id = e.name.replace(/\.md$/, '');
          const item = await reader(id);
          if (item) results.push(item);
        }
        if (i % 50 === 49) await new Promise((resolve) => setImmediate(resolve));
      }
      return results;
    } catch {
      return [];
    }
  }
}
