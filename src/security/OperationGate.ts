// v0.2b:
export interface OperationPolicy {
  readOnly: boolean;
  enableCommands: boolean;
  enableEval: boolean;
  enableBatchEdit: boolean;
  enableDelete: boolean;
}

export class OperationGate {
  private policy: OperationPolicy;

  constructor(policy?: Partial<OperationPolicy>) {
    this.policy = {
      readOnly: false,
      enableCommands: false,
      enableEval: false,
      enableBatchEdit: false,
      enableDelete: false,
      ...policy,
    };
  }

  check(toolName: string, overridePolicy?: Partial<OperationPolicy>): { allowed: boolean; reason?: string } {
    const policy = overridePolicy ? { ...this.policy, ...overridePolicy } : this.policy;
    const writeTools = [
      'write_note', 'append_note', 'patch_note', 'delete_note', 'move_note',
      'write_file', 'manage_tags', 'rollback',
      'ai_ingest', 'ai_compile', 'ai_link', 'ai_tag', 'ai_enrich',
      'pool_add_vault', 'pool_remove_vault',
      'batch_edit', 'build_index',
      'cli_eval', 'cli_plugin', 'cli_command', 'cli_daily', 'cli_properties',
      'dev_prompt_create', 'dev_prompt_delete', 'dev_prompt_execute',
      'dev_skill_create', 'dev_skill_delete', 'dev_skill_execute',
      'dev_agent_create', 'dev_agent_delete',
      'dev_workflow_create', 'dev_workflow_delete', 'dev_workflow_advance', 'dev_workflow_fail',
      'dev_claude_md_append',
      'dream_finalize', 'dream_undo', 'dream_consolidate', 'dream_synthesize', 'dream_prune',
      'mabs_set_current_model', 'mabs_snapshot_artifact', 'mabs_import_backup', 'mabs_import_agnostic_bundle',
    ];
    const commandTools = ['cli_command', 'cli_plugin'];
    const evalTools = ['cli_eval'];
    const batchTools = ['batch_edit'];
    const deleteTools = ['delete_note'];

    if (policy.readOnly && writeTools.some((t) => toolName === t)) {
      return { allowed: false, reason: 'READ_ONLY mode: write operations disabled' };
    }
    if (!policy.enableCommands && commandTools.some((t) => toolName === t)) {
      return { allowed: false, reason: 'Commands disabled by policy' };
    }
    if (!policy.enableEval && evalTools.some((t) => toolName === t)) {
      return { allowed: false, reason: 'Eval disabled by policy' };
    }
    if (!policy.enableBatchEdit && batchTools.some((t) => toolName === t)) {
      return { allowed: false, reason: 'Batch edit disabled by policy' };
    }
    if (!policy.enableDelete && deleteTools.some((t) => toolName === t)) {
      return { allowed: false, reason: 'Delete disabled by policy' };
    }

    return { allowed: true };
  }
}
