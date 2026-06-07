// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { DevSystemEngine } from '../layers/L7-dev-system/index.js';

export function createDevSystemTools(devSystem: DevSystemEngine): ToolHandler[] {
  return [
    // ─── L1: Prompts ───
    {
      name: 'dev_prompt_list',
      description: 'List all available dev prompts (L1)',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const prompts = await devSystem.listPrompts();
        return { content: [{ type: 'text', text: JSON.stringify(prompts, null, 2) }] };
      },
    },
    {
      name: 'dev_prompt_create',
      description: 'Create a new dev prompt (L1)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          context: { type: 'string' },
          task: { type: 'string' },
          acceptanceCriteria: { type: 'array', items: { type: 'string' } },
          verificationCommand: { type: 'string' },
          variables: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'role', 'context', 'task', 'acceptanceCriteria', 'variables'],
      },
      handler: async (args) => {
        const prompt = await devSystem.createPrompt(args as Parameters<typeof devSystem.createPrompt>[0]);
        return { content: [{ type: 'text', text: JSON.stringify(prompt, null, 2) }] };
      },
    },
    {
      name: 'dev_prompt_get',
      description: 'Get a dev prompt by id (L1)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const prompt = await devSystem.getPrompt(id);
        return { content: [{ type: 'text', text: JSON.stringify(prompt, null, 2) }] };
      },
    },
    {
      name: 'dev_prompt_delete',
      description: 'Delete a dev prompt by id (L1)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const ok = await devSystem.deletePrompt(id);
        return { content: [{ type: 'text', text: ok ? 'Deleted' : 'Not found' }] };
      },
    },
    {
      name: 'dev_prompt_execute',
      description: 'Execute a dev prompt with variable substitution (L1)',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          variables: { type: 'object' },
        },
        required: ['id'],
      },
      handler: async (args) => {
        const { id, variables = {} } = args as { id: string; variables?: Record<string, string> };
        const prompt = await devSystem.getPrompt(id);
        if (!prompt) return { content: [{ type: 'text', text: 'Prompt not found' }], isError: true };
        const rendered = devSystem.executePrompt(prompt, variables);
        return { content: [{ type: 'text', text: rendered }] };
      },
    },

    // ─── L2: Skills ───
    {
      name: 'dev_skill_list',
      description: 'List all available dev skills (L2)',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const skills = await devSystem.listSkills();
        return { content: [{ type: 'text', text: JSON.stringify(skills, null, 2) }] };
      },
    },
    {
      name: 'dev_skill_create',
      description: 'Create a new dev skill (L2)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          permissions: { type: 'array', items: { type: 'object' } },
          preconditions: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          postconditions: { type: 'array', items: { type: 'string' } },
          examples: { type: 'array', items: { type: 'object' } },
          errorHandling: { type: 'array', items: { type: 'object' } },
        },
        required: ['name', 'description', 'steps', 'permissions', 'preconditions', 'postconditions', 'examples', 'errorHandling'],
      },
      handler: async (args) => {
        const skill = await devSystem.createSkill(args as Parameters<typeof devSystem.createSkill>[0]);
        return { content: [{ type: 'text', text: JSON.stringify(skill, null, 2) }] };
      },
    },
    {
      name: 'dev_skill_get',
      description: 'Get a dev skill by id (L2)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const skill = await devSystem.getSkill(id);
        return { content: [{ type: 'text', text: JSON.stringify(skill, null, 2) }] };
      },
    },
    {
      name: 'dev_skill_delete',
      description: 'Delete a dev skill by id (L2)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const ok = await devSystem.deleteSkill(id);
        return { content: [{ type: 'text', text: ok ? 'Deleted' : 'Not found' }] };
      },
    },
    {
      name: 'dev_skill_execute',
      description: 'Execute a dev skill with context substitution (L2)',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          context: { type: 'object' },
        },
        required: ['id'],
      },
      handler: async (args) => {
        const { id, context = {} } = args as { id: string; context?: Record<string, string> };
        const skill = await devSystem.getSkill(id);
        if (!skill) return { content: [{ type: 'text', text: 'Skill not found' }], isError: true };
        const rendered = devSystem.executeSkill(skill, context);
        return { content: [{ type: 'text', text: rendered }] };
      },
    },

    // ─── L3: Agents ───
    {
      name: 'dev_agent_list',
      description: 'List all available dev agents (L3)',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const agents = await devSystem.listAgents();
        return { content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }] };
      },
    },
    {
      name: 'dev_agent_create',
      description: 'Create a new dev agent (L3)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          tools: { type: 'array', items: { type: 'string' } },
          constraints: { type: 'array', items: { type: 'string' } },
          systemPrompt: { type: 'string' },
          complexity: { type: 'string', enum: ['light', 'medium', 'heavy'] },
        },
        required: ['name', 'role', 'tools', 'constraints', 'systemPrompt', 'complexity'],
      },
      handler: async (args) => {
        const agent = await devSystem.createAgent(args as Parameters<typeof devSystem.createAgent>[0]);
        return { content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }] };
      },
    },
    {
      name: 'dev_agent_get',
      description: 'Get a dev agent by id (L3)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const agent = await devSystem.getAgent(id);
        return { content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }] };
      },
    },
    {
      name: 'dev_agent_delete',
      description: 'Delete a dev agent by id (L3)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const ok = await devSystem.deleteAgent(id);
        return { content: [{ type: 'text', text: ok ? 'Deleted' : 'Not found' }] };
      },
    },

    // ─── L4: Workflows ───
    {
      name: 'dev_workflow_list',
      description: 'List all dev workflows (L4)',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const workflows = await devSystem.listWorkflows();
        return { content: [{ type: 'text', text: JSON.stringify(workflows, null, 2) }] };
      },
    },
    {
      name: 'dev_workflow_create',
      description: 'Create a new dev workflow (L4)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          phases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                phase: { type: 'string', enum: ['spec', 'draft', 'simplify', 'verify'] },
                agents: { type: 'array', items: { type: 'string' } },
                artifact: { type: 'string' },
                exitCriteria: { type: 'string' },
              },
              required: ['phase', 'agents', 'artifact', 'exitCriteria'],
            },
          },
        },
        required: ['name', 'description', 'phases'],
      },
      handler: async (args) => {
        const workflow = await devSystem.createWorkflow(args as Parameters<typeof devSystem.createWorkflow>[0]);
        return { content: [{ type: 'text', text: JSON.stringify(workflow, null, 2) }] };
      },
    },
    {
      name: 'dev_workflow_get',
      description: 'Get a dev workflow by id (L4)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const workflow = await devSystem.getWorkflow(id);
        return { content: [{ type: 'text', text: JSON.stringify(workflow, null, 2) }] };
      },
    },
    {
      name: 'dev_workflow_delete',
      description: 'Delete a dev workflow by id (L4)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const ok = await devSystem.deleteWorkflow(id);
        return { content: [{ type: 'text', text: ok ? 'Deleted' : 'Not found' }] };
      },
    },
    {
      name: 'dev_workflow_advance',
      description: 'Advance a workflow to the next phase (L4)',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const { id } = args as { id: string };
        const workflow = await devSystem.advanceWorkflowPhase(id);
        return { content: [{ type: 'text', text: JSON.stringify(workflow, null, 2) }] };
      },
    },
    {
      name: 'dev_workflow_fail',
      description: 'Fail the current phase of a workflow (L4)',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
        required: ['id', 'reason'],
      },
      handler: async (args) => {
        const { id, reason } = args as { id: string; reason: string };
        const workflow = await devSystem.failWorkflowPhase(id, reason);
        return { content: [{ type: 'text', text: JSON.stringify(workflow, null, 2) }] };
      },
    },

    // ─── CLAUDE.md ───
    {
      name: 'dev_claude_md_get',
      description: 'Get the current CLAUDE.md content',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const content = await devSystem.getClaudeMd();
        return { content: [{ type: 'text', text: content || '(empty)' }] };
      },
    },
    {
      name: 'dev_claude_md_append',
      description: 'Append a section to CLAUDE.md',
      inputSchema: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['section', 'content'],
      },
      handler: async (args) => {
        const { section, content } = args as { section: string; content: string };
        await devSystem.appendClaudeMd(section, content);
        return { content: [{ type: 'text', text: `Appended section: ${section}` }] };
      },
    },
  ];
}
