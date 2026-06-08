export declare function toCamelCase(str: string): string;
export declare function slugify(str: string): string;
export declare function validatePath(vaultRoot: string, requestedPath: string): Promise<string>;
export declare function tokenize(text: string): string[];
export declare function hashKey(input: string): string;
/** Safely parse JSON with size and depth limits to prevent bombs */
export declare function safeJsonParse(raw: string, maxSize?: number, maxDepth?: number): unknown;
//# sourceMappingURL=utils.d.ts.map