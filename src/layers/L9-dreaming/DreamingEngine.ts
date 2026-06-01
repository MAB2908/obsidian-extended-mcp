// v0.1b:
// ───────────────────────────────────────────
// Dreaming Engine — Scan → Decision → Finalize
// ───────────────────────────────────────────

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { IDreamingEngine } from '../../shared/interfaces/IDreamingEngine.js';
import { SignalStore } from './SignalStore.js';
import { TopicLoader } from './TopicLoader.js';
import { DreamLog } from './DreamLog.js';
import { generateLinkCandidates } from './generators/LinkGenerator.js';
import { generateMergeCandidates } from './generators/MergeGenerator.js';
import { generatePruneCandidates } from './generators/PruneGenerator.js';
import { generateSynthesizeCandidates } from './generators/SynthesizeGenerator.js';
import { SessionLockService } from './SessionLockService.js';
import { DreamState } from './DreamState.js';
import type { AuditLogger } from '../../security/AuditLogger.js';
import type {
  DreamScanParams,
  DreamFinalizeParams,
  DreamSession,
  DreamKind,
  DreamCandidate,
  DreamSignals,
} from './types.js';

export interface DreamingEngineConfig {
  vaultPath: string;
  vault: IVaultManager;
  bm25: IBM25Engine;
  signals: SignalStore;
  audit?: AuditLogger;
}

export class DreamingEngine implements IDreamingEngine {
  private vaultPath: string;
  private vault: IVaultManager;
  private bm25: IBM25Engine;
  private signals: SignalStore;
  private log: DreamLog;
  private loader: TopicLoader;
  private state: DreamState;
  private audit?: AuditLogger;
  private activeSessionId?: string;

  /** Per-vault promise cache to prevent duplicate SignalStore / SQLite opens */
  private static creationPromises = new Map<string, Promise<DreamingEngine>>();

  constructor(config: DreamingEngineConfig) {
    this.vaultPath = config.vaultPath;
    this.vault = config.vault;
    this.bm25 = config.bm25;
    this.signals = config.signals;
    this.log = new DreamLog(config.vaultPath);
    this.loader = new TopicLoader(config.vault, this.signals);
    this.state = new DreamState(config.vaultPath);
    this.audit = config.audit;
  }

