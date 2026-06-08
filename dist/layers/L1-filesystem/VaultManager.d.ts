import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { Note, ReadNoteOptions, WriteNoteOptions, DeleteOptions, SearchResult, SearchOptions } from '../../shared/types.js';
import { FolderACL } from '../../security/FolderACL.js';
import { TagEngine, type ValidationResult } from '../../shared/TagEngine.js';
export declare class VaultManager implements IVaultManager {
    private vaultPath;
    private acl;
    private tagEngine;
    private enforceOntology;
    private cache;
    private cacheGeneration;
    constructor(vaultPath: string, acl?: FolderACL, tagEngine?: TagEngine, enforceOntology?: boolean);
    get root(): string;
    isWriteAllowed(relPath: string): boolean;
    private invalidateCache;
    private yieldEventLoop;
    private resolve;
    /** Public accessor for resolving vault-relative paths (used by index.ts file router) */
    resolvePath(rel: string): Promise<string>;
    readRawContent(relPath: string): Promise<string>;
    readNote(relPath: string, opts?: ReadNoteOptions): Promise<Note>;
    readNoteTags(relPath: string): Promise<string[]>;
    private normalizeTags;
    private checkSize;
    writeNote(relPath: string, content: string, opts?: WriteNoteOptions): Promise<void>;
    appendNote(relPath: string, content: string): Promise<void>;
    patchNote(relPath: string, target: string, operation: 'replace' | 'append' | 'prepend' | 'delete', replacement?: string): Promise<void>;
    deleteNote(relPath: string, opts?: DeleteOptions): Promise<void>;
    moveNote(fromRel: string, toRel: string): Promise<void>;
    listDirectory(relDir?: string): Promise<{
        name: string;
        isDirectory: boolean;
    }[]>;
    listNotes(relDir?: string): Promise<string[]>;
    searchNotes(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
    getVaultStats(): Promise<{
        totalNotes: number;
        totalFolders: number;
        totalTags: number;
        totalLinks: number;
    }>;
    listAllTags(): Promise<Record<string, number>>;
    private readFileSafe;
    private atomicWrite;
    createBackup(fullPath: string): Promise<string>;
    private pruneBackups;
    listBackups(): Promise<Array<{
        timestamp: string;
        path: string;
        relPath: string;
    }>>;
    private collectBackupFiles;
    rollback(relPath: string, timestamp?: string): Promise<void>;
    private extractWikilinks;
    private collectMarkdownFiles;
    manageTags(relPath: string, action: 'add' | 'remove' | 'set', tags: string[]): Promise<void>;
    validateNote(relPath: string): Promise<ValidationResult>;
    private extractInlineTags;
    private checkOntology;
    batchEdit(filter: {
        folder?: string;
        glob?: string;
        tag?: string;
    }, operation: 'replace' | 'prepend' | 'append' | 'rename_tag', target: string, replacement?: string, preview?: boolean): Promise<{
        modified: number;
        paths: string[];
        previews?: Array<{
            path: string;
            before: string;
            after: string;
        }>;
    }>;
    private globMatch;
}
//# sourceMappingURL=VaultManager.d.ts.map