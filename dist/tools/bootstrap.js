export function createBootstrapTools(bootstrap) {
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
//# sourceMappingURL=bootstrap.js.map