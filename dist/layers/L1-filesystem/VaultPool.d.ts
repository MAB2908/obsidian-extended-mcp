import { FolderACL } from '../../security/FolderACL.js';
import type { VaultEntry } from '../../shared/types.js';
export { VaultEntry } from '../../shared/types.js';
export declare class VaultPool {
    private entries;
    private initializing;
    get size(): number;
    register(entry: VaultEntry): void;
    get(vaultPath: string): VaultEntry | undefined;
    getEntry(vaultPath: string): VaultEntry | undefined;
    getByName(name: string): VaultEntry | undefined;
    getByTag(tag: string): VaultEntry | undefined;
    getVault(vaultPath: string): VaultEntry;
    hasVault(vaultPath: string): boolean;
    addVault(vaultPath: string, acl?: FolderACL, enforceOntology?: boolean): Promise<VaultEntry>;
    removeVault(vaultPath: string): Promise<boolean>;
    listVaults(): Array<{
        path: string;
        name?: string;
        tags?: string[];
    }>;
    initializeComponents(entry: VaultEntry, embedProvider?: any, persistence?: any): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=VaultPool.d.ts.map