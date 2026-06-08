// v0.2b:
import path from 'path';
function normalizeCheckPath(filePath) {
    // Normalize separators and resolve . and ..
    let normalized = path.normalize(filePath).replace(/\\/g, '/');
    // Windows filesystem is case-insensitive — normalize to lowercase for comparison
    if (process.platform === 'win32') {
        normalized = normalized.toLowerCase();
    }
    return normalized;
}
export class FolderACL {
    policy;
    constructor(policy) {
        this.policy = {
            readPaths: ['*'],
            writePaths: ['*'],
            safeZones: ['raw/', 'sessions/'],
            forbiddenPaths: ['.git/', '.obsidian/', '.trash/'],
            ...policy,
        };
    }
    _checkAllowed(filePath, overridePolicy, mode) {
        const policy = overridePolicy ? { ...this.policy, ...overridePolicy } : this.policy;
        const normalized = normalizeCheckPath(filePath);
        // Reject any path that escapes its parent via traversal
        if (normalized.includes('../') || normalized.startsWith('..'))
            return false;
        if (policy.forbiddenPaths.some((p) => normalized.startsWith(p)))
            return false;
        const list = mode === 'read' ? policy.readPaths : policy.writePaths;
        if (list.includes('*'))
            return true;
        return list.some((p) => normalized.startsWith(p));
    }
    isReadAllowed(filePath, overridePolicy) {
        return this._checkAllowed(filePath, overridePolicy, 'read');
    }
    isWriteAllowed(filePath, overridePolicy) {
        return this._checkAllowed(filePath, overridePolicy, 'write');
    }
    isSafeZone(filePath) {
        const normalized = normalizeCheckPath(filePath);
        if (normalized.includes('../') || normalized.startsWith('..'))
            return false;
        return this.policy.safeZones.some((p) => normalized.startsWith(p));
    }
}
//# sourceMappingURL=FolderACL.js.map