import { FolderACL } from './FolderACL.js';
import { OperationGate, type OperationPolicy } from './OperationGate.js';
import { AuditLogger } from './AuditLogger.js';
import { Sandbox } from './Sandbox.js';
import { ApprovalEngine } from './ApprovalEngine.js';
export interface FolderPolicy {
    readPaths?: string[];
    writePaths?: string[];
    safeZones?: string[];
    forbiddenPaths?: string[];
}
export interface SecurityPolicy {
    transport?: {
        requireTls?: boolean;
        token?: string;
    };
    vault?: {
        allowedRoots?: string[];
    };
    folders?: FolderPolicy;
    operations?: OperationPolicy;
    approval?: {
        mode?: 'auto' | 'interactive' | 'strict';
        optInTools?: string[];
    };
}
export interface AuthResult {
    allowed: boolean;
    level?: number;
    reason?: string;
}
export declare class SecurityEngine {
    private policy;
    readonly acl: FolderACL;
    readonly gate: OperationGate;
    readonly audit: AuditLogger;
    readonly sandbox: Sandbox;
    readonly approval: ApprovalEngine;
    constructor(policy: SecurityPolicy, acl: FolderACL, gate: OperationGate, audit: AuditLogger, sandbox: Sandbox, approval?: ApprovalEngine);
    authorize(toolName: string, args?: Record<string, unknown>): AuthResult;
    verifyToken(provided?: string): {
        valid: boolean;
        reason?: string;
    };
    private isReadOp;
    private isWriteOp;
}
//# sourceMappingURL=SecurityEngine.d.ts.map