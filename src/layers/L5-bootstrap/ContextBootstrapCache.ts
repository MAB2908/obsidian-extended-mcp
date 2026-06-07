// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';

export class ContextBootstrapCache {
  private cache: {
    ontology: string | null;
    protocol: string | null;
    linkRules: string | null;
    structure: string | null;
    skills: string | null;
    mtime: Record<string, number>;
  } = {
    ontology: null,
    protocol: null,
    linkRules: null,
    structure: null,
    skills: null,
    mtime: {},
  };

  constructor(private vaultPath: string) {}

  async get(key: 'ontology' | 'protocol' | 'linkRules' | 'structure' | 'skills'): Promise<string | null> {
    if (key === 'structure') {
      return this.generateStructure();
    }

    const filePath = this.resolvePath(key);
    try {
      const stat = await fs.stat(filePath);
      const currentMtime = stat.mtimeMs;

      if (this.cache.mtime[key] !== currentMtime) {
        this.cache[key] = await fs.readFile(filePath, 'utf8');
        this.cache.mtime[key] = currentMtime;
      }

      return this.cache[key];
    } catch {
      return null;
    }
  }

  invalidate(key?: string): void {
    if (key) {
      (this.cache as Record<string, unknown>)[key] = null;
      this.cache.mtime[key] = 0;
    } else {
      this.cache.ontology = null;
      this.cache.protocol = null;
      this.cache.linkRules = null;
      this.cache.structure = null;
      this.cache.skills = null;
      Object.keys(this.cache.mtime).forEach((k) => (this.cache.mtime[k] = 0));
    }
  }

  private resolvePath(key: string): string {
    const map: Record<string, string> = {
      ontology: 'meta/ontology.md',
      protocol: 'meta/protocol.md',
      linkRules: 'meta/link-rules.md',
      skills: 'meta/skills.md',
    };
    return path.join(this.vaultPath, map[key]);
  }

  private async generateStructure(): Promise<string> {
    const lines: string[] = [];
    const walk = async (dir: string, prefix = '') => {
      try {
        const entries = await fs.readdir(path.join(this.vaultPath, dir), { withFileTypes: true });
        for (const e of entries) {
          if (e.name.startsWith('.')) continue;
          const rel = dir ? `${dir}/${e.name}` : e.name;
          const display = prefix ? `${prefix}/${e.name}` : e.name;
          if (e.isDirectory()) {
            lines.push(`${display}/`);
            await walk(rel, display);
          } else if (e.name.endsWith('.md')) {
            lines.push(display);
          }
        }
      } catch {
        // skip unreadable dirs
      }
    };
    await walk('');
    return lines.join('\n');
  }
}
