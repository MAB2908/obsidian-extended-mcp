import type { DevPrompt, DevSkill, DevAgent, DevWorkflow, DevSystemConfig } from '../../shared/types.js';
import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import { ModelAwareBackupService } from '../../shared/ModelAwareBackupService.js';
/**
 * 4-Level Dev System Engine.
 *
 * Manages Prompts (L1), Skills (L2), Agents (L3), and Workflows (L4)
 * as structured notes inside the Obsidian vault.
 */
export declare class DevSystemEngine {
    private vault;
    private config;
    private mabs?;
    constructor(vault: IVaultManager, config?: Partial<DevSystemConfig>);
    /** Attach Model-Aware Backup Service for automatic artifact versioning */
    attachBackupService(mabs: ModelAwareBackupService): void;
    initialize(): Promise<void>;
    createPrompt(data: Omit<DevPrompt, 'id' | 'created' | 'updated'>): Promise<DevPrompt>;
    getPrompt(id: string): Promise<DevPrompt | null>;
    listPrompts(): Promise<DevPrompt[]>;
    updatePrompt(id: string, updates: Partial<Omit<DevPrompt, 'id' | 'created' | 'updated'>>): Promise<DevPrompt | null>;
    deletePrompt(id: string): Promise<boolean>;
    /**
     * Execute a prompt by substituting variables and returning the rendered text.
     */
    executePrompt(prompt: DevPrompt, variables: Record<string, string>): string;
    createSkill(data: Omit<DevSkill, 'id' | 'created' | 'updated'>): Promise<DevSkill>;
    getSkill(id: string): Promise<DevSkill | null>;
    listSkills(): Promise<DevSkill[]>;
    updateSkill(id: string, updates: Partial<Omit<DevSkill, 'id' | 'created' | 'updated'>>): Promise<DevSkill | null>;
    deleteSkill(id: string): Promise<boolean>;
    /**
     * Render a skill as an executable checklist / algorithm.
     */
    executeSkill(skill: DevSkill, context: Record<string, string>): string;
    createAgent(data: Omit<DevAgent, 'id' | 'created' | 'updated'>): Promise<DevAgent>;
    getAgent(id: string): Promise<DevAgent | null>;
    listAgents(): Promise<DevAgent[]>;
    updateAgent(id: string, updates: Partial<Omit<DevAgent, 'id' | 'created' | 'updated'>>): Promise<DevAgent | null>;
    deleteAgent(id: string): Promise<boolean>;
    createWorkflow(data: Omit<DevWorkflow, 'id' | 'currentPhase' | 'status' | 'created' | 'updated'>): Promise<DevWorkflow>;
    getWorkflow(id: string): Promise<DevWorkflow | null>;
    listWorkflows(): Promise<DevWorkflow[]>;
    updateWorkflow(id: string, updates: Partial<Omit<DevWorkflow, 'id' | 'created' | 'updated'>>): Promise<DevWorkflow | null>;
    deleteWorkflow(id: string): Promise<boolean>;
    advanceWorkflowPhase(id: string): Promise<DevWorkflow | null>;
    failWorkflowPhase(id: string, reason: string): Promise<DevWorkflow | null>;
    getClaudeMd(): Promise<string>;
    appendClaudeMd(section: string, content: string): Promise<void>;
    private serializePrompt;
    private serializeSkill;
    private serializeAgent;
    private serializeWorkflow;
    private isEnoent;
    private readPrompt;
    private readSkill;
    private readAgent;
    private readWorkflow;
    private extractWorkflowPhases;
    private extractSections;
    private parseExamples;
    private writeNote;
    private deleteNote;
    private listFolder;
}
//# sourceMappingURL=DevSystemEngine.d.ts.map