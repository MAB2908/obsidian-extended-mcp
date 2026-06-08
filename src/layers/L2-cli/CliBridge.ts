// v0.2b:
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import type { ILayer2CliBridge } from '../../shared/types.js';
import type { SearchResult } from '../../shared/types.js';
import {
  CliNotFoundError,
  CliTimeoutError,
  UnknownCliActionError,
  CliResponseError,
  CliExitError,
  CliParseError,
} from '../../shared/errors.js';
import { safeJsonParse } from '../../shared/utils.js';

const execAsync = promisify(exec);

export class CliBridge implements ILayer2CliBridge {
  private cliPath: string | null = null;
  private vaultPath: string;

  constructor(vaultPath: string, cliPath?: string) {
    this.vaultPath = vaultPath;
    if (cliPath) this.cliPath = cliPath;
  }

  async isAvailable(): Promise<boolean> {
    if (this.cliPath) {
      // Windows GUI applications (like Obsidian.exe) cannot produce stdout
      // when spawned via child_process, making them unsuitable as CLI bridges.
      if (process.platform === 'win32' && /obsidian\.exe$/i.test(this.cliPath)) {
        return false;
      }
      return true;
    }
    try {
      const cmd = process.platform === 'win32' ? 'where obsidian' : 'which obsidian';
      const { stdout } = await execAsync(cmd);
      const path = stdout.trim().split('\n')[0];
      if (path) {
        this.cliPath = path.trim();
        return true;
      }
    } catch {
      // not found
    }
    return false;
  }

  async eval(code: string, timeout = 10000): Promise<unknown> {
    if (!this.cliPath && !(await this.isAvailable())) {
      throw new CliNotFoundError();
    }
    const wrapped = `(async () => { try { const __result = await (async () => { ${code} })(); if (__result !== undefined) { console.log(typeof __result === 'string' ? __result : JSON.stringify(__result)); } } catch (e) { console.error(JSON.stringify({error: String(e.message || e)})); } })()`;
    return this.runCli(['eval', `code=${wrapped}`], timeout);
  }

  async backlinks(path: string): Promise<Array<{ source: string; line: number; context?: string }>> {
    const result = await this.eval(`
      const file = app.vault.getAbstractFileByPath(${JSON.stringify(path)});
      if (!file) return [];
      const links = app.metadataCache.getBacklinksForFile(file);
      const data = links?.data ?? {};
      const out = [];
      for (const [source, arr] of Object.entries(data)) {
        for (const item of arr) {
          out.push({ source, line: item.position?.start?.line ?? 0, context: item.displayText || '' });
        }
      }
      return JSON.stringify(out);
    `);
    return this.parseJson(result as string);
  }

  async orphans(folder?: string): Promise<string[]> {
    const result = await this.eval(`
      const files = app.vault.getMarkdownFiles();
      const orphans = [];
      for (const f of files) {
        if (${folder ? `!f.path.startsWith(${JSON.stringify(folder)})` : 'false'}) continue;
        const cache = app.metadataCache.getFileCache(f);
        const links = cache?.links?.length || 0;
        const embeds = cache?.embeds?.length || 0;
        const back = app.metadataCache.getBacklinksForFile(f)?.data || {};
        const backCount = Object.keys(back).length;
        if (links === 0 && embeds === 0 && backCount === 0) orphans.push(f.path);
      }
      return JSON.stringify(orphans);
    `);
    return this.parseJson(result as string);
  }

  async unresolved(folder?: string): Promise<Array<{ link: string; source: string; line: number }>> {
    const result = await this.eval(`
      const files = app.vault.getMarkdownFiles();
      const out = [];
      for (const f of files) {
        if (${folder ? `!f.path.startsWith(${JSON.stringify(folder)})` : 'false'}) continue;
        const cache = app.metadataCache.getFileCache(f);
        for (const link of (cache?.links || [])) {
          if (link.link && !app.metadataCache.getFirstLinkpathDest(link.link, f.path)) {
            out.push({ link: link.link, source: f.path, line: link.position?.start?.line ?? 0 });
          }
        }
      }
      return JSON.stringify(out);
    `);
    return this.parseJson(result as string);
  }

  async deadends(folder?: string): Promise<string[]> {
    const result = await this.eval(`
      const files = app.vault.getMarkdownFiles();
      const dead = [];
      for (const f of files) {
        if (${folder ? `!f.path.startsWith(${JSON.stringify(folder)})` : 'false'}) continue;
        const cache = app.metadataCache.getFileCache(f);
        const hasOut = (cache?.links?.length || 0) > 0 || (cache?.embeds?.length || 0) > 0;
        const back = app.metadataCache.getBacklinksForFile(f)?.data || {};
        const hasIn = Object.keys(back).length > 0;
        if (hasOut && !hasIn) dead.push(f.path);
      }
      return JSON.stringify(dead);
    `);
    return this.parseJson(result as string);
  }

