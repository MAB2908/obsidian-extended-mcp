// v0.1b:
// ───────────────────────────────────────────
// Pipeline Metrics — structured timing & outcome logging for stages
// ───────────────────────────────────────────

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

export class PipelineMetrics {
  private stages: StageMetric[] = [];

  async measure<T>(
    stage: string,
    fn: () => Promise<T>,
    counters?: { itemsIn?: number; itemsOut?: number }
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    let success = true;
    let error: string | undefined;
    try {
      const result = await fn();
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
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

  getStages(): readonly StageMetric[] {
    return this.stages;
  }

  toJSON(): string {
    return JSON.stringify({ stages: this.stages }, null, 2);
  }

  reset(): void {
    this.stages = [];
  }
}
