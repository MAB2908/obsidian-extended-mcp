// v0.1b:
import type {
  DreamScanParams,
  DreamFinalizeParams,
  DreamSession,
} from '../../layers/L9-dreaming/types.js';

export interface IDreamingEngine {
  scan(params: DreamScanParams): Promise<DreamSession>;
  finalize(params: DreamFinalizeParams): Promise<{ archived: string[] }>;
  undo(sessionId: string): Promise<{ restored: string[] }>;
  close(): void;
}
