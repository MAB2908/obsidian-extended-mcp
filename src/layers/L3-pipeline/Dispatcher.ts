// v0.2b:
import type { ToolHandler } from '../../shared/types.js';
import { AuditLogger } from '../../security/AuditLogger.js';
import { PipelineError } from '../../shared/index.js';

export class Dispatcher {
  private handlers = new Map<string, ToolHandler>();
  private audit?: AuditLogger;

  constructor(audit?: AuditLogger) {
    this.audit = audit;
  }

  register(tool: ToolHandler): void {
    if (this.handlers.has(tool.name)) {
      throw new PipelineError('TOOL_DUPLICATE', `Tool ${tool.name} is already registered`);
    }
    this.handlers.set(tool.name, tool);
  }

  async call(name: string, args: unknown): Promise<unknown> {
    const tool = this.handlers.get(name);
    if (!tool) {
      throw new PipelineError('TOOL_NOT_FOUND', `Tool not found: ${name}`);
    }

    const start = Date.now();
    try {
      const result = await tool.handler(args);
      this.audit?.log({
        event: 'tool_call',
        tool: name,
        args,
        result: 'success',
        durationMs: Date.now() - start,
      });
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.audit?.log({
        event: 'error',
        tool: name,
        args,
        message,
        durationMs: Date.now() - start,
      });
      throw e;
    }
  }

  listTools(): ToolHandler[] {
    return Array.from(this.handlers.values());
  }

  hasTool(name: string): boolean {
    return this.handlers.has(name);
  }
}
