import type { IGraphEngine } from '../../shared/interfaces/IGraphEngine.js';
import type { IBM25Engine } from '../../shared/interfaces/IBM25Engine.js';
import type { IVectorEngine } from '../../shared/interfaces/IVectorEngine.js';
export declare class IndexPersistence {
    private cacheDir;
    constructor(vaultPath: string, cacheDir?: string);
    save(graph: IGraphEngine, bm25: IBM25Engine, _vector?: IVectorEngine): Promise<void>;
    load(graph: IGraphEngine, bm25: IBM25Engine, vector?: IVectorEngine): Promise<boolean>;
    clear(): Promise<void>;
}
//# sourceMappingURL=IndexPersistence.d.ts.map