import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import type { AuditLogger } from '../security/AuditLogger.js';
import type { SecurityEngine } from '../security/SecurityEngine.js';
export declare function createSecurityTools(resolveVault: (args: Record<string, unknown>) => VaultContext, audit: AuditLogger, security: SecurityEngine): ToolHandler[];
//# sourceMappingURL=security.d.ts.map