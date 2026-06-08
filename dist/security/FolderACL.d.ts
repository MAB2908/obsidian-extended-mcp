export interface FolderPolicy {
    readPaths: string[];
    writePaths: string[];
    safeZones: string[];
    forbiddenPaths: string[];
}
export declare class FolderACL {
    private policy;
    constructor(policy?: Partial<FolderPolicy>);
    private _checkAllowed;
    isReadAllowed(filePath: string, overridePolicy?: Partial<FolderPolicy>): boolean;
    isWriteAllowed(filePath: string, overridePolicy?: Partial<FolderPolicy>): boolean;
    isSafeZone(filePath: string): boolean;
}
//# sourceMappingURL=FolderACL.d.ts.map