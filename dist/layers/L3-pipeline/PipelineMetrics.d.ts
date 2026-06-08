export interface StageMetric {
    stage: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    success: boolean;
    error?: string;
    itemsIn?: number;
    itemsOut?: number;
}
export declare class PipelineMetrics {
    private stages;
    measure<T>(stage: string, fn: () => Promise<T>, counters?: {
        itemsIn?: number;
        itemsOut?: number;
    }): Promise<T>;
    getStages(): readonly StageMetric[];
    toJSON(): string;
    reset(): void;
}
//# sourceMappingURL=PipelineMetrics.d.ts.map