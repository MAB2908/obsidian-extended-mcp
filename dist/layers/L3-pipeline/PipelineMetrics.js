// v0.2b:
// ───────────────────────────────────────────
// Pipeline Metrics — structured timing & outcome logging for stages
// ───────────────────────────────────────────
export class PipelineMetrics {
    stages = [];
    async measure(stage, fn, counters) {
        const startedAt = new Date().toISOString();
        const start = performance.now();
        let success = true;
        let error;
        try {
            const result = await fn();
            return result;
        }
        catch (err) {
            success = false;
            error = err instanceof Error ? err.message : String(err);
            throw err;
        }
        finally {
            const durationMs = Math.round(performance.now() - start);
            const endedAt = new Date().toISOString();
            this.stages.push({
                stage,
                startedAt,
                endedAt,
                durationMs,
                success,
                error,
                itemsIn: counters?.itemsIn,
                itemsOut: counters?.itemsOut,
            });
        }
    }
    getStages() {
        return this.stages;
    }
    toJSON() {
        return JSON.stringify({ stages: this.stages }, null, 2);
    }
    reset() {
        this.stages = [];
    }
}
//# sourceMappingURL=PipelineMetrics.js.map