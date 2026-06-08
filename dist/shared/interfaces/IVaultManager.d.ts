import type { Note, ReadNoteOptions, WriteNoteOptions, DeleteOptions, SearchResult, SearchOptions } from '../types.js';
import type { ValidationResult } from '../TagEngine.js';
export interface IVaultManager {
    readonly root: string;
    readNote(relPath: string, opts?: ReadNoteOptions): Promise<Note>;
    readNoteTags(relPath: string): Promise<string[]>;
    readRawContent(relPath: string): Promise<string>;
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
    resolvePath(rel: string): Promise<string>;
    isWriteAllowed(relPath: string): boolean;
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
    rollback(relPath: string, timestamp?: string): Promise<void>;
    listBackups(): Promise<Array<{
        timestamp: string;
        path: string;
        relPath: string;
    }>>;
    manageTags(relPath: string, action: 'add' | 'remove' | 'set', tags: string[]): Promise<void>;
    validateNote(relPath: string): Promise<ValidationResult>;
}
//# sourceMappingURL=IVaultManager.d.ts.map