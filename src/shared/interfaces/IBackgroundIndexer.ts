// v0.1b:
export interface IBackgroundIndexer {
  initialize(): Promise<void>;
  markDirty(path: string): void;
  markAllDirty(): void;
  stop(): void;
  stopGraceful(): Promise<void>;
}
