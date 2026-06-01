// v0.1b:
import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { SecurityEngine } from '../../src/security/SecurityEngine.js';
import { FolderACL } from '../../src/security/FolderACL.js';
import { OperationGate } from '../../src/security/OperationGate.js';
import { AuditLogger } from '../../src/security/AuditLogger.js';
import { Sandbox } from '../../src/security/Sandbox.js';
import { ApprovalEngine } from '../../src/security/ApprovalEngine.js';

describe('SecurityEngine', () => {
  const createEngine = (policyOverrides = {}) => {
    const policy = {
      folders: {
        readPaths: ['/allowed'],
        writePaths: ['/allowed'],
        forbiddenPaths: ['/forbidden'],
        safeZones: [],
      },
      operations: {},
      approval: { mode: 'auto' as const },
      ...policyOverrides,
    };
    const acl = new FolderACL(policy.folders);
    const gate = new OperationGate();
    const audit = new AuditLogger({ flushIntervalMs: 999999 });
    const sandbox = new Sandbox();
    const approval = new ApprovalEngine();
    return new SecurityEngine(policy, acl, gate, audit, sandbox, approval);
  };

  describe('C5 — default-deny for unclassified tools', () => {
    it('should deny unclassified tools even with valid paths', () => {
      const engine = createEngine();
      const result = engine.authorize('unknown_tool_xyz', { path: '/allowed/note.md' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not classified');
    });

    it('should deny unclassified tools without any path', () => {
      const engine = createEngine();
      const result = engine.authorize('mystery_tool', {});
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not classified');
    });

    it('should allow classified read tools', () => {
      const engine = createEngine();
      const result = engine.authorize('read_note', { path: '/allowed/note.md' });
      expect(result.allowed).toBe(true);
    });

    it('should allow classified write tools', () => {
      const engine = createEngine();
      const result = engine.authorize('write_note', { path: '/allowed/note.md' });
      expect(result.allowed).toBe(true);
    });

    it('should deny write to forbidden path even for classified tools', () => {
      const engine = createEngine();
      const result = engine.authorize('write_note', { path: '/forbidden/note.md' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Write not allowed');
    });
  });

  describe('H7 — move_note source validation', () => {
    it('should deny move_note when source is not write-allowed', () => {
      const engine = createEngine();
      const result = engine.authorize('move_note', { from: '/forbidden/note.md', to: '/allowed/note.md' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Write not allowed');
    });

    it('should deny move_note when destination is not write-allowed', () => {
      const engine = createEngine();
      const result = engine.authorize('move_note', { from: '/allowed/note.md', to: '/forbidden/note.md' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('destination path');
    });

    it('should allow move_note when both source and dest are write-allowed', () => {
      const engine = createEngine();
      const result = engine.authorize('move_note', { from: '/allowed/a.md', to: '/allowed/b.md' });
      expect(result.allowed).toBe(true);
    });
  });

  describe('MABS tool classification', () => {
    it('should classify mabs_list_models as read', () => {
      const engine = createEngine();
      expect(engine.authorize('mabs_list_models', {}).allowed).toBe(true);
    });

    it('should classify mabs_set_current_model as write', () => {
      const engine = createEngine();
      expect(engine.authorize('mabs_set_current_model', {}).allowed).toBe(true);
    });

    it('should classify mabs_import_backup as write', () => {
      const engine = createEngine();
      expect(engine.authorize('mabs_import_backup', {}).allowed).toBe(true);
    });

    it('should deny mabs write to forbidden path', () => {
      const engine = createEngine();
      const result = engine.authorize('mabs_snapshot_artifact', { path: '/forbidden' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Write not allowed');
    });
  });

  describe('pool_add_vault symlink bypass (C2 fix)', () => {
    it('should reject symlink pointing outside allowedRoots', async () => {
      const tmpDir = path.resolve('./tests/fixtures/security-symlink-test');
      const allowedRoot = path.join(tmpDir, 'allowed');
      const evilLink = path.join(allowedRoot, 'evil');
      await fs.mkdir(allowedRoot, { recursive: true });
      try {
        await fs.symlink(tmpDir, evilLink, 'dir');
      } catch {
        // Skip test if symlinks not supported (Windows without dev mode)
        return;
      }
      const engine = createEngine({
        folders: { readPaths: ['*'], writePaths: ['*'], forbiddenPaths: [], safeZones: [] },
        vault: { allowedRoots: [allowedRoot] },
      });
      const result = engine.authorize('pool_add_vault', { path: evilLink });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in allowed roots');
      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe('Dreaming tool classification (SEM-001 fix)', () => {
    it('should allow dream_scan as read tool', () => {
      const engine = createEngine({
        folders: { readPaths: ['*'], writePaths: [], forbiddenPaths: [], safeZones: [] },
      });
      const result = engine.authorize('dream_scan', { path: 'notes/test.md' });
      expect(result.allowed).toBe(true);
    });

    it('should allow dream_finalize as write tool', () => {
      const engine = createEngine({
        folders: { readPaths: [], writePaths: ['*'], forbiddenPaths: [], safeZones: [] },
      });
      const result = engine.authorize('dream_finalize', { path: 'notes/test.md' });
      expect(result.allowed).toBe(true);
    });

    it('should allow dream_undo as write tool', () => {
      const engine = createEngine({
        folders: { readPaths: [], writePaths: ['*'], forbiddenPaths: [], safeZones: [] },
      });
      const result = engine.authorize('dream_undo', { path: 'notes/test.md' });
      expect(result.allowed).toBe(true);
    });

    it('should deny dream_finalize without write permission', () => {
      const engine = createEngine({
        folders: { readPaths: ['*'], writePaths: [], forbiddenPaths: [], safeZones: [] },
      });
      const result = engine.authorize('dream_finalize', { path: 'notes/test.md' });
      expect(result.allowed).toBe(false);
    });
  });
});
