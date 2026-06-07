// v0.2b:
import { describe, it, expect } from 'vitest';
import { Sandbox } from '../../src/security/Sandbox.js';

describe('Sandbox', () => {
  describe('validate', () => {
    it('allows safe code', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('1 + 1').allowed).toBe(true);
      expect(sandbox.validate('app.workspace.getActiveFile()').allowed).toBe(true);
    });

    it('blocks eval', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('eval("1+1")').allowed).toBe(false);
    });

    it('blocks require', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('require("fs")').allowed).toBe(false);
    });

    it('blocks Function constructor', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('new Function("return 1")').allowed).toBe(false);
    });

    it('blocks import', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('import("fs")').allowed).toBe(false);
    });

    it('blocks constructor access', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('({}).constructor').allowed).toBe(false);
    });

    it('blocks unicode escape bypass (V-003)', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('\\u0065\\u0076\\u0061\\u006c("1+1")').allowed).toBe(false);
      expect(sandbox.validate('\\u0066\\u0075\\u006e\\u0063\\u0074\\u0069\\u006f\\u006e').allowed).toBe(false);
    });

    it('blocks ES6 unicode escapes (\\u{...})', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('\\u{72}\\u{65}\\u{71}\\u{75}\\u{69}\\u{72}\\u{65}').allowed).toBe(false);
    });

    it('blocks hex escapes (\\xNN)', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('\\x72\\x65\\x71\\x75\\x69\\x72\\x65').allowed).toBe(false);
    });

    it('blocks String.fromCharCode reconstruction', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('String.fromCharCode(114,101,113,117,105,114,101)').allowed).toBe(false);
      expect(sandbox.validate('String.fromCodePoint(114,101,113,117,105,114,101)').allowed).toBe(false);
    });

    it('blocks globalThis dynamic property access', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('globalThis["require"]').allowed).toBe(false);
      expect(sandbox.validate("globalThis['eval']").allowed).toBe(false);
      expect(sandbox.validate('globalThis[\`fs\`]').allowed).toBe(false);
    });

    it('blocks template literal bypass (V-004)', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('eval`1+1`').allowed).toBe(false);
      expect(sandbox.validate('Function`return 1`').allowed).toBe(false);
    });

    it('blocks Reflect.get/set (V-006)', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('Reflect.get(globalThis, "eval")').allowed).toBe(false);
      expect(sandbox.validate('Reflect.set({}, "x", 1)').allowed).toBe(false);
    });

    it('blocks Object.getPrototypeOf constructor access (V-007)', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('Object.getPrototypeOf({}).constructor').allowed).toBe(false);
    });

    it('blocks setTimeout/setInterval string evaluation (V-008)', () => {
      const sandbox = new Sandbox();
      expect(sandbox.validate('setTimeout("eval(1)", 0)').allowed).toBe(false);
      expect(sandbox.validate('setInterval("code", 1000)').allowed).toBe(false);
    });
  });

  describe('execute', () => {
    it('executes simple expression', async () => {
      const sandbox = new Sandbox();
      const result = await sandbox.execute<number>('return 2 + 2');
      expect(result).toBe(4);
    });

    it('exposes whitelisted globals', async () => {
      const sandbox = new Sandbox();
      // Even if global is not present, code should not crash — just return undefined
      const result = await sandbox.execute<unknown>('return typeof app');
      expect(result).toBe('undefined');
    });

    it('injects custom context', async () => {
      const sandbox = new Sandbox();
      const result = await sandbox.execute<number>('return x + y', { x: 10, y: 20 });
      expect(result).toBe(30);
    });

    it('does not have access to require', async () => {
      const sandbox = new Sandbox();
      const result = await sandbox.execute<unknown>('return typeof require');
      expect(result).toBe('undefined');
    });

    it('times out on infinite loop', async () => {
      const sandbox = new Sandbox({ maxTimeoutMs: 100 });
      await expect(
        sandbox.execute('while (true) {}')
      ).rejects.toThrow(/timed out/);
    });

    it('rejects forbidden code before execution', async () => {
      const sandbox = new Sandbox();
      await expect(
        sandbox.execute('require("fs").readFileSync("/etc/passwd")')
      ).rejects.toThrow(/Sandbox validation failed/);
    });

    it('supports async/await inside vm', async () => {
      const sandbox = new Sandbox();
      const result = await sandbox.execute<number>('return await Promise.resolve(42)');
      expect(result).toBe(42);
    });

    it('rejects code containing __proto__', async () => {
      const sandbox = new Sandbox();
      await expect(
        sandbox.execute(`({}).__proto__.polluted = true`)
      ).rejects.toThrow('Sandbox validation failed');
    });

    it('rejects eval template literal bypass', async () => {
      const sandbox = new Sandbox();
      await expect(
        sandbox.execute('eval`process.exit(1)`')
      ).rejects.toThrow('Sandbox validation failed');
    });

    it('rejects Function template literal bypass', async () => {
      const sandbox = new Sandbox();
      await expect(
        sandbox.execute('Function`return require("fs")`')
      ).rejects.toThrow('Sandbox validation failed');
    });
  });
});
