import type { LLMProvider, LLMRequest } from '../LLMAdapter.js';
import type { AIResult, ModelCapability } from '../../../shared/types.js';
export interface OpenAIConfig {
    apiKey: string;
    model?: string;
    baseUrl?: string;
}
export declare class OpenAIProvider implements LLMProvider {
    readonly name = "openai";
    readonly capabilities: readonly ModelCapability[];
    private _model;
    private baseUrl;
    private apiKey;
    get model(): string;
    constructor(config: OpenAIConfig);
    isAvailable(): Promise<boolean>;
    generate<T>(request: LLMRequest): Promise<AIResult<T>>;
}
//# sourceMappingURL=OpenAIProvider.d.ts.map