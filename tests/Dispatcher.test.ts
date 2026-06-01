// v0.1b:
import { describe, it, expect } from 'vitest';
import { Dispatcher } from '../src/layers/L3-pipeline/Dispatcher.js';
import { AuditLogger } from '../src/security/AuditLogger.js';

describe('Dispatcher', () => {
  it('registers and calls a tool', async () => {
    const dispatcher = new Dispatcher();
    dispatcher.register({
      name: 'echo',
      description: 'Echo tool',
      inputSchema: { type: 'object' },
      handler: async (args) => ({ result: args }),
    });

    const result = await dispatcher.call('echo', { text: 'hello' });
    expect((result as { result: { text: string } }).result.text).toBe('hello');
  });

  it('throws on unknown tool', async () => {
    const dispatcher = new Dispatcher();
    await expect(() => dispatcher.call('unknown', {})).rejects.toThrow('Tool not found: unknown');
  });

  it('logs successful tool calls to audit', async () => {
    const audit = new AuditLogger({ vaultPath: './tests/fixtures/test-vault' });
    const dispatcher = new Dispatcher(audit);
    dispatcher.register({
      name: 'test_tool',
      description: 'Test',
      inputSchema: { type: 'object' },
      handler: async () => 'success',
    });

    await dispatcher.call('test_tool', { x: 1 });
    await audit.flush();
    const entries = await audit.query({ event: 'tool_call', tool: 'test_tool' });
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('logs errors to audit', async () => {
    const audit = new AuditLogger({ vaultPath: './tests/fixtures/test-vault' });
    const dispatcher = new Dispatcher(audit);
    dispatcher.register({
      name: 'fail_tool',
      description: 'Fail',
      inputSchema: { type: 'object' },
      handler: async () => {
        throw new Error('intentional failure');
      },
    });

    await expect(() => dispatcher.call('fail_tool', {})).rejects.toThrow('intentional failure');
    await audit.flush();
    const entries = await audit.query({ event: 'error', tool: 'fail_tool' });
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('lists all registered tools', () => {
    const dispatcher = new Dispatcher();
    dispatcher.register({ name: 'a', description: 'A', inputSchema: {}, handler: async () => 'a' });
    dispatcher.register({ name: 'b', description: 'B', inputSchema: {}, handler: async () => 'b' });
    expect(dispatcher.listTools().length).toBe(2);
    expect(dispatcher.hasTool('a')).toBe(true);
    expect(dispatcher.hasTool('c')).toBe(false);
  });
});
