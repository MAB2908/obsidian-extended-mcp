export interface EmbeddingProvider {
    name: string;
    embed(texts: string[]): Promise<number[][]>;
    isAvailable(): Promise<boolean>;
}
export declare class OllamaEmbeddingProvider implements EmbeddingProvider {
    readonly name = "ollama-embed";
    private baseUrl;
    private model;
    constructor(baseUrl?: string, model?: string);
    isAvailable(): Promise<boolean>;
    embed(texts: string[]): Promise<number[][]>;
}
export declare class OpenAIEmbeddingProvider implements EmbeddingProvider {
    readonly name = "openai-embed";
    private apiKey;
    private model;
    private baseUrl;
    constructor(apiKey: string, model?: string, baseUrl?: string);
    isAvailable(): Promise<boolean>;
    embed(texts: string[]): Promise<number[][]>;
}
//# sourceMappingURL=EmbeddingProvider.d.ts.map