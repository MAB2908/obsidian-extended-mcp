import type { LLMProvider, LLMRequest } from '../LLMAdapter.js';
import type { AIResult, ModelCapability } from '../../../shared/types.js';
export interface OllamaConfig {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
}
export declare class OllamaProvider implements LLMProvider {
    readonly name = "ollama";
    readonly capabilities: readonly ModelCapability[];
    private _model;
    private baseUrl;
    private apiKey;
    get model(): string;
    constructor(config: OllamaConfig);
    private headers;
    isAvailable(): Promise<boolean>;
    generate<T>(request: LLMRequest): Promise<AIResult<T>>;
}
//# sourceMappingURL=OllamaProvider.d.ts.map