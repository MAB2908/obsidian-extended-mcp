// v0.2b:
import { describe, it, expect } from 'vitest';
import { OperationGate } from '../../src/security/OperationGate.js';

describe('OperationGate', () => {
  it('blocks exact write tools in read-only mode', () => {
    const gate = new OperationGate({ readOnly: true });
    expect(gate.check('write_note').allowed).toBe(false);
    expect(gate.check('my_write_note_helper').allowed).toBe(true);
  });

  it('blocks exact command tools', () => {
    const gate = new OperationGate({ enableCommands: false });
    expect(gate.check('cli_command').allowed).toBe(false);
    expect(gate.check('cli_command_custom').allowed).toBe(true);
  });

  it('allows all by default except eval', () => {
    const gate = new OperationGate();
    expect(gate.check('write_note').allowed).toBe(true);
    expect(gate.check('cli_eval').allowed).toBe(false);
    expect(gate.check('cli_eval').reason).toBe('Eval disabled by policy');
  });
});
