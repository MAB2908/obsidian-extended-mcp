// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import { FileNotFoundError } from '../../shared/errors.js';
const DEFAULT_CONFIG = {
    promptsFolder: '.mcp-cache/dev-system/prompts',
    skillsFolder: '.mcp-cache/dev-system/skills',
    agentsFolder: '.mcp-cache/dev-system/agents',
    workflowsFolder: '.mcp-cache/dev-system/workflows',
    claudeMdPath: '.mcp-cache/dev-system/CLAUDE.md',
};
function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
    return new Date().toISOString();
}
/**
 * 4-Level Dev System Engine.
 *
 * Manages Prompts (L1), Skills (L2), Agents (L3), and Workflows (L4)
 * as structured notes inside the Obsidian vault.
 */
export class DevSystemEngine {
    vault;
    config;
    mabs;
    constructor(vault, config) {
        this.vault = vault;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** Attach Model-Aware Backup Service for automatic artifact versioning */
    attachBackupService(mabs) {
        this.mabs = mabs;
    }
    // ─── Lifecycle ───
    async initialize() {
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
    async createPrompt(data) {
        const prompt = {
            ...data,
            id: generateId('prompt'),
            created: nowIso(),
            updated: nowIso(),
        };
        await this.writeNote(this.config.promptsFolder, prompt.id, this.serializePrompt(prompt));
        await this.mabs?.snapshotPrompt(prompt, { message: 'Created prompt', modelAgnostic: prompt.variables.length === 0 });
        return prompt;
    }
    async getPrompt(id) {
        return this.readPrompt(id);
    }
    async listPrompts() {
        return this.listFolder(this.config.promptsFolder, (id) => this.readPrompt(id));
    }
    async updatePrompt(id, updates) {
        const existing = await this.readPrompt(id);
        if (!existing)
            return null;
        const updated = { ...existing, ...updates, updated: nowIso() };
        await this.writeNote(this.config.promptsFolder, id, this.serializePrompt(updated));
        await this.mabs?.snapshotPrompt(updated, { message: 'Updated prompt', modelAgnostic: updated.variables.length === 0 });
        return updated;
    }
    async deletePrompt(id) {
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
    executePrompt(prompt, variables) {
        let result = `[РОЛЬ]\n${prompt.role}\n\n[КОНТЕКСТ]\n${prompt.context}\n\n[ЗАДАЧА]\n${prompt.task}\n\n[КРИТЕРИИ ПРИЁМКИ]\n${prompt.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
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
    async createSkill(data) {
        const skill = {
            ...data,
            id: generateId('skill'),
            created: nowIso(),
            updated: nowIso(),
        };
        await this.writeNote(this.config.skillsFolder, skill.id, this.serializeSkill(skill));
        await this.mabs?.snapshotSkill(skill, { message: 'Created skill', modelAgnostic: true });
        return skill;
    }
    async getSkill(id) {
        return this.readSkill(id);
    }
    async listSkills() {
        return this.listFolder(this.config.skillsFolder, (id) => this.readSkill(id));
    }
    async updateSkill(id, updates) {
        const existing = await this.readSkill(id);
        if (!existing)
            return null;
        const updated = { ...existing, ...updates, updated: nowIso() };
        await this.writeNote(this.config.skillsFolder, id, this.serializeSkill(updated));
        await this.mabs?.snapshotSkill(updated, { message: 'Updated skill', modelAgnostic: true });
        return updated;
    }
    async deleteSkill(id) {
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
    executeSkill(skill, context) {
        let result = `# ${skill.name}\n\n${skill.description}\n\n## Предусловия\n${skill.preconditions.map((p) => `- [ ] ${p}`).join('\n')}\n\n## Пошаговый алгоритм\n${skill.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## Постусловия / Проверка\n${skill.postconditions.map((p) => `- [ ] ${p}`).join('\n')}`;
        if (skill.examples.length > 0) {
            result += `\n\n## Примеры\n${skill.examples.map((e) => `### ${e.scenario}\n**Вход:** ${e.input}\n**Ожидаемый результат:** ${e.expected}`).join('\n\n')}`;
        }
        for (const [key, value] of Object.entries(context)) {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), value);
        }
        return result;
    }
    // ─── L3: Agents ───
    async createAgent(data) {
        const agent = {
            ...data,
            id: generateId('agent'),
            created: nowIso(),
            updated: nowIso(),
        };
        await this.writeNote(this.config.agentsFolder, agent.id, this.serializeAgent(agent));
        await this.mabs?.snapshotAgent(agent, { message: 'Created agent', modelAgnostic: false });
        return agent;
    }
    async getAgent(id) {
        return this.readAgent(id);
    }
    async listAgents() {
        return this.listFolder(this.config.agentsFolder, (id) => this.readAgent(id));
    }
    async updateAgent(id, updates) {
        const existing = await this.readAgent(id);
        if (!existing)
            return null;
        const updated = { ...existing, ...updates, updated: nowIso() };
        await this.writeNote(this.config.agentsFolder, id, this.serializeAgent(updated));
        await this.mabs?.snapshotAgent(updated, { message: 'Updated agent', modelAgnostic: false });
        return updated;
    }
    async deleteAgent(id) {
        const existing = await this.readAgent(id);
        const ok = await this.deleteNote(this.config.agentsFolder, id);
        if (ok && existing) {
            await this.mabs?.snapshotAgent({ ...existing, updated: nowIso() }, { message: 'Deleted agent', author: 'system', modelAgnostic: false });
        }
        return ok;
    }
    // ─── L4: Workflows ───
    async createWorkflow(data) {
        const workflow = {
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
    async getWorkflow(id) {
        return this.readWorkflow(id);
    }
    async listWorkflows() {
        return this.listFolder(this.config.workflowsFolder, (id) => this.readWorkflow(id));
    }
    async updateWorkflow(id, updates) {
        const existing = await this.readWorkflow(id);
        if (!existing)
            return null;
        const updated = { ...existing, ...updates, updated: nowIso() };
        await this.writeNote(this.config.workflowsFolder, id, this.serializeWorkflow(updated));
        await this.mabs?.snapshotWorkflow(updated, { message: 'Updated workflow', modelAgnostic: true });
        return updated;
    }
    async deleteWorkflow(id) {
        const existing = await this.readWorkflow(id);
        const ok = await this.deleteNote(this.config.workflowsFolder, id);
        if (ok && existing) {
            await this.mabs?.snapshotWorkflow({ ...existing, updated: nowIso() }, { message: 'Deleted workflow', author: 'system', modelAgnostic: false });
        }
        return ok;
    }
    async advanceWorkflowPhase(id) {
        const workflow = await this.readWorkflow(id);
        if (!workflow)
            return null;
        if (workflow.status === 'completed' || workflow.status === 'failed')
            return workflow;
        const phase = workflow.phases[workflow.currentPhase];
        if (!phase) {
            workflow.status = 'completed';
        }
        else {
            phase.status = 'completed';
            workflow.currentPhase += 1;
            if (workflow.currentPhase >= workflow.phases.length) {
                workflow.status = 'completed';
            }
            else {
                workflow.phases[workflow.currentPhase].status = 'running';
            }
        }
        workflow.updated = nowIso();
        await this.writeNote(this.config.workflowsFolder, id, this.serializeWorkflow(workflow));
        await this.mabs?.snapshotWorkflow(workflow, { message: `Advanced to phase ${workflow.currentPhase}`, modelAgnostic: true });
        return workflow;
    }
    async failWorkflowPhase(id, reason) {
        const workflow = await this.readWorkflow(id);
        if (!workflow)
            return null;
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
    async getClaudeMd() {
        try {
            const note = await this.vault.readNote(this.config.claudeMdPath, { includeContent: true });
            return note.content;
        }
        catch (err) {
            console.error('[DevSystemEngine] Failed to read CLAUDE.md:', err);
            return '';
        }
    }
    async appendClaudeMd(section, content) {
        const existing = await this.getClaudeMd();
        const separator = existing.length > 0 ? '\n\n' : '';
        const newContent = `${existing}${separator}## ${section}\n\n${content}`;
        await this.vault.writeNote(this.config.claudeMdPath, newContent, { overwrite: true });
        await this.mabs?.snapshotClaudeMd(newContent, { message: `Appended section: ${section}`, modelAgnostic: true });
    }
    // ─── Serialization ───
    serializePrompt(p) {
        const fm = [
            `---`,
            `id: ${p.id}`,
            `name: ${p.name}`,
            `role: ${p.role}`,
            `variables: [${p.variables.map((v) => `"${v}"`).join(', ')}]`,
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
            p.acceptanceCriteria.map((c) => `- ${c}`).join('\n'),
            p.verificationCommand ? `\n## Verification\n${p.verificationCommand}` : '',
        ].join('\n');
        return `${fm}\n${body}`;
    }
    serializeSkill(s) {
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
            s.permissions.map((p) => `- \`${p.command}\`: ${p.action}`).join('\n'),
            ``,
            `## Preconditions`,
            s.preconditions.map((p) => `- [ ] ${p}`).join('\n'),
            ``,
            `## Steps`,
            s.steps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
            ``,
            `## Postconditions`,
            s.postconditions.map((p) => `- [ ] ${p}`).join('\n'),
            ``,
            `## Examples`,
            s.examples.map((e) => `### ${e.scenario}\n**Input:** ${e.input}\n**Expected:** ${e.expected}`).join('\n\n'),
            ``,
            `## Error Handling`,
            s.errorHandling.map((e) => `- **${e.error}** → ${e.fix}`).join('\n'),
        ].join('\n');
        return `${fm}\n${body}`;
    }
    serializeAgent(a) {
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
            a.tools.map((t) => `- ${t}`).join('\n'),
            ``,
            `## Constraints`,
            a.constraints.map((c) => `- ${c}`).join('\n'),
            ``,
            `## System Prompt`,
            a.systemPrompt,
        ].join('\n');
        return `${fm}\n${body}`;
    }
    serializeWorkflow(w) {
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
            w.phases.map((p, i) => {
                const header = `### ${i + 1}. ${p.phase.toUpperCase()}`;
                const agents = `**Agents:** ${p.agents.join(', ')}`;
                const artifact = `**Artifact:** ${p.artifact}`;
                const criteria = `**Exit Criteria:** ${p.exitCriteria}`;
                const status = `**Status:** ${p.status}`;
                return [header, agents, artifact, criteria, status].join('\n');
            }).join('\n\n'),
        ].join('\n');
        return `${fm}\n${body}`;
    }
    // ─── Deserialization ───
    isEnoent(err) {
        return err instanceof FileNotFoundError || (err instanceof Error && 'code' in err && err.code === 'ENOENT');
    }
    async readPrompt(id) {
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
        }
        catch (err) {
            if (this.isEnoent(err))
                return null;
            throw err;
        }
    }
    async readSkill(id) {
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
                    return { command: match?.[1] || '', action: (match?.[2] || 'ask') };
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
        }
        catch (err) {
            if (this.isEnoent(err))
                return null;
            throw err;
        }
    }
    async readAgent(id) {
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
                complexity: fm.complexity || 'medium',
                created: String(fm.created || nowIso()),
                updated: String(fm.updated || nowIso()),
            };
        }
        catch (err) {
            if (this.isEnoent(err))
                return null;
            throw err;
        }
    }
    async readWorkflow(id) {
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
                status: fm.status || 'pending',
                created: String(fm.created || nowIso()),
                updated: String(fm.updated || nowIso()),
            };
        }
        catch (err) {
            if (this.isEnoent(err))
                return null;
            throw err;
        }
    }
    extractWorkflowPhases(content) {
        const phases = [];
        const lines = content.split('\n');
        let inPhases = false;
        let currentPhase = null;
        for (const line of lines) {
            if (line.match(/^##\s+Phases/i)) {
                inPhases = true;
                continue;
            }
            if (inPhases && line.match(/^##\s/)) {
                inPhases = false;
                if (currentPhase) {
                    phases.push(currentPhase);
                    currentPhase = null;
                }
                continue;
            }
            if (!inPhases)
                continue;
            const headingMatch = line.match(/^###\s+(?:\d+\.\s*)?(\w+)/i);
            if (headingMatch) {
                if (currentPhase) {
                    phases.push(currentPhase);
                }
                currentPhase = {
                    phase: headingMatch[1].toLowerCase(),
                    agents: [],
                    artifact: '',
                    exitCriteria: '',
                    status: 'pending',
                };
                continue;
            }
            if (!currentPhase)
                continue;
            const agentsMatch = line.match(/\*\*Agents:\*\*\s*(.+)/);
            if (agentsMatch)
                currentPhase.agents = agentsMatch[1].split(',').map((s) => s.trim());
            const artifactMatch = line.match(/\*\*Artifact:\*\*\s*(.+)/);
            if (artifactMatch)
                currentPhase.artifact = artifactMatch[1].trim();
            const criteriaMatch = line.match(/\*\*Exit Criteria:\*\*\s*(.+)/);
            if (criteriaMatch)
                currentPhase.exitCriteria = criteriaMatch[1].trim();
            const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
            if (statusMatch)
                currentPhase.status = statusMatch[1].trim();
        }
        if (currentPhase) {
            phases.push(currentPhase);
        }
        return phases;
    }
    // ─── Helpers ───
    extractSections(lines) {
        const sections = {};
        let current = '';
        let buffer = [];
        for (const line of lines) {
            const heading = line.match(/^#{2,3}\s+(.+)$/);
            if (heading) {
                if (current) {
                    sections[current.toLowerCase()] = buffer.join('\n').trim();
                }
                current = heading[1].trim();
                buffer = [];
            }
            else if (current) {
                buffer.push(line);
            }
        }
        if (current) {
            sections[current.toLowerCase()] = buffer.join('\n').trim();
        }
        return sections;
    }
    parseExamples(text) {
        const examples = [];
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
    async writeNote(folder, id, content) {
        const relPath = path.join(folder, `${id}.md`);
        await this.vault.writeNote(relPath, content, { overwrite: true });
    }
    async deleteNote(folder, id) {
        try {
            const relPath = path.join(folder, `${id}.md`);
            await this.vault.deleteNote(relPath, { soft: false });
            return true;
        }
        catch {
            return false;
        }
    }
    async listFolder(folder, reader) {
        try {
            const entries = await this.vault.listDirectory(folder);
            const results = [];
            for (const e of entries) {
                if (e.name.endsWith('.md')) {
                    const id = e.name.replace(/\.md$/, '');
                    const item = await reader(id);
                    if (item)
                        results.push(item);
                }
            }
            return results;
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=DevSystemEngine.js.map