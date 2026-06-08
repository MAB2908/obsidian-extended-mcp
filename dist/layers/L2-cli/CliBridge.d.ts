import type { ILayer2CliBridge } from '../../shared/types.js';
import type { SearchResult } from '../../shared/types.js';
export declare class CliBridge implements ILayer2CliBridge {
    private cliPath;
    private vaultPath;
    constructor(vaultPath: string, cliPath?: string);
    isAvailable(): Promise<boolean>;
    eval(code: string, timeout?: number): Promise<unknown>;
    backlinks(path: string): Promise<Array<{
        source: string;
        line: number;
        context?: string;
    }>>;
    orphans(folder?: string): Promise<string[]>;
    unresolved(folder?: string): Promise<Array<{
        link: string;
        source: string;
        line: number;
    }>>;
    deadends(folder?: string): Promise<string[]>;
    properties(file: string, action: 'read' | 'set' | 'remove' | 'list', property?: string, value?: string): Promise<unknown>;
    search(query: string, _context?: boolean): Promise<SearchResult[]>;
    daily(action: 'read' | 'append' | 'prepend', content?: string): Promise<string>;
    command(name: string): Promise<void>;
    plugin(action: string, id?: string): Promise<unknown>;
    private runCli;
    private parseJson;
}
//# sourceMappingURL=CliBridge.d.ts.map