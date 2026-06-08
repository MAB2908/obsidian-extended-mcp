import type { IVaultManager } from '../../shared/interfaces/IVaultManager.js';
import type { SignalStore } from './SignalStore.js';
import type { DreamTopic } from './types.js';
export interface TopicLoaderOptions {
    scope?: string;
}
export declare class TopicLoader {
    private vault;
    private signals;
    constructor(vault: IVaultManager, signals: SignalStore);
    load(opts?: TopicLoaderOptions): Promise<DreamTopic[]>;
    private loadOne;
}
//# sourceMappingURL=TopicLoader.d.ts.map