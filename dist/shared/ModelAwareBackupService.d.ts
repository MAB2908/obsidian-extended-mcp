/**
 * Model-Aware Backup System (MABS)
 *
 * Combines CoGit-style version control with Curate Protocol-style
 * artifact curation. Every prompt, skill, agent, and session context
 * is snapshotted, content-addressed, and bound to the AI model that
 * produced or consumed it — while model-agnostic artifacts remain
 * portable across any model.
 */
import type { ModelProfile, ArtifactSnapshot, SessionContextSnapshot, BackupManifest, MABSConfig, DevPrompt, DevSkill, DevAgent, DevWorkflow } from './types.js';
export declare class ModelAwareBackupService {
    private config;
    private profiles;
    private currentProfileId?;
    private objectStorePath;
    private refsPath;
    private manifestPath;
    private manifestQueue;
    /** Simple async mutex for manifest operations (C2) */
    private withManifestLock;
    constructor(vaultPath: string, config?: Partial<MABSConfig>);
    initialize(): Promise<void>;
    /**
     * Register or update a model profile.
     * This should be called whenever LLMAdapter selects or registers a provider.
     */
    registerModelProfile(profile: Omit<ModelProfile, 'id' | 'created' | 'lastUsed'>): Promise<ModelProfile>;
    /** Set the currently active model profile for all subsequent snapshots */
    setCurrentModel(profileId: string): void;
    getCurrentModel(): ModelProfile | undefined;
    listModels(): ModelProfile[];
    /** Derive a stable profile ID from provider + model */
    private deriveProfileId;
    /**
     * Snapshot a DevPrompt. Returns the content-addressed hash.
     */
    snapshotPrompt(prompt: DevPrompt, opts?: {
        message?: string;
        author?: string;
        modelAgnostic?: boolean;
    }): Promise<string>;
    /**
     * Snapshot a DevSkill.
     */
    snapshotSkill(skill: DevSkill, opts?: {
        message?: string;
        author?: string;
        modelAgnostic?: boolean;
    }): Promise<string>;
    /**
     * Snapshot a DevAgent.
     */
    snapshotAgent(agent: DevAgent, opts?: {
        message?: string;
        author?: string;
        modelAgnostic?: boolean;
    }): Promise<string>;
    /**
     * Snapshot a DevWorkflow.
     */
    snapshotWorkflow(workflow: DevWorkflow, opts?: {
        message?: string;
        author?: string;
        modelAgnostic?: boolean;
    }): Promise<string>;
    /**
     * Snapshot CLAUDE.md content.
     */
    snapshotClaudeMd(content: string, opts?: {
        message?: string;
        author?: string;
        modelAgnostic?: boolean;
    }): Promise<string>;
    /**
     * Snapshot bootstrap context (ontology, rules, structure).
     */
    snapshotBootstrap(context: Record<string, unknown>, opts?: {
        message?: string;
        author?: string;
    }): Promise<string>;
    /**
     * Core storage: content-addressable object store (CoGit-style).
     */
    private storeArtifact;
    /** Read artifact content by hash */
    readArtifact(hash: string): Promise<string>;
    /** Get artifact history for a specific artifact ID */
    getArtifactHistory(artifactId: string): Promise<ArtifactSnapshot[]>;
    /** List all model-agnostic artifacts (portable across models) */
    listAgnosticArtifacts(): Promise<ArtifactSnapshot[]>;
    /** List all artifacts bound to a specific model */
    listModelArtifacts(profileId: string): Promise<ArtifactSnapshot[]>;
    /** Import a model-agnostic artifact into the current model's scope */
    importArtifact(hash: string, opts?: {
        message?: string;
        author?: string;
    }): Promise<string>;
    /**
     * Snapshot a session context.
     * Replays the Curate Protocol philosophy: every session is a curation event
     * that can be inspected, audited, and optionally replayed with another model.
     */
    snapshotSessionContext(sessionType: string, payload: Record<string, unknown>, opts?: {
        userIntent?: string;
        replayable?: boolean;
        artifactHashes?: string[];
        profileId?: string;
    }): Promise<SessionContextSnapshot>;
    getSessionHistory(profileId?: string): Promise<SessionContextSnapshot[]>;
    /** Check if a session context can be replayed with a different model */
    canReplaySession(sessionId: string, targetProfileId: string): Promise<{
        canReplay: boolean;
        reason?: string;
    }>;
    private sanitizeRefName;
    writeRef(refName: string, hash: string): Promise<void>;
    readRef(refName: string): Promise<string | undefined>;
    listRefs(prefix?: string): Promise<Record<string, string>>;
    /**
     * Export a complete backup manifest for a model (or all models).
     */
    exportBackup(profileId?: string): Promise<BackupManifest>;
    /**
     * Import a backup manifest. Merges with existing data.
     */
    importBackup(backup: BackupManifest): Promise<void>;
    /** Create a portable bundle (JSON) of model-agnostic artifacts for sharing */
    exportAgnosticBundle(): Promise<string>;
    /** Import a portable bundle of model-agnostic artifacts */
    importAgnosticBundle(bundleJson: string): Promise<number>;
    private loadManifest;
    private saveManifest;
    /** Load manifest without lock — caller must be inside withManifestLock */
    private loadManifestUnlocked;
    /** Save manifest without lock — caller must be inside withManifestLock */
    private saveManifestUnlocked;
    private emptyManifest;
    private buildAgnosticIndex;
    private objectPath;
    private findLatestArtifactHash;
}
//# sourceMappingURL=ModelAwareBackupService.d.ts.map