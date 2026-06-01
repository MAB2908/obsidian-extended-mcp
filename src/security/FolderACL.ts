// v0.1b:
import path from 'path';

export interface FolderPolicy {
  readPaths: string[];
  writePaths: string[];
  safeZones: string[];
  forbiddenPaths: string[];
}

function normalizeCheckPath(filePath: string): string {
  // Normalize separators and resolve . and ..
  let normalized = path.normalize(filePath).replace(/\\/g, '/');
  // Windows filesystem is case-insensitive — normalize to lowercase for comparison
  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

export class FolderACL {
  private policy: FolderPolicy;

  constructor(policy?: Partial<FolderPolicy>) {
    this.policy = {
      readPaths: ['*'],
      writePaths: ['*'],
      safeZones: ['raw/', 'sessions/'],
      forbiddenPaths: ['.git/', '.obsidian/', '.trash/'],
      ...policy,
    };
  }

  private _checkAllowed(filePath: string, overridePolicy: Partial<FolderPolicy> | undefined, mode: 'read' | 'write'): boolean {
    const policy = overridePolicy ? { ...this.policy, ...overridePolicy } : this.policy;
    const normalized = normalizeCheckPath(filePath);
    // Reject any path that escapes its parent via traversal
    if (normalized.includes('../') || normalized.startsWith('..')) return false;
    if (policy.forbiddenPaths.some((p) => normalized.startsWith(p))) return false;
    const list = mode === 'read' ? policy.readPaths : policy.writePaths;
    if (list.includes('*')) return true;
    return list.some((p) => normalized.startsWith(p));
  }

  isReadAllowed(filePath: string, overridePolicy?: Partial<FolderPolicy>): boolean {
    return this._checkAllowed(filePath, overridePolicy, 'read');
  }

  isWriteAllowed(filePath: string, overridePolicy?: Partial<FolderPolicy>): boolean {
    return this._checkAllowed(filePath, overridePolicy, 'write');
  }

  isSafeZone(filePath: string): boolean {
    const normalized = normalizeCheckPath(filePath);
    if (normalized.includes('../') || normalized.startsWith('..')) return false;
    return this.policy.safeZones.some((p) => normalized.startsWith(p));
  }
}
