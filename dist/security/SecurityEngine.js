import { ApprovalEngine } from './ApprovalEngine.js';
import { timingSafeEqual } from 'crypto';
import path from 'path';
import { realpathSync } from 'fs';
export class SecurityEngine {
    policy;
    acl;
    gate;
    audit;
    sandbox;
    approval;
    constructor(policy, acl, gate, audit, sandbox, approval = new ApprovalEngine()) {
        this.policy = policy;
        this.acl = acl;
        this.gate = gate;
        this.audit = audit;
        this.sandbox = sandbox;
        this.approval = approval;
    }
    authorize(toolName, args) {
        const rawVaultPath = args?.vaultPath;
        const vaultPath = typeof rawVaultPath === 'string' && rawVaultPath.length > 0 ? rawVaultPath : '';
        const auditMeta = vaultPath ? { vaultPath } : {};
        // 1. Operation gating
        const gateResult = this.gate.check(toolName, this.policy.operations);
        if (!gateResult.allowed) {
            const result = { allowed: false, reason: gateResult.reason };
            this.audit.log({ event: 'security', tool: toolName, reason: gateResult.reason, blocked: true, ...auditMeta });
            return result;
        }
        // 2. Folder ACL
        const rawFilePath = args?.path ?? args?.from ?? args?.raw_path ?? args?.file ?? args?.folder ?? args?.dest ?? '';
        const filePath = typeof rawFilePath === 'string' ? rawFilePath : (rawFilePath !== undefined && rawFilePath !== null ? String(rawFilePath) : '');
        if (filePath) {
            const folders = this.policy.folders;
            if (this.isReadOp(toolName) && !this.acl.isReadAllowed(filePath, folders)) {
                const reason = 'Read not allowed for this path';
                this.audit.log({ event: 'security', tool: toolName, message: filePath, reason, blocked: true, ...auditMeta });
                return { allowed: false, reason };
            }
            if (this.isWriteOp(toolName) && !this.acl.isWriteAllowed(filePath, folders)) {
                const reason = 'Write not allowed for this path';
                this.audit.log({ event: 'security', tool: toolName, message: filePath, reason, blocked: true, ...auditMeta });
                return { allowed: false, reason };
            }
        }
        // move_note also needs destination checked (H7 — source covered by general filePath check via args.from)
        if (toolName === 'move_note') {
            const rawToPath = args?.to;
            const toPath = typeof rawToPath === 'string' && rawToPath.length > 0 ? rawToPath : '';
            if (toPath && !this.acl.isWriteAllowed(toPath, this.policy.folders)) {
                const reason = 'Write not allowed for destination path';
                this.audit.log({ event: 'security', tool: toolName, message: toPath, reason, blocked: true, ...auditMeta });
                return { allowed: false, reason };
            }
        }
        // 2.5. Dev-system tools path traversal guard
        if (toolName.startsWith('dev_') && this.isWriteOp(toolName)) {
            const devId = args?.id ?? args?.name ?? args?.workflowId ?? '';
            if (typeof devId === 'string' && (devId.includes('..') || devId.includes('/'))) {
                const reason = 'Dev system id contains forbidden characters';
                this.audit.log({ event: 'security', tool: toolName, message: devId, reason, blocked: true, ...auditMeta });
                return { allowed: false, reason };
            }
        }
        // 2.6. allowedRoots check for pool_add_vault (with realpath symlink resolution)
        if (toolName === 'pool_add_vault') {
            const newVaultPath = typeof args?.path === 'string' ? args.path : '';
            if (newVaultPath) {
                let resolved;
                try {
                    resolved = realpathSync(newVaultPath);
                }
                catch {
                    resolved = path.resolve(newVaultPath);
                }
                const allowedRoots = this.policy.vault?.allowedRoots;
                if (allowedRoots && allowedRoots.length > 0) {
                    const isAllowed = allowedRoots.some((root) => {
                        let resolvedRoot;
                        try {
                            resolvedRoot = realpathSync(root);
                        }
                        catch {
                            resolvedRoot = path.resolve(root);
                        }
                        const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
                        return resolved.startsWith(rootWithSep) || resolved === resolvedRoot;
                    });
                    if (!isAllowed) {
                        const reason = `Vault path not in allowed roots: ${allowedRoots.join(', ')}`;
                        this.audit.log({ event: 'security', tool: toolName, message: newVaultPath, reason, blocked: true, ...auditMeta });
                        return { allowed: false, reason };
                    }
                }
            }
        }
        // 2.7. Default-deny: unclassified tools must not bypass ACL (C5)
        if (!this.isReadOp(toolName) && !this.isWriteOp(toolName, args)) {
            const reason = `Tool ${toolName} is not classified and requires explicit security classification`;
            this.audit.log({ event: 'security', tool: toolName, reason, blocked: true, ...auditMeta });
            return { allowed: false, reason };
        }
        // 3. Approval level
        const level = this.approval.getApprovalLevel(toolName, args, this.policy.folders?.safeZones);
        if (this.approval.requiresConfirmation(level) && this.policy.approval?.mode !== 'auto') {
            const mode = this.policy.approval?.mode ?? 'auto';
            const reason = `Approval level ${level} requires explicit confirmation in ${mode} mode`;
            this.audit.log({ event: 'security', tool: toolName, level: 'security', args: { approvalLevel: level }, reason, blocked: true, ...auditMeta });
            return { allowed: false, level, reason };
        }
        // 3.5. Opt-in check for cli_eval and cli_plugin install/uninstall
        if (this.approval.requiresOptIn(level) && !this.policy.approval?.optInTools?.includes(toolName)) {
            const reason = `Tool ${toolName} requires explicit opt-in`;
            this.audit.log({ event: 'security', tool: toolName, level: 'security', args: { approvalLevel: level }, reason, blocked: true, ...auditMeta });
            return { allowed: false, level, reason };
        }
        // 4. Audit successful authorization
        this.audit.log({ event: 'auth', tool: toolName, message: filePath, level: 'info', args: { approvalLevel: level }, ...auditMeta });
        return { allowed: true, level };
    }
    verifyToken(provided) {
        const expected = this.policy.transport?.token;
        if (!expected)
            return { valid: true }; // dev mode, no token required
        const MAX_TOKEN_LENGTH = 4096;
        if (!provided || provided.length < 32) {
            return { valid: false, reason: 'Token missing or too short' };
        }
        if (provided.length > MAX_TOKEN_LENGTH) {
            return { valid: false, reason: `Token exceeds maximum length of ${MAX_TOKEN_LENGTH}` };
        }
        try {
            const a = Buffer.from(provided);
            const b = Buffer.from(expected);
            // Constant-time comparison: pad the shorter buffer to match length
            let compareA = a;
            let compareB = b;
            if (a.length < b.length) {
                const padded = Buffer.alloc(b.length);
                a.copy(padded);
                compareA = padded;
            }
            else if (b.length < a.length) {
                const padded = Buffer.alloc(a.length);
                b.copy(padded);
                compareB = padded;
            }
            if (timingSafeEqual(compareA, compareB)) {
                // Additional length check after constant-time comparison to prevent
                // false positives from padding
                if (a.length === b.length) {
                    return { valid: true };
                }
            }
            return { valid: false, reason: 'Invalid token' };
        }
        catch {
            return { valid: false, reason: 'Token verification failed' };
        }
    }
    isReadOp(toolName) {
        // Exact read tools
        const readTools = ['read_note', 'read_file', 'list_directory', 'search_notes', 'get_vault_stats', 'list_all_tags', 'get_vault_rules', 'validate_note', 'graph_neighbors', 'graph_analyze_centrality', 'graph_detect_communities', 'bm25_search', 'semantic_search', 'semantic_search_db', 'db_stats', 'audit_log', 'audit_remote_status', 'list_backups', 'cli_backlinks', 'cli_orphans', 'cli_deadends', 'cli_unresolved', 'cli_search', 'cli_properties', 'cli_daily', 'ai_query', 'rest_active_note', 'rest_dataview', 'rest_get_note', 'rest_list_tags', 'rest_search', 'get_context_bootstrap', 'pool_list_vaults', 'fs_list_notes', 'fs_get_graph', 'fs_graph_find_path', 'semantic_rag', 'dream_scan', 'auto_dream_status'];
        if (readTools.includes(toolName))
            return true;
        if (toolName.startsWith('read_') || toolName.startsWith('search_') || toolName.startsWith('list_') || toolName.startsWith('get_'))
            return true;
        // Dev system read operations
        // MABS read operations
        const mabsReadOps = ['mabs_list_models', 'mabs_list_artifacts', 'mabs_artifact_history', 'mabs_list_sessions', 'mabs_can_replay', 'mabs_export_backup', 'mabs_export_agnostic_bundle'];
        if (mabsReadOps.includes(toolName))
            return true;
        const devReadOps = ['dev_prompt_list', 'dev_prompt_get', 'dev_skill_list', 'dev_skill_get', 'dev_agent_list', 'dev_agent_get', 'dev_workflow_list', 'dev_workflow_get', 'dev_claude_md_get'];
        return devReadOps.includes(toolName);
    }
    isWriteOp(toolName, args) {
        // Explicitly destructive CLI / REST tools
        const destructiveCli = ['cli_eval', 'cli_plugin', 'cli_command', 'rest_execute_command'];
        const restWriteTools = ['rest_write_note', 'rest_delete_note'];
        // Unclassified tools that need write classification
        const unclassifiedWrite = ['build_index'];
        if (unclassifiedWrite.includes(toolName))
            return true;
        // cli_properties and cli_daily are read-only when action is read/list (HIGH-002)
        if (toolName === 'cli_properties') {
            const action = args?.action;
            if (action === 'read' || action === 'list')
                return false;
            return true;
        }
        if (toolName === 'cli_daily') {
            const action = args?.action;
            if (action === 'read')
                return false;
            return true;
        }
        if (destructiveCli.includes(toolName))
            return true;
        if (restWriteTools.includes(toolName))
            return true;
        if (toolName === 'audit_purge')
            return true;
        const aiWriteTools = ['ai_ingest', 'ai_compile', 'ai_link', 'ai_link_batch', 'ai_tag', 'ai_enrich'];
        if (aiWriteTools.includes(toolName))
            return true;
        if (toolName.startsWith('write_') || toolName.startsWith('append_') || toolName.startsWith('patch_') || toolName.startsWith('delete_') || toolName.startsWith('move_'))
            return true;
        if (toolName === 'batch_edit' || toolName === 'manage_tags' || toolName === 'rollback' || toolName === 'pool_add_vault' || toolName === 'pool_remove_vault')
            return true;
        // Dreaming write operations
        const dreamWriteOps = ['dream_finalize', 'dream_undo', 'auto_dream_run', 'auto_dream_install_scheduler'];
        if (dreamWriteOps.includes(toolName))
            return true;
        // MABS write operations
        const mabsWriteOps = ['mabs_set_current_model', 'mabs_snapshot_artifact', 'mabs_import_backup', 'mabs_import_agnostic_bundle'];
        if (mabsWriteOps.includes(toolName))
            return true;
        // Dev system write operations
        const devWriteOps = ['dev_prompt_create', 'dev_prompt_delete', 'dev_prompt_execute', 'dev_skill_create', 'dev_skill_delete', 'dev_skill_execute', 'dev_agent_create', 'dev_agent_delete', 'dev_workflow_create', 'dev_workflow_delete', 'dev_workflow_advance', 'dev_workflow_fail', 'dev_claude_md_append'];
        return devWriteOps.includes(toolName);
    }
}
//# sourceMappingURL=SecurityEngine.js.map