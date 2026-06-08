export interface FolderRules {
    requiredTags: string[];
    forbiddenTags: string[];
}
export interface Ontology {
    allowedTags: string[];
    folderRules: Record<string, FolderRules>;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare class TagEngine {
    private ontology;
    constructor(ontology?: Ontology);
    validateNote(filePath: string, frontmatterTags: string[], inlineTags: string[]): ValidationResult;
    private detectFolder;
    addTags(current: string[], toAdd: string[]): string[];
    removeTags(current: string[], toRemove: string[]): string[];
    setTags(_current: string[], newTags: string[]): string[];
    getOntology(): Ontology;
}
//# sourceMappingURL=TagEngine.d.ts.map