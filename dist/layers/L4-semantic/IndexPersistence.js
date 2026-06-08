// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import { CorruptedCacheError } from '../../shared/errors.js';
import { safeJsonParse } from '../../shared/utils.js';
export class IndexPersistence {
    cacheDir;
    constructor(vaultPath, cacheDir = '.mcp-cache') {
        this.cacheDir = path.join(vaultPath, cacheDir);
    }
    async save(graph, bm25, vector) {
        await fs.mkdir(this.cacheDir, { recursive: true });
        const payload = {
            version: 1,
            timestamp: Date.now(),
            graph: graph.serialize(),
            bm25: bm25.serialize(),
            vector: vector?.serialize(),
        };
        const tmp = path.join(this.cacheDir, 'index.json.tmp');
        const dest = path.join(this.cacheDir, 'index.json');
        await fs.writeFile(tmp, JSON.stringify(payload, null, 2));
        await fs.rename(tmp, dest);
    }
    async load(graph, bm25, vector) {
        const dest = path.join(this.cacheDir, 'index.json');
        try {
            const raw = await fs.readFile(dest, 'utf-8');
            const data = safeJsonParse(raw);
            if (data.version !== 1) {
                throw new CorruptedCacheError('Incompatible index version');
            }
            graph.load(data.graph);
            bm25.load(data.bm25);
            if (vector && data.vector) {
                vector.load(data.vector);
            }
            return true;
        }
        catch (e) {
            if (e instanceof CorruptedCacheError)
                throw e;
            return false;
        }
    }
    async clear() {
        const dest = path.join(this.cacheDir, 'index.json');
        await fs.unlink(dest).catch((err) => {
            console.error('[IndexPersistence] Failed to clear index cache:', err);
        });
    }
}
//# sourceMappingURL=IndexPersistence.js.map