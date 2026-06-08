export class AIAgent {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    buildMessages(input) {
        return [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: JSON.stringify(input) },
        ];
    }
    async execute(input) {
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.adapter.generate({ messages: this.buildMessages(input), temperature: 0.3 }, this.getTaskComplexity());
            }
            catch (e) {
                lastError = e;
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
            }
        }
        throw lastError;
    }
}
//# sourceMappingURL=base.js.map