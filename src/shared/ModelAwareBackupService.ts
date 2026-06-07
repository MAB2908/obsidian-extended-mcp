// v0.2b:
/**
 * Model-Aware Backup System (MABS)
 *
 * Combines CoGit-style version control with Curate Protocol-style
 * artifact curation. Every prompt, skill, agent, and session context
 * is snapshotted, content-addressed, and bound to the AI model that
 * produced or consumed it — while model-agnostic artifacts remain
 * portable across any model.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { safeJsonParse } from './utils.js';
import { createGunzip, createGzip } from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream';
import type {
  ModelProfile,
  ModelCapability,
  ArtifactSnapshot,
  SessionContextSnapshot,
  BackupManifest,
  MABSConfig,
  DevPrompt,
  DevSkill,
  DevAgent,
  DevWorkflow,
} from './types.js';

const pipe = promisify(pipeline);

const DEFAULT_CONFIG: MABSConfig = {
  backupDir: '.mcp-cache/backups/mabs',
  maxModelBackups: 50,
  autoBackup: true,
  includeSessions: true,
  compress: true,
};

/** Generate a content hash (CoGit-style addressing) */
function contentHash(type: string, content: string): string {
  const payload = `${type} ${Buffer.byteLength(content, 'utf-8')}\0${content}`;
  return createHash('sha256').update(payload).digest('hex');
}

/** Simple gzip helper */
async function gzipString(input: string): Promise<Buffer> {
  const { Readable, PassThrough } = await import('stream');
  const source = Readable.from([input]);
  const dest = new PassThrough();
  const chunks: Buffer[] = [];
  dest.on('data', (c: Buffer) => chunks.push(c));
  await pipe(source, createGzip(), dest);
  return Buffer.concat(chunks);
}

async function gunzipString(input: Buffer): Promise<string> {
  const { Readable, PassThrough } = await import('stream');
  const source = Readable.from([input]);
  const dest = new PassThrough();
  const chunks: Buffer[] = [];
  dest.on('data', (c: Buffer) => chunks.push(c));
  await pipe(source, createGunzip(), dest);
  return Buffer.concat(chunks).toString('utf-8');
}

export class ModelAwareBackupService {
  private config: MABSConfig;
  private profiles = new Map<string, ModelProfile>();
  private currentProfileId?: string;
  private objectStorePath: string;
  private refsPath: string;
  private manifestPath: string;
  private manifestQueue: Promise<void> = Promise.resolve();

