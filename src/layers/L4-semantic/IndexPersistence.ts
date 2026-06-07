// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
import { CorruptedCacheError } from '../../shared/errors.js';
import { safeJsonParse } from '../../shared/utils.js';

export class IndexPersistence {
  private cacheDir: string;

  constructor(vaultPath: string, cacheDir = '.mcp-cache') {
    this.cacheDir = path.join(vaultPath, cacheDir);
  }

  async save(graph: IGraphEngine, bm25: IBM25Engine, vector?: IVectorEngine): Promise<void> {
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

  async load(graph: IGraphEngine, bm25: IBM25Engine, vector?: IVectorEngine): Promise<boolean> {
    const dest = path.join(this.cacheDir, 'index.json');
    try {
      const raw = await fs.readFile(dest, 'utf-8');
      const data = safeJsonParse(raw) as {
        version: number;
        graph: { nodes: Record<string, import('../../shared/types.js').GraphNode>; outEdges: Record<string, string[]>; inEdges: Record<string, string[]> };
        bm25: {
          docs: Record<string, { id: string; tokens: string[]; termFreq: [string, number][]; docLen: number }>;
          inverted: Record<string, string[]>;
          avgDocLen: number;
          totalDocLen: number;
          k1: number;
          b: number;
        };
        vector?: Record<string, number[]>;
      };
      if (data.version !== 1) {
        throw new CorruptedCacheError('Incompatible index version');
      }
      graph.load(data.graph);
      bm25.load(data.bm25);
      if (vector && data.vector) {
        vector.load(data.vector);
      }
      return true;
    } catch (e) {
      if (e instanceof CorruptedCacheError) throw e;
      return false;
    }
  }

  async clear(): Promise<void> {
    const dest = path.join(this.cacheDir, 'index.json');
    await fs.unlink(dest).catch((err) => {
      console.error('[IndexPersistence] Failed to clear index cache:', err);
    });
  }
}
