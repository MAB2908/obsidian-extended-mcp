export interface BootstrapContext {
    prompt: string;
    tokenEstimate: number;
}
export declare class ContextBootstrap {
    private cache;
    constructor(vaultPath: string);
    generatePrompt(maxTokens?: number): Promise<BootstrapContext>;
    invalidate(): void;
    private trimPrompt;
}
//# sourceMappingURL=ContextBootstrap.d.ts.map