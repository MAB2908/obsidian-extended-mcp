#!/usr/bin/env node
// v0.2b:
// v0.2b:
/**
 * Auto-Dreaming Standalone Runner — Cross-Platform
 * Законченный, автоматический, регулярный pipeline:
 *   Scan → Auto-Apply (safe ops only) → Log
 *
 * Safe ops:
 *   - prune-empty   : удаление пустых файлов
 *   - prune-cache   : удаление github_cache/
 *   - fix-tags      : исправление баг-тегов (-, x2F, table-of-contents)
 *   - dedup-tags    : дедупликация регистра тегов (Python → python)
 *
 * Cross-platform: Windows, macOS, Linux
 * File watching: chokidar (FSEvents / ReadDirectoryChangesW / inotify + polling)
 *
 * Usage:
 *   node scripts/auto-dream.mjs <vaultPath> [--dry-run] [--watch] [--cron <hours>]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUGGY_TAGS = ['-', 'x2F', 'table-of-contents'];
const DEDUP_MAP = {
  'Python': 'python',
  'Typescript': 'typescript',
  'Javascript': 'javascript',
  'Rust': 'rust',
  'Go': 'go',
  'Java': 'java',
  'Kotlin': 'kotlin',
  'Shell': 'shell',
  'Docker': 'docker',
  'Linux': 'linux',
  'Windows': 'windows',
  'Android': 'android',
  'Ai': 'ai',
};

const frontmatterRe = /^---\s*\n([\s\S]*?)\n---/;
const inlineTagRe = /#[\w\-\u0400-\u04FF\u00C0-\u00FF]+/g;

async function walk(dir, cb) {
  let entries;
  try { entries = await fs.readdir(dir); } catch { return; }
  for (const f of entries) {
    if (f === '.obsidian') continue;
    const full = path.join(dir, f);
    const st = await fs.stat(full).catch(() => null);
    if (!st) continue;
    if (st.isDirectory()) {
      await walk(full, cb);
    } else if (f.endsWith('.md')) {
      await cb(full, path.relative(dir, full).replace(/\\/g, '/'));
    }
  }
}

async function autoDream(vaultPath, dryRun = false) {
  const logPath = path.join(vaultPath, '.obsidian', 'auto-dream.log');
  const now = new Date().toISOString();

  const stats = {
    vault: vaultPath,
    timestamp: now,
    dryRun,
    prunedEmpty: [],
    prunedCache: [],
    fixedTags: [],
    dedupedTags: [],
    errors: [],
  };

  console.log(`[AutoDream] Starting scan: ${vaultPath} ${dryRun ? '(DRY RUN)' : ''}`);

  // ─── 1. Prune empty files ───
  await walk(vaultPath, async (fullPath, relPath) => {
    const st = await fs.stat(fullPath);
    if (st.size === 0) {
      stats.prunedEmpty.push(relPath);
      if (!dryRun) {
        try {
          await fs.unlink(fullPath);
        } catch (e) {
          stats.errors.push({ op: 'prune-empty', path: relPath, error: e.message });
        }
      }
    }
  });
  console.log(`[AutoDream] Prune empty: ${stats.prunedEmpty.length} files`);

  // ─── 2. Prune github_cache ───
  const cacheDir = path.join(vaultPath, 'github_cache');
  try {
    const cacheStat = await fs.stat(cacheDir);
    if (cacheStat.isDirectory()) {
      const cacheFiles = [];
      await walk(cacheDir, async (fullPath, relPath) => {
        cacheFiles.push(relPath);
      });
      stats.prunedCache = cacheFiles;
      if (!dryRun) {
        await fs.rm(cacheDir, { recursive: true, force: true });
      }
      console.log(`[AutoDream] Prune github_cache: ${cacheFiles.length} files`);
    }
  } catch {
    // github_cache does not exist
  }

  // ─── 3. Fix buggy tags + dedup tags ───
  await walk(vaultPath, async (fullPath, relPath) => {
    if (relPath.startsWith('github_cache/')) return;
    let content;
    try { content = await fs.readFile(fullPath, 'utf-8'); } catch { return; }

    let modified = false;
    const fmMatch = frontmatterRe.exec(content);

    // Fix frontmatter tags
    if (fmMatch) {
      let fm = fmMatch[1];
      const tagsMatch = fm.match(/^tags:\s*(.+)$/m);
      if (tagsMatch) {
        const originalTagLine = tagsMatch[0];
        let tagLine = originalTagLine;

        // Fix buggy tags
        for (const bug of BUGGY_TAGS) {
          const re = new RegExp(`\\b${bug}\\b`, 'g');
          if (tagLine.match(re)) {
            tagLine = tagLine.replace(re, '');
            modified = true;
          }
        }

        // Dedup tags (case normalization)
        for (const [wrong, right] of Object.entries(DEDUP_MAP)) {
          const re = new RegExp(`\\b${wrong}\\b`, 'g');
          if (tagLine.match(re)) {
            tagLine = tagLine.replace(re, right);
            modified = true;
          }
        }

        // Clean up empty arrays / stray commas
        tagLine = tagLine.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');

        if (tagLine !== originalTagLine) {
          content = content.replace(originalTagLine, tagLine);
          stats.fixedTags.push(relPath);
          modified = true;
        }
      }
    }

    // Fix inline tags
    let inlineFixed = false;
    content = content.replace(inlineTagRe, (match) => {
      const tag = match.slice(1);
      if (BUGGY_TAGS.includes(tag)) {
        inlineFixed = true;
        return '';
      }
      for (const [wrong, right] of Object.entries(DEDUP_MAP)) {
        if (tag === wrong) {
          inlineFixed = true;
          return '#' + right;
        }
      }
      return match;
    });

    if (inlineFixed && !stats.fixedTags.includes(relPath)) {
      stats.fixedTags.push(relPath);
      modified = true;
    }

    // Clean up double spaces left by removed inline tags
    if (inlineFixed) {
      content = content.replace(/  +/g, ' ').replace(/\n +\n/g, '\n\n');
    }

    if (modified && !dryRun) {
      try {
        await fs.writeFile(fullPath, content, 'utf-8');
      } catch (e) {
        stats.errors.push({ op: 'fix-tags', path: relPath, error: e.message });
      }
    }
  });
  console.log(`[AutoDream] Fix tags: ${stats.fixedTags.length} files`);

  // ─── 4. Write log ───
  const logEntry = `[${now}] ${dryRun ? 'DRY-RUN' : 'APPLIED'} | empty=${stats.prunedEmpty.length} cache=${stats.prunedCache.length} fixTags=${stats.fixedTags.length} errors=${stats.errors.length}\n`;
  try {
    if (!dryRun) {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry, 'utf-8');
    }
  } catch {
    // ignore log write errors
  }

  console.log(`[AutoDream] Done. Total fixed: ${stats.fixedTags.length}, pruned: ${stats.prunedEmpty.length + stats.prunedCache.length}`);
  return stats;
}

// ─── Cross-platform file watcher (chokidar) ───
function startWatch(vaultPath, debounceMs = 300000) {
  console.log(`[AutoDream] Watch mode started on ${vaultPath} (debounce: ${debounceMs}ms)`);
  let timer = null;

  const watcher = chokidar.watch(vaultPath, {
    ignored: /(^|[\/\\])\./, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 99,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
  });

  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`[AutoDream] File change detected, triggering auto-dream...`);
      autoDream(vaultPath, false).catch(console.error);
    }, debounceMs);
  };

  watcher
    .on('add', trigger)
    .on('change', trigger)
    .on('unlink', trigger)
    .on('addDir', trigger)
    .on('unlinkDir', trigger)
    .on('error', (err) => console.error(`[AutoDream] Watch error: ${err.message}`));

  return watcher;
}

// ─── Cron mode ───
function startCron(vaultPath, intervalHours = 24) {
  const ms = intervalHours * 60 * 60 * 1000;
  console.log(`[AutoDream] Cron mode started: every ${intervalHours}h (${ms}ms)`);
  autoDream(vaultPath, false).catch(console.error);
  return setInterval(() => {
    console.log(`[AutoDream] Cron trigger: running auto-dream...`);
    autoDream(vaultPath, false).catch(console.error);
  }, ms);
}

// ─── Cross-platform scheduler installer ───
async function installScheduler(vaultPath, intervalHours = 24) {
  const platform = process.platform;
  const scriptPath = path.resolve(__dirname, 'auto-dream.mjs');
  const nodePath = process.execPath;

  console.log(`[AutoDream] Installing ${platform} scheduler...`);

  if (platform === 'win32') {
    // Windows Task Scheduler
    const taskName = 'ObsidianAutoDream';
    const cmd = `schtasks /create /tn "${taskName}" /tr "\\"${nodePath}\\" \\"${scriptPath}\\" \\"${vaultPath}\\"" /sc daily /st 03:00 /f`;
    console.log(`[AutoDream] Run as Administrator:\n${cmd}`);
    return { platform, command: cmd, note: 'Requires Administrator privileges' };
  }

  if (platform === 'darwin') {
    // macOS launchd
    const plistPath = path.join(process.env.HOME, 'Library/LaunchAgents/com.obsidian.autodream.plist');
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.obsidian.autodream</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${scriptPath}</string>
    <string>${vaultPath}</string>
    <string>--cron</string>
    <string>${intervalHours}</string>
  </array>
  <key>StartInterval</key><integer>${intervalHours * 3600}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${path.join(vaultPath, '.obsidian', 'auto-dream.out.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(vaultPath, '.obsidian', 'auto-dream.err.log')}</string>
</dict>
</plist>`;
    await fs.mkdir(path.dirname(plistPath), { recursive: true });
    await fs.writeFile(plistPath, plist, 'utf-8');
    console.log(`[AutoDream] launchd plist created: ${plistPath}`);
    console.log(`[AutoDream] Run: launchctl load ${plistPath}`);
    return { platform, plistPath, loadCommand: `launchctl load ${plistPath}` };
  }

  // Linux cron
  const cronLine = `0 3 * * * ${nodePath} ${scriptPath} ${vaultPath} --cron ${intervalHours} >> ${path.join(vaultPath, '.obsidian', 'auto-dream.out.log')} 2>&1`;
  console.log(`[AutoDream] Add to crontab:\n${cronLine}`);
  console.log(`[AutoDream] Run: crontab -e`);
  return { platform, cronLine, note: 'Add line via crontab -e' };
}

// ─── CLI ───
const vaultPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const watch = process.argv.includes('--watch');
const cronIdx = process.argv.indexOf('--cron');
const cronHours = cronIdx >= 0 ? parseInt(process.argv[cronIdx + 1]) || 24 : null;
const installIdx = process.argv.indexOf('--install-scheduler');

if (!vaultPath) {
  console.error('Usage: node auto-dream.mjs <vaultPath> [--dry-run] [--watch] [--cron <hours>] [--install-scheduler]');
  console.error('');
  console.error('  --dry-run            Preview changes without applying');
  console.error('  --watch              Watch file changes (cross-platform via chokidar)');
  console.error('  --cron <hours>       Run periodically every N hours');
  console.error('  --install-scheduler  Install OS scheduler (Windows Task Scheduler / macOS launchd / Linux cron)');
  process.exit(1);
}

const resolvedVault = path.resolve(vaultPath);

if (installIdx >= 0) {
  installScheduler(resolvedVault, cronHours || 24)
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
} else if (watch) {
  const watcher = startWatch(resolvedVault);
  process.on('SIGINT', () => { console.log('[AutoDream] Stopping watcher...'); watcher.close().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { console.log('[AutoDream] Stopping watcher...'); watcher.close().then(() => process.exit(0)); });
} else if (cronHours !== null) {
  const interval = startCron(resolvedVault, cronHours);
  process.on('SIGINT', () => { console.log('[AutoDream] Stopping cron...'); clearInterval(interval); process.exit(0); });
  process.on('SIGTERM', () => { console.log('[AutoDream] Stopping cron...'); clearInterval(interval); process.exit(0); });
} else {
  autoDream(resolvedVault, dryRun)
    .then((stats) => {
      if (dryRun) {
        console.log('\n=== DRY RUN SUMMARY ===');
        console.log(JSON.stringify(stats, null, 2));
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
