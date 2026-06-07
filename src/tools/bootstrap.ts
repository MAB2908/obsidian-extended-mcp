// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { ContextBootstrap } from '../layers/L5-bootstrap/ContextBootstrap.js';

export function createBootstrapTools(bootstrap: ContextBootstrap): ToolHandler[] {
  return [
    {
      name: 'get_context_bootstrap',
      description: 'Get structured context for AI agent initialization',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const context = await bootstrap.generatePrompt();
        return { content: [{ type: 'text', text: JSON.stringify(context) }] };
      },
    },
  ];
}
