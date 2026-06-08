export declare class ContextBootstrapCache {
    private vaultPath;
    private cache;
    constructor(vaultPath: string);
    get(key: 'ontology' | 'protocol' | 'linkRules' | 'structure' | 'skills'): Promise<string | null>;
    invalidate(key?: string): void;
    private resolvePath;
    private generateStructure;
}
//# sourceMappingURL=ContextBootstrapCache.d.ts.map