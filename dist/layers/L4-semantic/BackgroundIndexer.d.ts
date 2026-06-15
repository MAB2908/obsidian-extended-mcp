import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import type { ISemanticDatabase } from '../../shared/interfaces/ISemanticDatabase.js';
import type { IBackgroundIndexer } from '../../shared/interfaces/IBackgroundIndexer.js';
import { IndexPersistence } from './IndexPersistence.js';
export declare class BackgroundIndexer implements IBackgroundIndexer {
    private vault;
    private graph;
    private vector?;
    private persistence?;
    private semanticDb?;
    private dirtyFiles;
    private batchTimer;
    private isShuttingDown;
    private currentBatch?;
    private readonly debounceMs;
    private readonly maxDirtySize;
    private readonly busyRetries;
    private readonly maxBusyRetries;
    constructor(vault: IVaultManager, graph: IGraphEngine, vector?: IVectorEngine | undefined, persistence?: IndexPersistence | undefined, semanticDb?: ISemanticDatabase | undefined);
    initialize(): Promise<void>;
    markDirty(relPath: string): void;
    markAllDirty(): void;
    private scheduleBatch;
    stop(): void;
    stopGraceful(): Promise<void>;
    private runBatch;
    private yieldEventLoop;
    private runBatchInternal;
    private chunkNote;
    private hashContent;
    private collectAllMarkdownFiles;
}
//# sourceMappingURL=BackgroundIndexer.d.ts.map