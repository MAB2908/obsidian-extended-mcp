import type { ToolHandler } from '../shared/types.js';
import type { VaultContext } from '../layers/L1-filesystem/VaultRouter.js';
import type { FileTypeRouter } from '../shared/FileTypeRouter.js';
export declare function createFilesystemTools(resolveVault: (args: Record<string, unknown>) => VaultContext, fileRouter: FileTypeRouter): ToolHandler[];
//# sourceMappingURL=filesystem.d.ts.map