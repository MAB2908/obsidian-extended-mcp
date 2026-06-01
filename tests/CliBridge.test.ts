// v0.1b:
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CliBridge } from '../src/layers/L2-cli/CliBridge.js';
import { CliError } from '../src/shared/errors.js';

// Mock child_process
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
    exec: vi.fn(),
  };
});

import { spawn, exec } from 'child_process';
import { EventEmitter } from 'events';

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe('CliBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isAvailable returns true when obsidian found', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd: string, cb: (err: null, result: { stdout: string }) => void) => {
      cb(null, { stdout: '/usr/bin/obsidian\n' });
    });
    const bridge = new CliBridge('/vault');
    expect(await bridge.isAvailable()).toBe(true);
  });

  it('isAvailable returns false when obsidian not found', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd: string, cb: (err: Error, result: null) => void) => {
      cb(new Error('not found'), null);
    });
    const bridge = new CliBridge('/vault');
    expect(await bridge.isAvailable()).toBe(false);
  });

  it('eval returns parsed output', async () => {
    const mockProc = new MockChildProcess();
    (spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

    const bridge = new CliBridge('/vault', '/usr/bin/obsidian');
    const promise = bridge.eval('1+1');

    setTimeout(() => {
      mockProc.stdout.emit('data', '{"result": 2}');
      mockProc.emit('close', 0);
    }, 10);

    const result = await promise;
    expect(result).toBe('{"result": 2}');
  });

  it('eval throws CliError on non-zero exit', async () => {
    const mockProc = new MockChildProcess();
    (spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

    const bridge = new CliBridge('/vault', '/usr/bin/obsidian');
    const promise = bridge.eval('throw new Error()');

    setTimeout(() => {
      mockProc.stderr.emit('data', 'error message');
      mockProc.emit('close', 1);
    }, 10);

    await expect(promise).rejects.toThrow(CliError);
  });

  it('backlinks parses JSON output', async () => {
    const mockProc = new MockChildProcess();
    (spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

    const bridge = new CliBridge('/vault', '/usr/bin/obsidian');
    const promise = bridge.backlinks('note.md');

    setTimeout(() => {
      mockProc.stdout.emit('data', '[{"source": "a.md", "line": 5}]');
      mockProc.emit('close', 0);
    }, 10);

    const result = await promise;
    expect(result).toEqual([{ source: 'a.md', line: 5 }]);
  });

  it('orphans parses JSON output', async () => {
    const mockProc = new MockChildProcess();
    (spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

    const bridge = new CliBridge('/vault', '/usr/bin/obsidian');
    const promise = bridge.orphans();

    setTimeout(() => {
      mockProc.stdout.emit('data', '["o1.md", "o2.md"]');
      mockProc.emit('close', 0);
    }, 10);

    const result = await promise;
    expect(result).toEqual(['o1.md', 'o2.md']);
  });

  it('daily returns content on read', async () => {
    const mockProc = new MockChildProcess();
    (spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

    const bridge = new CliBridge('/vault', '/usr/bin/obsidian');
    const promise = bridge.daily('read');

    setTimeout(() => {
      mockProc.stdout.emit('data', '{"content": "# Daily"}');
      mockProc.emit('close', 0);
    }, 10);

    const result = await promise;
    expect(result).toBe('# Daily');
  });
});
