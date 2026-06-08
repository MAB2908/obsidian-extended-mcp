import { VaultPathNotFoundError } from '../shared/errors.js';
import { promises as fs } from 'fs';
export function createBridgeTools(pool, acl, enforceOntology, embedProvider, adapter, initializeVaultEntry) {
    return [
        {
            name: 'pool_list_vaults',
            description: 'List all vaults in the pool',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const vaults = await pool.listVaults();
                return { content: [{ type: 'text', text: JSON.stringify(vaults, null, 2) }] };
            },
        },
        {
            name: 'pool_add_vault',
            description: 'Add a vault to the pool',
            inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
            },
            handler: async (args) => {
                const { path: newVaultPath } = args;
                try {
                    const stat = await fs.stat(newVaultPath);
                    if (!stat.isDirectory())
                        throw new VaultPathNotFoundError(newVaultPath);
                }
                catch (e) {
                    if (e instanceof VaultPathNotFoundError)
                        throw e;
                    throw new VaultPathNotFoundError(newVaultPath);
                }
                const entry = await pool.addVault(newVaultPath, acl, enforceOntology);
                await initializeVaultEntry(entry, embedProvider, adapter);
                return { content: [{ type: 'text', text: `Added vault: ${newVaultPath}` }] };
            },
        },
        {
            name: 'pool_remove_vault',
            description: 'Remove a vault from the pool',
            inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
            },
            handler: async (args) => {
                const { path: removePath } = args;
                const removed = await pool.removeVault(removePath);
                return { content: [{ type: 'text', text: removed ? `Removed vault: ${removePath}` : `Vault not found: ${removePath}` }] };
            },
        },
    ];
}
//# sourceMappingURL=bridge.js.map