// v0.1b:
import { describe, it, expect } from 'vitest';
import { ApprovalEngine } from '../../src/security/ApprovalEngine.js';

describe('ApprovalEngine', () => {
  const engine = new ApprovalEngine(['raw/', 'sessions/']);

  describe('getApprovalLevel', () => {
    it('returns 1 for read operations', () => {
      expect(engine.getApprovalLevel('read_note')).toBe(1);
      expect(engine.getApprovalLevel('search_notes')).toBe(1);
      expect(engine.getApprovalLevel('list_directory')).toBe(1);
      expect(engine.getApprovalLevel('get_vault_stats')).toBe(1);
    });

    it('returns 2 for writes to safe zones', () => {
      expect(engine.getApprovalLevel('write_note', { path: 'raw/draft.md' })).toBe(2);
      expect(engine.getApprovalLevel('append_note', { path: 'sessions/today.md' })).toBe(2);
    });

    it('returns 3 for writes outside safe zones', () => {
      expect(engine.getApprovalLevel('write_note', { path: 'concepts/ai.md' })).toBe(3);
      expect(engine.getApprovalLevel('patch_note', { path: 'notes/hello.md' })).toBe(3);
    });

    it('returns 4 for delete and move', () => {
      expect(engine.getApprovalLevel('delete_note')).toBe(4);
      expect(engine.getApprovalLevel('move_note')).toBe(4);
    });

    it('returns 4 for batch_edit preview and 7 for apply', () => {
      expect(engine.getApprovalLevel('batch_edit')).toBe(4);
      expect(engine.getApprovalLevel('batch_edit', { preview: true })).toBe(4);
      expect(engine.getApprovalLevel('batch_edit', { preview: false })).toBe(7);
    });

    it('returns 5 for cli_eval', () => {
      expect(engine.getApprovalLevel('cli_eval')).toBe(5);
    });

    it('returns 6 for cli_plugin install/uninstall', () => {
      expect(engine.getApprovalLevel('cli_plugin', { action: 'install' })).toBe(6);
      expect(engine.getApprovalLevel('cli_plugin', { action: 'uninstall' })).toBe(6);
    });

    it('returns 8 for unclassified tools', () => {
      expect(engine.getApprovalLevel('unknown_tool')).toBe(8);
    });
  });

  describe('helpers', () => {
    it('requiresConfirmation for levels 3,4,7', () => {
      expect(engine.requiresConfirmation(3)).toBe(true);
      expect(engine.requiresConfirmation(4)).toBe(true);
      expect(engine.requiresConfirmation(7)).toBe(true);
      expect(engine.requiresConfirmation(1)).toBe(false);
      expect(engine.requiresConfirmation(5)).toBe(false);
    });

    it('requiresBackup for level 4', () => {
      expect(engine.requiresBackup(4)).toBe(true);
      expect(engine.requiresBackup(3)).toBe(false);
    });

    it('requiresOptIn for levels 5,6', () => {
      expect(engine.requiresOptIn(5)).toBe(true);
      expect(engine.requiresOptIn(6)).toBe(true);
      expect(engine.requiresOptIn(4)).toBe(false);
    });

    it('isDestructive for levels 4,5,6,7', () => {
      expect(engine.isDestructive(4)).toBe(true);
      expect(engine.isDestructive(5)).toBe(true);
      expect(engine.isDestructive(6)).toBe(true);
      expect(engine.isDestructive(7)).toBe(true);
      expect(engine.isDestructive(1)).toBe(false);
      expect(engine.isDestructive(3)).toBe(false);
    });
  });

  describe('extractPath', () => {
    it('extracts path from various keys', () => {
      expect(engine.getApprovalLevel('write_note', { path: 'raw/x.md' })).toBe(2);
      expect(engine.getApprovalLevel('move_note', { from: 'a.md', to: 'b.md' })).toBe(4);
    });
  });
});