  /** Factory: async construction with SignalStore init (race-safe) */
  static async create(config: Omit<DreamingEngineConfig, 'signals'>): Promise<DreamingEngine> {
    const existing = DreamingEngine.creationPromises.get(config.vaultPath);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const signals = await SignalStore.forVault(config.vaultPath);
        return new DreamingEngine({ ...config, signals });
      } catch (err) {
        DreamingEngine.creationPromises.delete(config.vaultPath);
        throw err;
      }
    })();

    DreamingEngine.creationPromises.set(config.vaultPath, promise);
    return promise;
  }

  /** Phase 1: Scan — deterministic analysis, no mutations */
  async scan(params: DreamScanParams): Promise<DreamSession> {
    await this.log.init();

    // Generate sessionId early so tryAcquire is atomic (C1a)
    const sessionId = randomUUID();
    if (!SessionLockService.tryAcquire(this.vaultPath, sessionId)) {
      throw new Error(`Dreaming session already active for vault: ${this.vaultPath} (holder: ${SessionLockService.getHolder(this.vaultPath)})`);
    }

    try {
    const topics = await this.loader.load({ scope: params.scope });
    const kinds: DreamKind[] = params.kinds ?? ['link', 'merge', 'prune', 'synthesize'];
    const maxCandidates = params.maxCandidates ?? 20;

    const candidates: Record<DreamKind, DreamCandidate[]> = {
      link: [],
      merge: [],
      prune: [],
      synthesize: [],
    };

    if (kinds.includes('link')) {
      candidates.link = generateLinkCandidates(topics, this.bm25, { maxCandidates });
    }
    if (kinds.includes('merge')) {
      candidates.merge = generateMergeCandidates(topics, this.bm25, { maxCandidates });
    }
    if (kinds.includes('prune')) {
      candidates.prune = generatePruneCandidates(topics, { maxCandidates });
    }
    if (kinds.includes('synthesize')) {
      candidates.synthesize = generateSynthesizeCandidates(topics, { maxCandidates });
    }

    const session: DreamSession = {
      sessionId,
      timestamp: new Date().toISOString(),
      vaultPath: this.vaultPath,
      candidates,
    };

    this.activeSessionId = sessionId;
    await this.state.addSession(session);
    return session;
    } catch (err) {
      SessionLockService.release(this.vaultPath, sessionId);
      throw err;
    }
  }

  /** Phase 3: Finalize — archive loser paths, log for undo */
  async finalize(params: DreamFinalizeParams): Promise<{ archived: string[] }> {
    // C1: validate sessionId exists in DreamState before destructive operations
    const session = await this.state.getSession(params.sessionId);
    if (!session) {
      throw new Error(`Invalid or unknown sessionId: ${params.sessionId}`);
    }
    if (session.vaultPath !== this.vaultPath) {
      throw new Error(`Session ${params.sessionId} does not belong to vault ${this.vaultPath}`);
    }

    SessionLockService.release(this.vaultPath, params.sessionId);
    const archived: string[] = [];

    for (const relPath of params.archivePaths) {
      try {
        const note = await this.vault.readNote(relPath, { includeContent: true });
        const fullPath = await this.vault.resolvePath(relPath);
        const stat = await import('fs').then((fs) => fs.promises.stat(fullPath));

        await this.log.archive(relPath, note.content);
        await this.log.append({
          sessionId: params.sessionId,
          timestamp: new Date().toISOString(),
          action: 'archive',
          path: relPath,
          originalContent: note.content,
          originalMtime: stat.mtimeMs,
        });

        // Actually remove from vault
        await this.vault.deleteNote(relPath);
        archived.push(relPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.audit?.log({ event: 'error', tool: 'dream_finalize', message: `finalize failed for ${relPath}: ${msg}`, blocked: false });
      }
    }

    await this.state.removeSession(params.sessionId);
    return { archived };
  }

  /** Undo the last finalized session */
  async undo(sessionId: string): Promise<{ restored: string[] }> {
    SessionLockService.release(this.vaultPath, sessionId);
    const entries = await this.log.readLastSession(sessionId);
    const restored: string[] = [];

    for (const entry of entries) {
      if (entry.action !== 'archive') continue;
      const recovery = await this.log.restore(entry.path);
      if (!recovery) continue;

      try {
        await this.vault.writeNote(entry.path, recovery.content, { overwrite: true });
        // Restore original mtime if available
        if (recovery.mtime) {
          try {
            const fullPath = await this.vault.resolvePath(entry.path);
            const atime = new Date(recovery.mtime);
            const mtime = new Date(recovery.mtime);
            await fs.utimes(fullPath, atime, mtime);
          } catch {
            // best-effort: skip mtime restore if it fails
          }
        }
        await this.log.append({
          sessionId,
          timestamp: new Date().toISOString(),
          action: 'restore',
          path: entry.path,
        });
        restored.push(entry.path);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.audit?.log({ event: 'error', tool: 'dream_undo', message: `undo failed for ${entry.path}: ${msg}`, blocked: false });
      }
    }

    return { restored };
  }

  /** Access a note — updates signal store */
  async touch(relPath: string): Promise<void> {
    this.signals.incrementAccess(relPath);
  }

  /** Set explicit signals for a note */
  async setSignals(relPath: string, signals: Partial<DreamSignals>): Promise<void> {
    this.signals.set(relPath, signals);
  }

  /** Structured log op: CONSOLIDATE — merge source into target and remove source */
  async consolidate(sessionId: string, sourcePath: string, targetPath: string): Promise<{ consolidated: boolean }> {
    try {
      const source = await this.vault.readNote(sourcePath, { includeContent: true });
      const target = await this.vault.readNote(targetPath, { includeContent: true });
      const mergedContent = target.content + '\n\n---\n\n' + source.content;
      await this.vault.writeNote(targetPath, mergedContent, { overwrite: true });
      await this.vault.deleteNote(sourcePath);
      await this.log.append({
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'consolidate',
        path: targetPath,
        originalContent: target.content,
      });
      return { consolidated: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.audit?.log({ event: 'error', tool: 'dream_consolidate', message: `consolidate failed ${sourcePath} → ${targetPath}: ${msg}`, blocked: false });
      return { consolidated: false };
    }
  }

  /** Structured log op: SYNTHESIZE — create a new overview note for a domain */
  async synthesize(sessionId: string, domain: string, proposedTitle: string, paths: string[]): Promise<{ createdPath?: string }> {
    try {
      const lines = [`# ${proposedTitle}`, ``, `Synthesized overview for **${domain}**.`, ``];
      for (const p of paths) {
        const note = await this.vault.readNote(p, { includeContent: false });
        lines.push(`- [[${p.replace(/\.md$/, '')}|${note.title}]]`);
      }
      const content = lines.join('\n');
      const outPath = `${domain}/${proposedTitle.toLowerCase().replace(/\s+/g, '-')}.md`;
      await this.vault.writeNote(outPath, content);
      await this.log.append({
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'synthesize',
        path: outPath,
      });
      return { createdPath: outPath };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.audit?.log({ event: 'error', tool: 'dream_synthesize', message: `synthesize failed for ${domain}: ${msg}`, blocked: false });
      return {};
    }
  }

  /** Structured log op: PRUNE — archive and delete low-value notes */
  async prune(sessionId: string, paths: string[]): Promise<{ pruned: string[] }> {
    const pruned: string[] = [];
    for (const relPath of paths) {
      try {
        const note = await this.vault.readNote(relPath, { includeContent: true });
        const fullPath = await this.vault.resolvePath(relPath);
        const stat = await import('fs').then((fs) => fs.promises.stat(fullPath));
        await this.log.archive(relPath, note.content);
        await this.log.append({
          sessionId,
          timestamp: new Date().toISOString(),
          action: 'prune',
          path: relPath,
          originalContent: note.content,
          originalMtime: stat.mtimeMs,
        });
        await this.vault.deleteNote(relPath);
        pruned.push(relPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.audit?.log({ event: 'error', tool: 'dream_prune', message: `prune failed for ${relPath}: ${msg}`, blocked: false });
      }
    }
    return { pruned };
  }

  close(): void {
    if (this.activeSessionId) {
      SessionLockService.release(this.vaultPath, this.activeSessionId);
    }
    this.signals.close();
    DreamingEngine.creationPromises.delete(this.vaultPath);
  }
}
