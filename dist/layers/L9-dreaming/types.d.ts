export type Maturity = 'draft' | 'validated' | 'core';
export interface DreamSignals {
    importance: number;
    maturity: Maturity;
    accessCount: number;
    lastAccessed?: number;
}
export declare const DEFAULT_SIGNALS: DreamSignals;
export interface DreamTopic {
    path: string;
    title: string;
    summary: string;
    html: string;
    mtimeMs: number;
    related: string[];
    signals: DreamSignals;
    domain: string;
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
    scope?: string;
}
export interface DreamFinalizeParams {
    sessionId: string;
    vaultPath: string;
    archivePaths: string[];
}
//# sourceMappingURL=types.d.ts.map