// v0.2b:
import path from 'path';
import { VaultManager } from './VaultManager.js';
import { GraphEngine } from '../L4-semantic/GraphEngine.js';
import { SemanticDatabase } from '../L4-semantic/SemanticDatabase.js';
import { FolderACL } from '../../security/FolderACL.js';
export class VaultPool {
    entries = new Map();
    initializing = new Map();
    get size() {
        return this.entries.size;
    }
    register(entry) {
        this.entries.set(entry.vault.root, entry);
    }
    get(vaultPath) {
        return this.entries.get(path.resolve(vaultPath));
    }
    getEntry(vaultPath) {
        return this.get(vaultPath);
    }
    getByName(name) {
        for (const entry of this.entries.values()) {
            if (entry.name === name)
                return entry;
        }
        return undefined;
    }
    getByTag(tag) {
        for (const entry of this.entries.values()) {
            if (entry.tags?.includes(tag))
                return entry;
        }
        return undefined;
    }
    getVault(vaultPath) {
        const entry = this.get(vaultPath);
        if (!entry)
            throw new Error(`Vault not found: ${vaultPath}`);
        return entry;
    }
    hasVault(vaultPath) {
        return this.entries.has(path.resolve(vaultPath));
    }
    async addVault(vaultPath, acl, enforceOntology = false) {
        const resolved = path.resolve(vaultPath);
        const existing = this.entries.get(resolved);
        if (existing)
            return existing;
        const pending = this.initializing.get(resolved);
        if (pending)
            return pending;
        const promise = (async () => {
            const vaultAcl = acl || new FolderACL();
            const vault = new VaultManager(resolved, vaultAcl, undefined, enforceOntology);
            const graph = new GraphEngine();
            const semanticDb = new SemanticDatabase(resolved);
            try {
                await semanticDb.initSchema();
            }
            catch (err) {
                semanticDb.close();
                throw err;
            }
            const entry = { vault, graph, semanticDb, acl: vaultAcl };
            this.entries.set(resolved, entry);
            return entry;
        })();
        this.initializing.set(resolved, promise);
        try {
            const entry = await promise;
            return entry;
        }
        finally {
            this.initializing.delete(resolved);
        }
    }
    async removeVault(vaultPath) {
        const resolved = path.resolve(vaultPath);
        const entry = this.entries.get(resolved);
        if (entry) {
            this.entries.delete(resolved); // Remove first to prevent concurrent access (RC-007)
            try {
                if (entry.indexer) {
                    await entry.indexer.stopGraceful();
                }
            }
            finally {
                entry.vector = undefined;
                entry.semanticDb?.close();
                entry.dreaming?.close();
            }
            return true;
        }
        return false;
    }
    listVaults() {
        return Array.from(this.entries.entries()).map(([p, entry]) => ({
            path: p,
            name: entry.name,
            tags: entry.tags,
        }));
    }
    async initializeComponents(entry, embedProvider, persistence) {
        if (embedProvider && !entry.vector) {
            const { VectorEngine } = await import('../L4-semantic/VectorEngine.js');
            entry.vector = new VectorEngine(embedProvider);
        }
        if (!entry.indexer) {
            const { BackgroundIndexer } = await import('../L4-semantic/BackgroundIndexer.js');
            entry.indexer = new BackgroundIndexer(entry.vault, entry.graph, entry.vector, persistence, entry.semanticDb);
            await entry.indexer.initialize();
        }
    }
    async shutdown() {
        const errors = [];
        for (const entry of this.entries.values()) {
            try {
                if (entry.indexer) {
                    await entry.indexer.stopGraceful();
                }
            }
            catch (e) {
                errors.push(e instanceof Error ? e : new Error(String(e)));
            }
            finally {
                entry.semanticDb?.close();
                entry.dreaming?.close();
            }
        }
        this.entries.clear();
        if (errors.length > 0) {
            console.error('[VaultPool] Shutdown errors:', errors.map((e) => e.message).join('; '));
        }
    }
}
//# sourceMappingURL=VaultPool.js.map