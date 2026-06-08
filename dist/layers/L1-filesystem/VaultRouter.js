import { VaultPathNotFoundError } from '../../shared/errors.js';
export class VaultRouter {
    pool;
    defaultVaultPath;
    constructor(pool, defaultVaultPath) {
        this.pool = pool;
        this.defaultVaultPath = defaultVaultPath;
    }
    resolve(args) {
        const entry = this.resolveEntry(args);
        if (!entry) {
            const lookup = args.vaultPath || args.vaultName || args.vaultTag || this.defaultVaultPath;
            throw new VaultPathNotFoundError(lookup);
        }
        return {
            vaultPath: entry.vault.root,
            vault: entry.vault,
            graph: entry.graph,
            bm25: entry.bm25,
            semanticDb: entry.semanticDb,
            indexer: entry.indexer,
            pipeline: entry.pipeline,
            vector: entry.vector,
            get dreaming() { return entry.dreaming; },
            set dreaming(v) { entry.dreaming = v; },
        };
    }
    resolveOptional(args) {
        const entry = this.resolveEntry(args);
        if (!entry)
            return null;
        return {
            vaultPath: entry.vault.root,
            vault: entry.vault,
            graph: entry.graph,
            bm25: entry.bm25,
            semanticDb: entry.semanticDb,
            indexer: entry.indexer,
            pipeline: entry.pipeline,
            vector: entry.vector,
            get dreaming() { return entry.dreaming; },
            set dreaming(v) { entry.dreaming = v; },
        };
    }
    /** Get per-vault config override if present */
    getVaultConfig(args) {
        const entry = this.resolveEntry(args);
        return entry?.config;
    }
    resolveEntry(args) {
        const vaultPath = args.vaultPath;
        const vaultName = args.vaultName;
        const vaultTag = args.vaultTag;
        if (vaultPath) {
            return this.pool.getEntry(vaultPath);
        }
        if (vaultName) {
            return this.pool.getByName(vaultName);
        }
        if (vaultTag) {
            return this.pool.getByTag(vaultTag);
        }
        return this.pool.getEntry(this.defaultVaultPath);
    }
}
//# sourceMappingURL=VaultRouter.js.map