export interface OperationPolicy {
    readOnly: boolean;
    enableCommands: boolean;
    enableEval: boolean;
    enableBatchEdit: boolean;
    enableDelete: boolean;
}
export declare class OperationGate {
    private policy;
    constructor(policy?: Partial<OperationPolicy>);
    check(toolName: string, overridePolicy?: Partial<OperationPolicy>): {
        allowed: boolean;
        reason?: string;
    };
}
//# sourceMappingURL=OperationGate.d.ts.map