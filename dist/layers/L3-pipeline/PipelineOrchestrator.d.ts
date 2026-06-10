import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { IBackgroundIndexer } from '../../shared/interfaces/IBackgroundIndexer.js';
import type { IPipelineOrchestrator } from '../../shared/interfaces/IPipelineOrchestrator.js';
import type { LLMAdapter } from '../L6-ai-core/LLMAdapter.js';
import { PipelineMetrics } from './PipelineMetrics.js';
export declare class PipelineOrchestrator implements IPipelineOrchestrator {
    private vault;
    private graph;
    private bm25;
    private indexer;
    private ingestAgent;
    private queryAgent;
    private tagAgent;
    private compileAgent;
    private linkAgent;
    private lintAgent;
    private enrichAgent;
    readonly metrics: PipelineMetrics;
    constructor(vault: IVaultManager, graph: IGraphEngine, bm25: IBM25Engine, indexer: IBackgroundIndexer, adapter: LLMAdapter, metrics?: PipelineMetrics);
    runIngest(relPath: string): Promise<unknown>;
    runTag(relPath: string, ontology: string[]): Promise<unknown>;
    runQuery(question: string): Promise<unknown>;
    runCompile(sinceDays?: number): Promise<unknown>;
    runLink(relPath: string): Promise<unknown>;
    runLinkBatch(limit?: number, folder?: string): Promise<unknown>;
    runLint(): Promise<unknown>;
    runEnrich(relPath: string): Promise<unknown>;
    private iterateAllNotes;
}
//# sourceMappingURL=PipelineOrchestrator.d.ts.map