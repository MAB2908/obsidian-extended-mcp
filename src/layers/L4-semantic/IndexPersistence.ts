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
    const metaTmp = path.join(this.cacheDir, 'index-meta.json.tmp');
    const metaDest = path.join(this.cacheDir, 'index-meta.json');
    const graphTmp = path.join(this.cacheDir, 'index-graph.json.tmp');
    const graphDest = path.join(this.cacheDir, 'index-graph.json');
    const bm25Tmp = path.join(this.cacheDir, 'index-bm25.json.tmp');
    const bm25Dest = path.join(this.cacheDir, 'index-bm25.json');

    // Write compact JSON (no pretty-printing) to reduce memory and CPU pressure
    await fs.writeFile(metaTmp, JSON.stringify({ version: 1, timestamp: Date.now() }));
    await fs.rename(metaTmp, metaDest);
    await fs.writeFile(graphTmp, JSON.stringify(graph.serialize()));
    await fs.rename(graphTmp, graphDest);
    await fs.writeFile(bm25Tmp, JSON.stringify(bm25.serialize()));
    await fs.rename(bm25Tmp, bm25Dest);
    if (vector) {
      const vectorTmp = path.join(this.cacheDir, 'index-vector.json.tmp');
      const vectorDest = path.join(this.cacheDir, 'index-vector.json');
      await fs.writeFile(vectorTmp, JSON.stringify(vector.serialize()));
      await fs.rename(vectorTmp, vectorDest);
    }
  }

  async load(graph: IGraphEngine, bm25: IBM25Engine, vector?: IVectorEngine): Promise<boolean> {
    const metaDest = path.join(this.cacheDir, 'index-meta.json');
    const graphDest = path.join(this.cacheDir, 'index-graph.json');
    const bm25Dest = path.join(this.cacheDir, 'index-bm25.json');
    const vectorDest = path.join(this.cacheDir, 'index-vector.json');
    try {
      const metaRaw = await fs.readFile(metaDest, 'utf-8');
      const meta = safeJsonParse(metaRaw) as { version: number; timestamp: number };
      if (meta.version !== 1) {
        throw new CorruptedCacheError('Incompatible index version');
      }
      const graphRaw = await fs.readFile(graphDest, 'utf-8');
      const graphData = safeJsonParse(graphRaw) as {
        nodes: Record<string, import('../../shared/types.js').GraphNode>;
        outEdges: Record<string, string[]>;
        inEdges: Record<string, string[]>;
      };
      const bm25Raw = await fs.readFile(bm25Dest, 'utf-8');
      const bm25Data = safeJsonParse(bm25Raw) as {
        docs: Record<string, { id: string; tokens: string[]; termFreq: [string, number][]; docLen: number }>;
        inverted: Record<string, string[]>;
        avgDocLen: number;
        totalDocLen: number;
          k1: number;
          b: number;
      };
      graph.load(graphData);
      bm25.load(bm25Data);
      if (vector) {
        try {
          const vectorRaw = await fs.readFile(vectorDest, 'utf-8');
          const vectorData = safeJsonParse(vectorRaw) as Record<string, number[]>;
          vector.load(vectorData);
        } catch {
          // vector cache optional
        }
      }
      return true;
    } catch (e) {
      if (e instanceof CorruptedCacheError) throw e;
      return false;
    }
  }

  async clear(): Promise<void> {
    const files = ['index.json', 'index-meta.json', 'index-graph.json', 'index-bm25.json', 'index-vector.json'];
    for (const name of files) {
      await fs.unlink(path.join(this.cacheDir, name)).catch(() => {
        // ignore missing files
      });
    }
  }
}