  /** Simple async mutex for manifest operations (C2) */
  private async withManifestLock<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.manifestQueue = this.manifestQueue.then(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  constructor(
    vaultPath: string,
    config?: Partial<MABSConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const base = path.join(vaultPath, this.config.backupDir);
    this.objectStorePath = path.join(base, 'objects');
    this.refsPath = path.join(base, 'refs');
    this.manifestPath = path.join(base, 'manifest.json');
  }

  // ─── Lifecycle ───

  async initialize(): Promise<void> {
    await fs.mkdir(this.objectStorePath, { recursive: true });
    await fs.mkdir(this.refsPath, { recursive: true });
    await this.loadManifest();
  }

  // ─── Model Profile Management ───

  /**
   * Register or update a model profile.
   * This should be called whenever LLMAdapter selects or registers a provider.
   */
  async registerModelProfile(profile: Omit<ModelProfile, 'id' | 'created' | 'lastUsed'>): Promise<ModelProfile> {
    const id = this.deriveProfileId(profile.provider, profile.model);
    const existing = this.profiles.get(id);
    const now = new Date().toISOString();
    const full: ModelProfile = {
      ...profile,
      id,
      created: existing?.created ?? now,
      lastUsed: now,
    };
    this.profiles.set(id, full);
    await this.saveManifest();
    return full;
  }

  /** Set the currently active model profile for all subsequent snapshots */
  setCurrentModel(profileId: string): void {
    if (!this.profiles.has(profileId)) {
      throw new Error(`Model profile not found: ${profileId}`);
    }
    this.currentProfileId = profileId;
  }

  getCurrentModel(): ModelProfile | undefined {
    if (!this.currentProfileId) return undefined;
    return this.profiles.get(this.currentProfileId);
  }

  listModels(): ModelProfile[] {
    return Array.from(this.profiles.values()).sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }

  /** Derive a stable profile ID from provider + model */
  private deriveProfileId(provider: string, model: string): string {
    const slug = `${provider}/${model}`.toLowerCase().replace(/[^a-z0-9\/._-]/g, '_');
    return `model-${slug}`;
  }

  // ─── Artifact Snapshots (CoGit objects) ───

  /**
   * Snapshot a DevPrompt. Returns the content-addressed hash.
   */
  async snapshotPrompt(prompt: DevPrompt, opts?: { message?: string; author?: string; modelAgnostic?: boolean }): Promise<string> {
    const content = JSON.stringify(prompt, null, 2);
    return this.storeArtifact({
      type: 'prompt',
      artifactId: prompt.id,
      content,
      message: opts?.message ?? `Snapshot prompt: ${prompt.name}`,
      author: opts?.author ?? 'system',
      modelAgnostic: opts?.modelAgnostic ?? false,
    });
  }

  /**
   * Snapshot a DevSkill.
   */
  async snapshotSkill(skill: DevSkill, opts?: { message?: string; author?: string; modelAgnostic?: boolean }): Promise<string> {
    const content = JSON.stringify(skill, null, 2);
    return this.storeArtifact({
      type: 'skill',
      artifactId: skill.id,
      content,
      message: opts?.message ?? `Snapshot skill: ${skill.name}`,
      author: opts?.author ?? 'system',
      modelAgnostic: opts?.modelAgnostic ?? false,
    });
  }

  /**
   * Snapshot a DevAgent.
   */
  async snapshotAgent(agent: DevAgent, opts?: { message?: string; author?: string; modelAgnostic?: boolean }): Promise<string> {
    const content = JSON.stringify(agent, null, 2);
    return this.storeArtifact({
      type: 'agent',
      artifactId: agent.id,
      content,
      message: opts?.message ?? `Snapshot agent: ${agent.name}`,
      author: opts?.author ?? 'system',
      modelAgnostic: opts?.modelAgnostic ?? false,
    });
  }

  /**
   * Snapshot a DevWorkflow.
   */
  async snapshotWorkflow(workflow: DevWorkflow, opts?: { message?: string; author?: string; modelAgnostic?: boolean }): Promise<string> {
    const content = JSON.stringify(workflow, null, 2);
    return this.storeArtifact({
      type: 'workflow',
      artifactId: workflow.id,
      content,
      message: opts?.message ?? `Snapshot workflow: ${workflow.name}`,
      author: opts?.author ?? 'system',
      modelAgnostic: opts?.modelAgnostic ?? false,
    });
  }

  /**
   * Snapshot CLAUDE.md content.
   */
  async snapshotClaudeMd(content: string, opts?: { message?: string; author?: string; modelAgnostic?: boolean }): Promise<string> {
    return this.storeArtifact({
      type: 'claude-md',
      artifactId: 'CLAUDE.md',
      content,
      message: opts?.message ?? 'Snapshot CLAUDE.md',
      author: opts?.author ?? 'system',
      modelAgnostic: opts?.modelAgnostic ?? true,
    });
  }

  /**
   * Snapshot bootstrap context (ontology, rules, structure).
   */
  async snapshotBootstrap(context: Record<string, unknown>, opts?: { message?: string; author?: string }): Promise<string> {
    const content = JSON.stringify(context, null, 2);
    return this.storeArtifact({
      type: 'bootstrap',
      artifactId: 'bootstrap-context',
      content,
      message: opts?.message ?? 'Snapshot bootstrap context',
      author: opts?.author ?? 'system',
      modelAgnostic: true,
    });
  }

  /**
   * Core storage: content-addressable object store (CoGit-style).
   */
  private async storeArtifact(partial: Omit<ArtifactSnapshot, 'hash' | 'timestamp' | 'modelProfileId' | 'parentHash'>): Promise<string> {
    const profile = this.getCurrentModel();
    if (!profile) {
      throw new Error('No current model profile set. Call setCurrentModel() before snapshotting.');
    }

    const hash = contentHash(partial.type, partial.content);
    const objectPath = this.objectPath(hash);

    // Write object if not exists (deduplication)
    try {
      await fs.access(objectPath);
    } catch {
      const data = this.config.compress
        ? await gzipString(partial.content)
        : Buffer.from(partial.content, 'utf-8');
      await fs.mkdir(path.dirname(objectPath), { recursive: true });
      await fs.writeFile(objectPath, data);
    }

    // Find parent hash for versioning chain
    const parentHash = await this.findLatestArtifactHash(partial.type, partial.artifactId, profile.id);

    const snapshot: ArtifactSnapshot = {
      ...partial,
      hash,
      timestamp: new Date().toISOString(),
      modelProfileId: profile.id,
      parentHash,
    };

    // Append to manifest atomically (C2)
    await this.withManifestLock(async () => {
      const manifest = await this.loadManifestUnlocked();
      manifest.artifacts.push(snapshot);
      // Deduplicate by (hash, modelProfileId) — allow same artifact across different models
      const seen = new Set<string>();
      manifest.artifacts = manifest.artifacts.filter((a) => {
        const key = `${a.hash}:${a.modelProfileId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await this.saveManifestUnlocked(manifest);
    });

    // Update ref (HEAD for this artifact)
    await this.writeRef(`artifacts/${partial.artifactId}`, hash);

    return hash;
  }

  /** Read artifact content by hash */
  async readArtifact(hash: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      throw new Error('Invalid artifact hash format');
    }
    const objectPath = this.objectPath(hash);
    const data = await fs.readFile(objectPath);
    if (this.config.compress) {
      return gunzipString(data);
    }
    return data.toString('utf-8');
  }

  /** Get artifact history for a specific artifact ID */
  async getArtifactHistory(artifactId: string): Promise<ArtifactSnapshot[]> {
    const manifest = await this.loadManifest();
    return manifest.artifacts
      .filter((a) => a.artifactId === artifactId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /** List all model-agnostic artifacts (portable across models) */
  async listAgnosticArtifacts(): Promise<ArtifactSnapshot[]> {
    const manifest = await this.loadManifest();
    const latest = new Map<string, ArtifactSnapshot>();
    for (const a of manifest.artifacts) {
      if (!a.modelAgnostic) continue;
      const existing = latest.get(a.artifactId);
      if (!existing || new Date(a.timestamp) > new Date(existing.timestamp)) {
        latest.set(a.artifactId, a);
      }
    }
    return Array.from(latest.values());
  }

  /** List all artifacts bound to a specific model */
  async listModelArtifacts(profileId: string): Promise<ArtifactSnapshot[]> {
    const manifest = await this.loadManifest();
    const latest = new Map<string, ArtifactSnapshot>();
    for (const a of manifest.artifacts) {
      if (a.modelProfileId !== profileId) continue;
      const existing = latest.get(a.artifactId);
      if (!existing || new Date(a.timestamp) > new Date(existing.timestamp)) {
        latest.set(a.artifactId, a);
      }
    }
    return Array.from(latest.values());
  }

  /** Import a model-agnostic artifact into the current model's scope */
  async importArtifact(hash: string, opts?: { message?: string; author?: string }): Promise<string> {
    const content = await this.readArtifact(hash);
    const manifest = await this.loadManifest();
    const original = manifest.artifacts.find((a) => a.hash === hash);
    if (!original) throw new Error(`Artifact not found: ${hash}`);

    return this.storeArtifact({
      type: original.type,
      artifactId: original.artifactId,
      content,
      message: opts?.message ?? `Imported from ${original.modelProfileId}: ${original.message}`,
      author: opts?.author ?? 'system',
      modelAgnostic: original.modelAgnostic,
    });
  }

  // ─── Session Context Snapshots (Curate Protocol-style) ───

  /**
   * Snapshot a session context.
   * Replays the Curate Protocol philosophy: every session is a curation event
   * that can be inspected, audited, and optionally replayed with another model.
   */
  async snapshotSessionContext(
    sessionType: string,
    payload: Record<string, unknown>,
    opts?: {
      userIntent?: string;
      replayable?: boolean;
      artifactHashes?: string[];
      profileId?: string;
    }
  ): Promise<SessionContextSnapshot> {
    const profile = opts?.profileId ? this.profiles.get(opts.profileId) : this.getCurrentModel();
    if (!profile) {
      throw new Error('No current model profile set.');
    }

    const snapshot: SessionContextSnapshot = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      modelProfileId: profile.id,
      sessionType,
      timestamp: new Date().toISOString(),
      payload,
      artifactHashes: opts?.artifactHashes ?? [],
      userIntent: opts?.userIntent,
      replayable: opts?.replayable ?? true,
    };

    await this.withManifestLock(async () => {
      const manifest = await this.loadManifestUnlocked();
      if (this.config.includeSessions) {
        manifest.sessions.push(snapshot);
        // Prune old sessions per model
        const modelSessions = manifest.sessions.filter((s) => s.modelProfileId === profile.id);
        if (modelSessions.length > this.config.maxModelBackups) {
          const toRemove = modelSessions.length - this.config.maxModelBackups;
          const sorted = modelSessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const removeIds = new Set(sorted.slice(0, toRemove).map((s) => s.id));
          manifest.sessions = manifest.sessions.filter((s) => !removeIds.has(s.id));
        }
      }
      await this.saveManifestUnlocked(manifest);
    });
    return snapshot;
  }

  async getSessionHistory(profileId?: string): Promise<SessionContextSnapshot[]> {
    const manifest = await this.loadManifest();
    let sessions = manifest.sessions;
    if (profileId) {
      sessions = sessions.filter((s) => s.modelProfileId === profileId);
    }
    return sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /** Check if a session context can be replayed with a different model */
  async canReplaySession(sessionId: string, targetProfileId: string): Promise<{ canReplay: boolean; reason?: string }> {
    const manifest = await this.loadManifest();
    const session = manifest.sessions.find((s) => s.id === sessionId);
    if (!session) return { canReplay: false, reason: 'Session not found' };
    if (!session.replayable) return { canReplay: false, reason: 'Session marked as non-replayable' };

    const target = this.profiles.get(targetProfileId);
    if (!target) return { canReplay: false, reason: 'Target model profile not found' };

    // Check capability compatibility
    const source = this.profiles.get(session.modelProfileId);
    if (source && target) {
      // If target lacks required capabilities, warn but don't block
      const required: ModelCapability[] = ['chat'];
      const missing = required.filter((c) => !target.capabilities.includes(c));
      if (missing.length > 0) {
        return { canReplay: true, reason: `Warning: target model lacks capabilities: ${missing.join(', ')}` };
      }
    }

    return { canReplay: true };
  }

  // ─── CoGit-style Refs ───

  private sanitizeRefName(refName: string): string {
    const normalized = path.normalize(refName).replace(/\\/g, '/');
    if (normalized.includes('../') || normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new Error(`Invalid ref name: ${refName}`);
    }
    const refPath = path.join(this.refsPath, normalized);
    const resolved = path.resolve(refPath);
    const resolvedBase = path.resolve(this.refsPath);
    const sep = path.sep;
    if (!resolved.startsWith(resolvedBase + sep) && resolved !== resolvedBase) {
      throw new Error(`Ref escapes refs directory: ${refName}`);
    }
    return normalized;
  }

  async writeRef(refName: string, hash: string): Promise<void> {
    const safeName = this.sanitizeRefName(refName);
    const refPath = path.join(this.refsPath, safeName);
    await fs.mkdir(path.dirname(refPath), { recursive: true });
    await fs.writeFile(refPath, hash, 'utf-8');
  }

  async readRef(refName: string): Promise<string | undefined> {
    try {
      const safeName = this.sanitizeRefName(refName);
      const refPath = path.join(this.refsPath, safeName);
      return await fs.readFile(refPath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  async listRefs(prefix?: string): Promise<Record<string, string>> {
    const refs: Record<string, string> = {};
    const walk = async (dir: string, rel: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          await walk(full, r);
        } else if (!prefix || r.startsWith(prefix)) {
          refs[r] = await fs.readFile(full, 'utf-8');
        }
      }
    };
    try {
      await walk(this.refsPath, '');
    } catch {
      // refs dir may be empty
    }
    return refs;
  }

  // ─── Full Backup / Restore ───

  /**
   * Export a complete backup manifest for a model (or all models).
   */
  async exportBackup(profileId?: string): Promise<BackupManifest> {
    const manifest = await this.loadManifest();
    if (!profileId) return manifest;

    const model = this.profiles.get(profileId);
    if (!model) throw new Error(`Model profile not found: ${profileId}`);

    const artifacts = manifest.artifacts.filter((a) => a.modelProfileId === profileId || a.modelAgnostic);
    const sessions = manifest.sessions.filter((s) => s.modelProfileId === profileId);
    const agnosticIndex = this.buildAgnosticIndex(artifacts);
    const refs = await this.listRefs();

    return {
      version: manifest.version,
      createdAt: new Date().toISOString(),
      models: [model],
      artifacts,
      sessions,
      agnosticIndex,
      refs,
    };
  }

  /**
   * Import a backup manifest. Merges with existing data.
   */
  async importBackup(backup: BackupManifest): Promise<void> {
    await this.withManifestLock(async () => {
      const manifest = await this.loadManifestUnlocked();

      // Merge models
      for (const model of backup.models) {
        this.profiles.set(model.id, model);
      }

      // Merge artifacts (deduplicate by hash)
      const existingHashes = new Set(manifest.artifacts.map((a) => a.hash));
      for (const artifact of backup.artifacts) {
        if (!existingHashes.has(artifact.hash)) {
          manifest.artifacts.push(artifact);
          existingHashes.add(artifact.hash);
        }
      }

      // Merge sessions (deduplicate by id)
      const existingSessionIds = new Set(manifest.sessions.map((s) => s.id));
      for (const session of backup.sessions) {
        if (!existingSessionIds.has(session.id)) {
          manifest.sessions.push(session);
          existingSessionIds.add(session.id);
        }
      }

      manifest.createdAt = new Date().toISOString();
      await this.saveManifestUnlocked(manifest);
    });

    // Restore refs (outside lock — refs are independent files)
    for (const [refName, hash] of Object.entries(backup.refs)) {
      await this.writeRef(refName, hash);
    }
  }

  /** Create a portable bundle (JSON) of model-agnostic artifacts for sharing */
  async exportAgnosticBundle(): Promise<string> {
    const artifacts = await this.listAgnosticArtifacts();
    const enriched = await Promise.all(
      artifacts.map(async (a) => ({
        ...a,
        content: await this.readArtifact(a.hash),
      }))
    );
    return JSON.stringify({ version: 1, timestamp: new Date().toISOString(), artifacts: enriched }, null, 2);
  }

  /** Import a portable bundle of model-agnostic artifacts */
  async importAgnosticBundle(bundleJson: string): Promise<number> {
    let bundle: { version: number; artifacts: Array<ArtifactSnapshot & { content: string }> };
    try {
      bundle = safeJsonParse(bundleJson) as { version: number; artifacts: Array<ArtifactSnapshot & { content: string }> };
    } catch {
      throw new Error('Invalid bundle JSON');
    }
    let imported = 0;
    // Collect all valid artifacts first (outside lock)
    const toAdd: Array<ArtifactSnapshot & { content: string }> = [];
    for (const artifact of bundle.artifacts) {
      const hash = contentHash(artifact.type, artifact.content);
      if (hash !== artifact.hash) {
        console.warn(`[MABS] Hash mismatch for artifact ${artifact.artifactId}, skipping`);
        continue;
      }
      // Store object
      const objectPath = this.objectPath(hash);
      try {
        await fs.access(objectPath);
      } catch {
        const data = this.config.compress
          ? await gzipString(artifact.content)
          : Buffer.from(artifact.content, 'utf-8');
        await fs.mkdir(path.dirname(objectPath), { recursive: true });
        await fs.writeFile(objectPath, data);
      }
      toAdd.push(artifact);
    }

    // Atomic manifest update (C2)
    await this.withManifestLock(async () => {
      const manifest = await this.loadManifestUnlocked();
      const existingHashes = new Set(manifest.artifacts.map((a) => a.hash));
      for (const artifact of toAdd) {
        if (!existingHashes.has(artifact.hash)) {
          manifest.artifacts.push({
            ...artifact,
            parentHash: undefined,
          });
          existingHashes.add(artifact.hash);
          imported++;
        }
      }
      await this.saveManifestUnlocked(manifest);
    });

    return imported;
  }

  // ─── Manifest Management ───

  private async loadManifest(): Promise<BackupManifest> {
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf-8');
      const parsed = safeJsonParse(raw) as BackupManifest;
      // Rehydrate profiles Map
      for (const model of parsed.models) {
        this.profiles.set(model.id, model);
      }
      return parsed;
    } catch {
      return this.emptyManifest();
    }
  }

  private async saveManifest(manifest?: BackupManifest): Promise<void> {
    await this.withManifestLock(async () => {
      const m = manifest ?? (await this.loadManifestUnlocked());
      await this.saveManifestUnlocked(m);
    });
  }

  /** Load manifest without lock — caller must be inside withManifestLock */
  private async loadManifestUnlocked(): Promise<BackupManifest> {
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf-8');
      const parsed = safeJsonParse(raw) as BackupManifest;
      for (const model of parsed.models) {
        this.profiles.set(model.id, model);
      }
      return parsed;
    } catch {
      return this.emptyManifest();
    }
  }

  /** Save manifest without lock — caller must be inside withManifestLock */
  private async saveManifestUnlocked(manifest: BackupManifest): Promise<void> {
    manifest.models = Array.from(this.profiles.values());
    manifest.agnosticIndex = this.buildAgnosticIndex(manifest.artifacts);
    await fs.mkdir(path.dirname(this.manifestPath), { recursive: true });
    const tempPath = `${this.manifestPath}.tmp-${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf-8');
    await fs.copyFile(tempPath, this.manifestPath);
    await fs.unlink(tempPath);
  }

  private emptyManifest(): BackupManifest {
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      models: [],
      artifacts: [],
      sessions: [],
      agnosticIndex: {},
      refs: {},
    };
  }

  private buildAgnosticIndex(artifacts: ArtifactSnapshot[]): Record<string, string[]> {
    const index: Record<string, string[]> = {};
    for (const a of artifacts) {
      if (!a.modelAgnostic) continue;
      if (!index[a.type]) index[a.type] = [];
      if (!index[a.type].includes(a.artifactId)) {
        index[a.type].push(a.artifactId);
      }
    }
    return index;
  }

  private objectPath(hash: string): string {
    const prefix = hash.slice(0, 2);
    return path.join(this.objectStorePath, prefix, hash);
  }

  private async findLatestArtifactHash(type: string, artifactId: string, profileId: string): Promise<string | undefined> {
    const manifest = await this.loadManifest();
    const matches = manifest.artifacts.filter(
      (a) => a.type === type && a.artifactId === artifactId && a.modelProfileId === profileId
    );
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].hash;
  }
}
