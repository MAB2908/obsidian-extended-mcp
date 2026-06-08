import type { ToolHandler } from '../../shared/types.js';
import { AuditLogger } from '../../security/AuditLogger.js';
export declare class Dispatcher {
    private handlers;
    private audit?;
    constructor(audit?: AuditLogger);
    register(tool: ToolHandler): void;
    call(name: string, args: unknown): Promise<unknown>;
    listTools(): ToolHandler[];
    hasTool(name: string): boolean;
}
//# sourceMappingURL=Dispatcher.d.ts.map