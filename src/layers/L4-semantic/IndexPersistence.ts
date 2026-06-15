// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import { CorruptedCacheError } from '../../shared/errors.js';
import { safeJsonParse } from '../../shared/utils.js';

export class IndexPersistence {
  private cacheDir: string;

  constructor(vaultPath: string, cacheDir = '.mcp-cache') {
    this.cacheDir = path.join(vaultPath, cacheDir);
  }

  async save(graph: IGraphEngine, _vector?: IVectorEngine): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const metaTmp = path.join(this.cacheDir, 'index-meta.json.tmp');
    const metaDest = path.join(this.cacheDir, 'index-meta.json');
    const graphTmp = path.join(this.cacheDir, 'index-graph.json.tmp');
    const graphDest = path.join(this.cacheDir, 'index-graph.json');

    // Write compact JSON (no pretty-printing) to reduce memory and CPU pressure
    await fs.writeFile(metaTmp, JSON.stringify({ version: 1, timestamp: Date.now() }));
    await fs.rename(metaTmp, metaDest);
    await fs.writeFile(graphTmp, JSON.stringify(graph.serialize()));
    await fs.rename(graphTmp, graphDest);
    // Keyword index is persisted in SQLite FTS5 via SemanticDatabase; skip bm25 JSON cache
    // Vector embeddings are persisted in SQLite via SemanticDatabase; skip vector JSON cache
  }

  async load(graph: IGraphEngine, vector?: IVectorEngine): Promise<boolean> {
    const metaDest = path.join(this.cacheDir, 'index-meta.json');
    const graphDest = path.join(this.cacheDir, 'index-graph.json');
    const vectorDest = path.join(this.cacheDir, 'index-vector.json');
    try {
      const metaRaw = await fs.readFile(metaDest, 'utf-8');
      const meta = safeJsonParse(metaRaw) as { version: number; timestamp: number };
      if (meta.version !== 1) {
        throw new CorruptedCacheError('Incompatible index version');
      }
      // Allow large index files (graph can be hundreds of MB)
      const maxJsonSize = 2 * 1024 * 1024 * 1024;
      const graphRaw = await fs.readFile(graphDest, 'utf-8');
      const graphData = safeJsonParse(graphRaw, maxJsonSize) as {
        nodes: Record<string, import('../../shared/types.js').GraphNode>;
        outEdges: Record<string, string[]>;
        inEdges: Record<string, string[]>;
      };
      graph.load(graphData);
      if (vector) {
        try {
          const vectorRaw = await fs.readFile(vectorDest, 'utf-8');
          const vectorData = safeJsonParse(vectorRaw, maxJsonSize) as Record<string, number[]>;
          vector.load(vectorData);
        } catch {
          // vector cache optional
        }
      }
      return true;
    } catch (e) {
      console.error('[IndexPersistence] Failed to load index cache:', e instanceof Error ? e.message : String(e));
      if (e instanceof CorruptedCacheError) throw e;
      return false;
    }
  }

  async clear(): Promise<void> {
    const files = ['index.json', 'index-meta.json', 'index-graph.json', 'index-vector.json'];
    for (const name of files) {
      await fs.unlink(path.join(this.cacheDir, name)).catch(() => {
        // ignore missing files
      });
    }
  }
}
