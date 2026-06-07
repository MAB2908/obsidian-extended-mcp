// v0.2b:
import type { VaultPool } from './VaultPool.js';
import type { VaultEntry } from './VaultPool.js';
import { VaultPathNotFoundError } from '../../shared/errors.js';
import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { ISemanticDatabase } from '../../shared/interfaces/ISemanticDatabase.js';
import type { IBackgroundIndexer } from '../../shared/interfaces/IBackgroundIndexer.js';
import type { IPipelineOrchestrator } from '../../shared/interfaces/IPipelineOrchestrator.js';
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import type { IDreamingEngine } from '../../shared/interfaces/IDreamingEngine.js';

export interface VaultContext {
  vaultPath: string;
  vault: IVaultManager;
  graph: IGraphEngine;
  bm25: IBM25Engine;
  semanticDb: ISemanticDatabase;
  indexer?: IBackgroundIndexer;
  pipeline?: IPipelineOrchestrator;
  vector?: IVectorEngine;
  dreaming?: IDreamingEngine;
}

export class VaultRouter {
  constructor(
    private pool: VaultPool,
    private defaultVaultPath: string
  ) {}

  resolve(args: Record<string, unknown>): VaultContext {
    const entry = this.resolveEntry(args);
    if (!entry) {
      const lookup = (args.vaultPath as string) || (args.vaultName as string) || (args.vaultTag as string) || this.defaultVaultPath;
      throw new VaultPathNotFoundError(lookup);
    }
    return {
      vaultPath: entry.vault.root,
      vault: entry.vault,
      graph: entry.graph,
      bm25: entry.bm25,
      semanticDb: entry.semanticDb,
      indexer: entry.indexer,
      pipeline: entry.pipeline,
      vector: entry.vector,
      get dreaming() { return entry.dreaming; },
      set dreaming(v) { entry.dreaming = v; },
    };
  }

  resolveOptional(args: Record<string, unknown>): VaultContext | null {
    const entry = this.resolveEntry(args);
    if (!entry) return null;
    return {
      vaultPath: entry.vault.root,
      vault: entry.vault,
      graph: entry.graph,
      bm25: entry.bm25,
      semanticDb: entry.semanticDb,
      indexer: entry.indexer,
      pipeline: entry.pipeline,
      vector: entry.vector,
      get dreaming() { return entry.dreaming; },
      set dreaming(v) { entry.dreaming = v; },
    };
  }

  /** Get per-vault config override if present */
  getVaultConfig(args: Record<string, unknown>): Record<string, unknown> | undefined {
    const entry = this.resolveEntry(args);
    return entry?.config;
  }

  private resolveEntry(args: Record<string, unknown>): VaultEntry | undefined {
    const vaultPath = args.vaultPath as string | undefined;
    const vaultName = args.vaultName as string | undefined;
    const vaultTag = args.vaultTag as string | undefined;

    if (vaultPath) {
      return this.pool.getEntry(vaultPath);
    }
    if (vaultName) {
      return this.pool.getByName(vaultName);
    }
    if (vaultTag) {
      return this.pool.getByTag(vaultTag);
    }
    return this.pool.getEntry(this.defaultVaultPath);
  }
}
