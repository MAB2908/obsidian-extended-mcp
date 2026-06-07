// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { RestBridge } from '../layers/L2b-rest/RestBridge.js';

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
      handler: async (args) => {
        const { query } = args as { query: string };
        if (!(await rest.isAvailable())) {
          return { content: [{ type: 'text', text: 'REST API unavailable.' }], isError: true };
        }
        const result = await rest.executeDataview(query);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
  ];
}
