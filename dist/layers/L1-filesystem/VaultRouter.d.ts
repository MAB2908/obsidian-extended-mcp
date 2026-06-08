import type { VaultPool } from './VaultPool.js';
import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { ISemanticDatabase } from '../../shared/interfaces/ISemanticDatabase.js';
import type { IBackgroundIndexer } from '../../shared/interfaces/IBackgroundIndexer.js';
import type { IPipelineOrchestrator } from '../../shared/interfaces/IPipelineOrchestrator.js';
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import type { IDreamingEngine } from '../../shared/interfaces/IDreamingEngine.js';
export interface VaultContext {
    vaultPath: string;
    vault: IVaultManager;
    graph: IGraphEngine;
    bm25: IBM25Engine;
    semanticDb: ISemanticDatabase;
    indexer?: IBackgroundIndexer;
    pipeline?: IPipelineOrchestrator;
    vector?: IVectorEngine;
    dreaming?: IDreamingEngine;
}
export declare class VaultRouter {
    private pool;
    private defaultVaultPath;
    constructor(pool: VaultPool, defaultVaultPath: string);
    resolve(args: Record<string, unknown>): VaultContext;
    resolveOptional(args: Record<string, unknown>): VaultContext | null;
    /** Get per-vault config override if present */
    getVaultConfig(args: Record<string, unknown>): Record<string, unknown> | undefined;
    private resolveEntry;
}
//# sourceMappingURL=VaultRouter.d.ts.map