// v0.2b:
import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import type { AuditLogger, GdprPurgeCriteria } from '../security/AuditLogger.js';
import type { SecurityEngine } from '../security/SecurityEngine.js';
import { BatchEditGuard } from '../security/BatchEditGuard.js';
import { securityConfig } from '../shared/config.js';

export function createSecurityTools(
  resolveVault: (args: Record<string, unknown>) => VaultContext,
  audit: AuditLogger,
  security: SecurityEngine
): ToolHandler[] {
  return [
    {
      name: 'audit_log',
      description: 'Get recent audit log entries',
      inputSchema: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          tool: { type: 'string' },
          limit: { type: 'number' },
        },
      },
      handler: async (args) => {
        const { event, tool, limit } = args as { event?: string; tool?: string; limit?: number };
        const entries = await audit.query({ event, tool, limit });
        return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
      },
    },
    {
      name: 'audit_remote_status',
      description: 'Get status of the remote audit sink',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        if (!securityConfig.enableAudit) {
          return {
            content: [{ type: 'text', text: 'audit_remote_status is disabled. Set ENABLE_AUDIT=true to enable.' }],
            isError: true,
          };
        }
        const status = audit.getRemoteStatus();
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      },
    },
    {
      name: 'audit_purge',
      description: 'Rotate audit logs by age or purge entries by GDPR criteria',
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['age', 'gdpr'] },
          criteria: {
            type: 'object',
            description: 'GDPR criteria: sessionId, path, before, after, operation',
            properties: {
              sessionId: { type: 'string' },
              path: { type: 'string' },
              before: { type: 'string' },
              after: { type: 'string' },
              operation: { type: 'string' },
            },
          },
        },
        required: ['mode'],
      },
      handler: async (args) => {
        if (!securityConfig.enableAudit || !securityConfig.enableDelete) {
          return {
            content: [{ type: 'text', text: 'audit_purge is disabled. Set ENABLE_AUDIT=true and ENABLE_DELETE=true to enable.' }],
            isError: true,
          };
        }
        const { mode, criteria } = args as { mode: 'age' | 'gdpr'; criteria?: GdprPurgeCriteria };
        try {
          if (mode === 'age') {
            const removed = await audit.rotateByAge();
            return { content: [{ type: 'text', text: `Age-based rotation removed ${removed} entries.` }] };
          }
          if (mode === 'gdpr') {
            const removed = await audit.gdprPurge(criteria ?? {});
            return { content: [{ type: 'text', text: `GDPR purge removed ${removed} entries.` }] };
          }
          return { content: [{ type: 'text', text: `Invalid mode: ${mode}` }], isError: true };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `audit_purge failed: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      },
    },
    {
      name: 'list_backups',
      description: 'List available backups of vault notes',
      inputSchema: { type: 'object', properties: { vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } } },
      handler: async (args) => {
        const ctx = resolveVault(args as Record<string, unknown>);
        const backups = await ctx.vault.listBackups();
        return { content: [{ type: 'text', text: JSON.stringify(backups, null, 2) }] };
      },
    },
    {
      name: 'rollback',
      description: 'Rollback a note to a previous backup',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, timestamp: { type: 'string' }, vaultPath: { type: 'string', description: 'Optional vault path (multi-vault mode)' } },
        required: ['path'],
      },
      handler: async (args) => {
        const { path, timestamp } = args as { path: string; timestamp?: string };
        const ctx = resolveVault(args as Record<string, unknown>);
        await ctx.vault.rollback(path, timestamp);
        return { content: [{ type: 'text', text: `Rolled back ${path}` }] };
      },
    },
    {
      name: 'batch_edit',
      description: 'Apply a transformation to multiple notes matching criteria. Set preview=true to see changes without applying.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'object', properties: { folder: { type: 'string' }, glob: { type: 'string' }, tag: { type: 'string' } } },
          operation: { type: 'string', enum: ['replace', 'prepend', 'append', 'rename_tag'] },
          target: { type: 'string' },
          replacement: { type: 'string' },
          preview: { type: 'boolean' },
        },
        required: ['filter', 'operation', 'target'],
      },
      handler: async (args) => {
        if (!securityConfig.enableBatchEdit) {
          return { content: [{ type: 'text', text: 'batch_edit is disabled. Set ENABLE_BATCH_EDIT=true to enable.' }], isError: true };
        }
        const { filter, operation, target, replacement, preview } = args as {
          filter: { folder?: string; glob?: string; tag?: string };
          operation: 'replace' | 'prepend' | 'append' | 'rename_tag';
          target: string;
          replacement?: string;
          preview?: boolean;
        };
        if (!filter || typeof filter !== 'object') {
          return { content: [{ type: 'text', text: 'batch_edit requires a filter object with folder, glob, or tag properties.' }], isError: true };
        }
        const ctx = resolveVault(args as Record<string, unknown>);
        const auth = security.authorize('batch_edit', args as Record<string, unknown>);
        if (!auth.allowed) {
          audit.log({ event: 'security', tool: 'batch_edit', reason: auth.reason, blocked: true, vaultPath: ctx.vaultPath });
          return { content: [{ type: 'text', text: `Security blocked: ${auth.reason}` }], isError: true };
        }
        const vaultBatchEditGuard = new BatchEditGuard(ctx.vaultPath, ctx.vault);
        if (preview) {
          const result = await vaultBatchEditGuard.preview(filter, operation, target, replacement);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        const result = await vaultBatchEditGuard.apply(filter, operation, target, replacement);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
  ];
}
