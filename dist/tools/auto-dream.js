import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function createAutoDreamTools() {
    return [
        {
            name: 'auto_dream_run',
            description: 'L9-Dreaming Auto: Run the automated dreaming pipeline (scan → safe auto-apply) on a vault. ' +
                'Safe ops: prune empty files, prune github_cache, fix buggy tags (-, x2F, table-of-contents), dedup tag case.',
            inputSchema: {
                type: 'object',
                properties: {
                    vaultPath: {
                        type: 'string',
                        description: 'Absolute path to the vault to auto-dream',
                    },
                    dryRun: {
                        type: 'boolean',
                        description: 'If true, only report what would be changed without applying',
                        default: false,
                    },
                    watch: {
                        type: 'boolean',
                        description: 'Enable cross-platform file watching via chokidar',
                        default: false,
                    },
                    cronHours: {
                        type: 'number',
                        description: 'Run periodically every N hours (0 = one-shot)',
                        default: 0,
                    },
                },
                required: ['vaultPath'],
            },
            handler: async (args) => {
                const a = args;
                const vaultPath = a.vaultPath;
                const dryRun = !!a.dryRun;
                const watch = !!a.watch;
                const cronHours = a.cronHours || 0;
                const scriptPath = path.resolve(__dirname, '../../scripts/auto-dream.mjs');
                const cmd = process.execPath;
                const argv = [scriptPath, vaultPath];
                if (dryRun)
                    argv.push('--dry-run');
                if (watch)
                    argv.push('--watch');
                if (cronHours > 0)
                    argv.push('--cron', String(cronHours));
                return new Promise((resolve) => {
                    const child = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
                    let stdout = '';
                    let stderr = '';
                    child.stdout.on('data', (d) => (stdout += d));
                    child.stderr.on('data', (d) => (stderr += d));
                    child.on('close', (code) => {
                        const text = code === 0
                            ? `Auto-dream completed for ${vaultPath}${dryRun ? ' (DRY RUN)' : ''}.\n\n${stdout}`
                            : `Auto-dream failed (exit ${code}).\nstdout:\n${stdout}\nstderr:\n${stderr}`;
                        resolve({
                            content: [{ type: 'text', text }],
                            isError: code !== 0,
                        });
                    });
                });
            },
        },
        {
            name: 'auto_dream_install_scheduler',
            description: 'L9-Dreaming Auto: Install OS-level scheduler for auto-dream (Windows Task Scheduler / macOS launchd / Linux cron).',
            inputSchema: {
                type: 'object',
                properties: {
                    vaultPath: {
                        type: 'string',
                        description: 'Absolute path to the vault',
                    },
                    intervalHours: {
                        type: 'number',
                        description: 'Interval between runs in hours',
                        default: 24,
                    },
                },
                required: ['vaultPath'],
            },
            handler: async (args) => {
                const a = args;
                const vaultPath = a.vaultPath;
                const intervalHours = a.intervalHours || 24;
                const scriptPath = path.resolve(__dirname, '../../scripts/auto-dream.mjs');
                const cmd = process.execPath;
                const argv = [scriptPath, vaultPath, '--install-scheduler', '--cron', String(intervalHours)];
                return new Promise((resolve) => {
                    const child = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
                    let stdout = '';
                    let stderr = '';
                    child.stdout.on('data', (d) => (stdout += d));
                    child.stderr.on('data', (d) => (stderr += d));
                    child.on('close', (code) => {
                        const text = code === 0
                            ? `Scheduler installation output:\n\n${stdout}`
                            : `Scheduler installation failed (exit ${code}).\nstdout:\n${stdout}\nstderr:\n${stderr}`;
                        resolve({
                            content: [{ type: 'text', text }],
                            isError: code !== 0,
                        });
                    });
                });
            },
        },
        {
            name: 'auto_dream_status',
            description: 'L9-Dreaming Auto: Read the latest auto-dream log for a vault.',
            inputSchema: {
                type: 'object',
                properties: {
                    vaultPath: {
                        type: 'string',
                        description: 'Absolute path to the vault',
                    },
                    lines: {
                        type: 'number',
                        description: 'Number of recent log lines to return',
                        default: 20,
                    },
                },
                required: ['vaultPath'],
            },
            handler: async (args) => {
                const a = args;
                const vaultPath = a.vaultPath || process.env.VAULT_PATH;
                if (!vaultPath) {
                    return { content: [{ type: 'text', text: 'vaultPath is required. Provide the absolute path to the vault.' }], isError: true };
                }
                const lines = a.lines ?? 20;
                const logPath = path.join(vaultPath, '.obsidian', 'auto-dream.log');
                try {
                    const { promises: fsp } = await import('fs');
                    const content = await fsp.readFile(logPath, 'utf-8');
                    const lastLines = content.trim().split('\n').slice(-lines).join('\n');
                    return {
                        content: [{ type: 'text', text: `Auto-dream log (${logPath}):\n\n${lastLines}` }],
                    };
                }
                catch {
                    return {
                        content: [{ type: 'text', text: `No auto-dream log found at ${logPath}` }],
                    };
                }
            },
        },
    ];
}
//# sourceMappingURL=auto-dream.js.map