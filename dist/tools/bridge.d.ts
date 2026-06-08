import type { ToolHandler } from '../shared/types.js';
import type { VaultPool } from '../layers/L1-filesystem/VaultPool.js';
import type { FolderACL } from '../security/FolderACL.js';
import type { EmbeddingProvider } from '../layers/L4-semantic/EmbeddingProvider.js';
import type { LLMAdapter } from '../layers/L6-ai-core/LLMAdapter.js';
import type { VaultEntry } from '../shared/types.js';
export declare function createBridgeTools(pool: VaultPool, acl: FolderACL, enforceOntology: boolean, embedProvider: EmbeddingProvider | undefined, adapter: LLMAdapter, initializeVaultEntry: (entry: VaultEntry, embedProvider?: EmbeddingProvider, adapter?: LLMAdapter) => Promise<void>): ToolHandler[];
//# sourceMappingURL=bridge.d.ts.map