  async properties(
    file: string,
    action: 'read' | 'set' | 'remove' | 'list',
    property?: string,
    value?: string
  ): Promise<unknown> {
    let code: string;
    switch (action) {
      case 'read':
        code = `return JSON.stringify(app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(${JSON.stringify(file)}))?.frontmatter || {})`;
        break;
      case 'list':
        code = `return JSON.stringify(Object.keys(app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(${JSON.stringify(file)}))?.frontmatter || {}))`;
        break;
      case 'set':
        code = `
          const f = app.vault.getAbstractFileByPath(${JSON.stringify(file)});
          app.fileManager.processFrontMatter(f, (fm) => { fm[${JSON.stringify(property)}] = ${JSON.stringify(value)}; });
          return JSON.stringify({ok: true})
        `;
        break;
      case 'remove':
        code = `
          const f = app.vault.getAbstractFileByPath(${JSON.stringify(file)});
          app.fileManager.processFrontMatter(f, (fm) => { delete fm[${JSON.stringify(property)}]; });
          return JSON.stringify({ok: true})
        `;
        break;
      default:
        throw new UnknownCliActionError(action, 'properties');
    }
    const result = await this.eval(code);
    return this.parseJson(result as string);
  }

  async search(query: string, _context = false): Promise<SearchResult[]> {
    const result = await this.eval(`
      const global = app.plugins.plugins['obsidian-search'] || app.internal;
      // Fallback: search via metadataCache iteration
      const files = app.vault.getMarkdownFiles();
      const q = ${JSON.stringify(query)}.toLowerCase();
      const out = [];
      for (const f of files) {
        const content = await app.vault.cachedRead(f);
        if (content.toLowerCase().includes(q)) {
          const idx = content.toLowerCase().indexOf(q);
          out.push({ path: f.path, snippet: content.slice(Math.max(0, idx - 60), idx + 120) });
        }
      }
      return JSON.stringify(out);
    `);
    const raw = this.parseJson(result as string) as Array<{ path: string; snippet: string }>;
    return raw.map((r) => ({ path: r.path, score: 1, snippet: r.snippet, highlights: [query] }));
  }

  async daily(action: 'read' | 'append' | 'prepend', content?: string): Promise<string> {
    const result = await this.eval(`
      const dp = app.plugins.plugins['periodic-notes'] || app.internal?.dailyNotes;
      const file = dp?.getDailyNote ? dp.getDailyNote() : null;
      if (!file) return JSON.stringify({error: 'Daily note not configured'});
      if (${JSON.stringify(action)} === 'read') {
        const text = await app.vault.cachedRead(file);
        return JSON.stringify({content: text});
      } else {
        const existing = await app.vault.cachedRead(file);
        const updated = ${JSON.stringify(action)} === 'prepend' ? (${JSON.stringify(content || '')} + '\\n' + existing) : (existing + '\\n' + ${JSON.stringify(content || '')});
        await app.vault.modify(file, updated);
        return JSON.stringify({ok: true});
      }
    `);
    const parsed = this.parseJson(result as string) as { content?: string; error?: string };
    if (parsed.error) throw new CliResponseError(parsed.error);
    return parsed.content || '';
  }

  async command(name: string): Promise<void> {
    await this.eval(`app.commands.executeCommandById(${JSON.stringify(name)})`);
  }

  async plugin(action: string, id?: string): Promise<unknown> {
    let code: string;
    switch (action) {
      case 'enable':
        code = `return JSON.stringify({ok: app.plugins.enablePlugin(${JSON.stringify(id)})})`;
        break;
      case 'disable':
        code = `app.plugins.disablePlugin(${JSON.stringify(id)}); return JSON.stringify({ok: true})`;
        break;
      case 'list':
        code = `return JSON.stringify(Object.values(app.plugins.plugins).map(p => ({id: p.manifest.id, name: p.manifest.name, enabled: p._loaded})))`;
        break;
      default:
        throw new UnknownCliActionError(action, 'plugin');
    }
    const result = await this.eval(code);
    return this.parseJson(result as string);
  }

  // Private helpers

  private runCli(args: string[], timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.cliPath!, args, {
        cwd: this.vaultPath,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          OBSIDIAN_VAULT_PATH: this.vaultPath,
        },
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill();
        reject(new CliTimeoutError(timeout));
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      const cleanup = () => {
        clearTimeout(timer);
        proc.removeAllListeners();
      };
      proc.on('close', (code) => {
        cleanup();
        if (code !== 0) {
          reject(new CliExitError(code ?? -1, stderr));
        } else {
          resolve(stdout.trim());
        }
      });
      proc.on('error', (_err) => {
        cleanup();
        reject(new CliNotFoundError());
      });
    });
  }

  private parseJson<T>(raw: string): T {
    try {
      return safeJsonParse(raw) as T;
    } catch {
      // Some obsidian eval outputs wrap JSON in quotes or add prefixes
      const match = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (match) {
        return safeJsonParse(match[0]) as T;
      }
      throw new CliParseError(raw.slice(0, 200));
    }
  }
}
