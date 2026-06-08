import type { LLMRequest, AIResult, TaskComplexity, ModelCapability } from '../../shared/types.js';
import { ModelAwareBackupService } from '../../shared/ModelAwareBackupService.js';
import type { AuditLogger } from '../../security/AuditLogger.js';
export type { LLMRequest } from '../../shared/types.js';
export interface LLMProvider {
    name: string;
    model: string;
    readonly capabilities?: readonly ModelCapability[];
    generate<T>(request: LLMRequest): Promise<AIResult<T>>;
    isAvailable(): Promise<boolean>;
}
export declare class LLMAdapter {
    private providers;
    private cache;
    private inFlight;
    private readonly maxCacheSize;
    private defaultProvider;
    private mabs?;
    private audit?;
    constructor(defaultProvider?: string);
    attachAuditLogger(audit: AuditLogger): void;
    /** Attach Model-Aware Backup Service for automatic model profiling */
    attachBackupService(mabs: ModelAwareBackupService): void;
    registerProvider(provider: LLMProvider): void;
    generate<T>(request: LLMRequest, complexity?: TaskComplexity): Promise<AIResult<T>>;
    private executeGeneration;
    private isRetryableError;
    private selectProvider;
    private hashRequest;
    private setCache;
    private isCacheValid;
}
//# sourceMappingURL=LLMAdapter.d.ts.map