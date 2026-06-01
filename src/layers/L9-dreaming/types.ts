// v0.1b:
// ───────────────────────────────────────────
// Dreaming Layer — Types
// ───────────────────────────────────────────

export type Maturity = 'draft' | 'validated' | 'core';

export interface DreamSignals {
  importance: number;   // 0–100
  maturity: Maturity;
  accessCount: number;
  lastAccessed?: number; // timestamp ms
}

export const DEFAULT_SIGNALS: DreamSignals = {
  importance: 50,
  maturity: 'draft',
  accessCount: 0,
};

export interface DreamTopic {
  path: string;
  title: string;
  summary: string;
  html: string;        // full markdown content
  mtimeMs: number;
  related: string[];
  signals: DreamSignals;
  domain: string;      // first path segment
}

export type DreamKind = 'link' | 'merge' | 'prune' | 'synthesize';

export interface LinkCandidate {
  kind: 'link';
  sourcePath: string;
  targetPath: string;
  score: number;
  reason: string;
}

export interface MergeCandidate {
  kind: 'merge';
  sourcePath: string;
  targetPath: string;
  score: number;
  reason: string;
}

export interface PruneCandidate {
  kind: 'prune';
  path: string;
  score: number;
  reason: string;
  signals: DreamSignals;
}

export interface SynthesizeCandidate {
  kind: 'synthesize';
  domain: string;
  paths: string[];
  score: number;
  reason: string;
  proposedTitle: string;
}

export type DreamCandidate = LinkCandidate | MergeCandidate | PruneCandidate | SynthesizeCandidate;

export interface DreamSession {
  sessionId: string;
  timestamp: string;
  vaultPath: string;
  candidates: Record<DreamKind, DreamCandidate[]>;
}

export type DreamLogAction = 'archive' | 'restore' | 'consolidate' | 'synthesize' | 'prune';

export interface DreamLogEntry {
  sessionId: string;
  timestamp: string;
  action: DreamLogAction;
  path: string;
  originalContent?: string;
  originalMtime?: number;
}

export interface DreamScanParams {
  vaultPath: string;
  kinds?: DreamKind[];
  maxCandidates?: number;
  scope?: string;            // optional domain prefix filter
}

export interface DreamFinalizeParams {
  sessionId: string;
  vaultPath: string;
  archivePaths: string[];
}
