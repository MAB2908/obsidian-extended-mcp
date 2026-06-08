// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import { validatePath, safeJsonParse } from './utils.js';
import { PathSecurityError } from './errors.js';

export interface FileHandler {
  mimeTypes: string[];
  extensions: string[];
  read(filePath: string): Promise<unknown>;
  write?(filePath: string, data: unknown): Promise<void>;
}

export class FileTypeRouter {
  private handlers: FileHandler[] = [];
  private vaultRoot?: string;

  constructor(vaultRoot?: string) {
    this.vaultRoot = vaultRoot;
  }

  register(handler: FileHandler): void {
    this.handlers.push(handler);
  }

  private async guard(filePath: string): Promise<void> {
    if (!this.vaultRoot) return;
    const rel = path.relative(this.vaultRoot, filePath);
    await validatePath(this.vaultRoot, rel);
    // Symlink traversal protection: resolve real path and ensure it stays inside vault
    try {
      const real = await fs.realpath(filePath);
      const rootReal = await fs.realpath(this.vaultRoot);
      const rootWithSep = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
      if (real !== rootReal && !real.startsWith(rootWithSep)) {
        throw new PathSecurityError(rel);
      }
    } catch (err) {
      if (err instanceof PathSecurityError) throw err;
      // ignore other realpath failures
    }
  }

  async read(filePath: string): Promise<unknown> {
    await this.guard(filePath);
    // Yield event loop before potentially large file reads to prevent MCP transport starvation.
    await new Promise((resolve) => setImmediate(resolve));
    const ext = path.extname(filePath).toLowerCase();
    const mime = this.detectMime(filePath);
    for (const handler of this.handlers) {
      if (handler.extensions.includes(ext) || handler.mimeTypes.includes(mime)) {
        return handler.read(filePath);
      }
    }
    // Default: text for known text extensions, otherwise buffer + base64
    if (this.isTextExtension(ext)) {
      return fs.readFile(filePath, 'utf-8');
    }
    const buffer = await fs.readFile(filePath);
    return { type: 'base64', data: buffer.toString('base64'), mime };
  }

  async write(filePath: string, data: unknown): Promise<void> {
    await this.guard(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = this.detectMime(filePath);
    for (const handler of this.handlers) {
      if (handler.write && (handler.extensions.includes(ext) || handler.mimeTypes.includes(mime))) {
        return handler.write(filePath, data);
      }
    }
    // Default text write
    if (typeof data === 'string') {
      await fs.writeFile(filePath, data, 'utf-8');
      return;
    }
    if (data && typeof data === 'object' && 'type' in data && (data as { type: string }).type === 'base64' && 'data' in data && typeof (data as Record<string, unknown>).data === 'string') {
      await fs.writeFile(filePath, Buffer.from((data as { data: string }).data, 'base64'));
      return;
    }
    throw new Error(`Unsupported write format for ${filePath}`);
  }

  private detectMime(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.md': 'text/markdown',
      '.canvas': 'application/json',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf',
    };
    return map[ext] || 'application/octet-stream';
  }

  private isTextExtension(ext: string): boolean {
    return ['.md', '.txt', '.json', '.canvas', '.svg', '.css', '.js', '.ts', '.html', '.xml', '.yaml', '.yml'].includes(ext);
  }
}

export const markdownHandler: FileHandler = {
  mimeTypes: ['text/markdown'],
  extensions: ['.md'],
  async read(filePath: string) {
    return fs.readFile(filePath, 'utf-8');
  },
  async write(filePath: string, data: unknown) {
    await fs.writeFile(filePath, String(data), 'utf-8');
  },
};

export const canvasHandler: FileHandler = {
  mimeTypes: ['application/json'],
  extensions: ['.canvas'],
  async read(filePath: string) {
    const raw = await fs.readFile(filePath, 'utf-8');
    return safeJsonParse(raw);
  },
  async write(filePath: string, data: unknown) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  },
};

export const jsonHandler: FileHandler = {
  mimeTypes: ['application/json'],
  extensions: ['.json'],
  async read(filePath: string) {
    const raw = await fs.readFile(filePath, 'utf-8');
    return safeJsonParse(raw);
  },
  async write(filePath: string, data: unknown) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  },
};
