export interface FileHandler {
    mimeTypes: string[];
    extensions: string[];
    read(filePath: string): Promise<unknown>;
    write?(filePath: string, data: unknown): Promise<void>;
}
export declare class FileTypeRouter {
    private handlers;
    private vaultRoot?;
    constructor(vaultRoot?: string);
    register(handler: FileHandler): void;
    private guard;
    read(filePath: string): Promise<unknown>;
    write(filePath: string, data: unknown): Promise<void>;
    private detectMime;
    private isTextExtension;
}
export declare const markdownHandler: FileHandler;
export declare const canvasHandler: FileHandler;
export declare const jsonHandler: FileHandler;
//# sourceMappingURL=FileTypeRouter.d.ts.map