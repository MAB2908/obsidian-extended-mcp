// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { RestBridge } from '../layers/L2b-rest/RestBridge.js';
import { securityConfig } from '../shared/config.js';

export function createRestTools(rest: RestBridge): ToolHandler[] {
  return [
    {
      name: 'rest_active_note',
      description: 'Get currently active note via Local REST API',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        const result = await rest.activeNote();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'rest_dataview',
      description: 'Execute a Dataview DQL query via Local REST API',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      handler: async (args: unknown) => {
        const { query } = args as { query: string };
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        const result = await rest.executeDataview(query);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'rest_get_note',
      description: 'Read a note from the vault via Local REST API',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler: async (args: unknown) => {
        const { path } = args as { path: string };
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        const result = await rest.getNote(path);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'rest_write_note',
      description: 'Write or overwrite a note via Local REST API',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
      handler: async (args: unknown) => {
        const { path, content } = args as { path: string; content: string };
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        await rest.writeNote(path, content);
        return { content: [{ type: 'text', text: `Wrote ${path}` }] };
      },
    },
    {
      name: 'rest_delete_note',
      description: 'Delete a note via Local REST API',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler: async (args: unknown) => {
        const { path } = args as { path: string };
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        await rest.deleteNote(path);
        return { content: [{ type: 'text', text: `Deleted ${path}` }] };
      },
    },
    {
      name: 'rest_list_tags',
      description: 'List all tags in the vault via Local REST API',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        const result = await rest.listTags();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    {
      name: 'rest_execute_command',
      description: 'Execute an Obsidian command by ID via Local REST API',
      inputSchema: {
        type: 'object',
        properties: { commandId: { type: 'string' } },
        required: ['commandId'],
      },
      handler: async (args: unknown) => {
        const { commandId } = args as { commandId: string };
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        await rest.executeCommand(commandId);
        return { content: [{ type: 'text', text: `Executed command ${commandId}` }] };
      },
    },
    {
      name: 'rest_search',
      description: 'Search vault contents via Local REST API',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      handler: async (args: unknown) => {
        const { query } = args as { query: string };
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        const result = await rest.search(query);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
  ].filter((tool) => {
    if (tool.name === 'rest_write_note' && !securityConfig.enableCommands) return false;
    if (tool.name === 'rest_delete_note' && !securityConfig.enableCommands) return false;
    if (tool.name === 'rest_execute_command' && !securityConfig.enableCommands) return false;
    return true;
  });
}
