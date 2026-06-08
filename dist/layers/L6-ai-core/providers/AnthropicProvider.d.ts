import type { LLMProvider, LLMRequest } from '../LLMAdapter.js';
import type { AIResult, ModelCapability } from '../../../shared/types.js';
export interface AnthropicConfig {
    apiKey: string;
    model?: string;
    baseUrl?: string;
}
export declare class AnthropicProvider implements LLMProvider {
    readonly name = "anthropic";
    readonly capabilities: readonly ModelCapability[];
    private _model;
    private baseUrl;
    private apiKey;
    get model(): string;
    constructor(config: AnthropicConfig);
    isAvailable(): Promise<boolean>;
    generate<T>(request: LLMRequest): Promise<AIResult<T>>;
}
//# sourceMappingURL=AnthropicProvider.d.ts.map