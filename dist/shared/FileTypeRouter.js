// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import { validatePath, safeJsonParse } from './utils.js';
import { PathSecurityError } from './errors.js';
export class FileTypeRouter {
    handlers = [];
    vaultRoot;
    constructor(vaultRoot) {
        this.vaultRoot = vaultRoot;
    }
    register(handler) {
        this.handlers.push(handler);
    }
    async guard(filePath) {
        if (!this.vaultRoot)
            return;
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
        }
        catch (err) {
            if (err instanceof PathSecurityError)
                throw err;
            // ignore other realpath failures
        }
    }
    async read(filePath) {
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
    async write(filePath, data) {
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
        if (data && typeof data === 'object' && 'type' in data && data.type === 'base64' && 'data' in data && typeof data.data === 'string') {
            await fs.writeFile(filePath, Buffer.from(data.data, 'base64'));
            return;
        }
        throw new Error(`Unsupported write format for ${filePath}`);
    }
    detectMime(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const map = {
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
    isTextExtension(ext) {
        return ['.md', '.txt', '.json', '.canvas', '.svg', '.css', '.js', '.ts', '.html', '.xml', '.yaml', '.yml'].includes(ext);
    }
}
export const markdownHandler = {
    mimeTypes: ['text/markdown'],
    extensions: ['.md'],
    async read(filePath) {
        return fs.readFile(filePath, 'utf-8');
    },
    async write(filePath, data) {
        await fs.writeFile(filePath, String(data), 'utf-8');
    },
};
export const canvasHandler = {
    mimeTypes: ['application/json'],
    extensions: ['.canvas'],
    async read(filePath) {
        const raw = await fs.readFile(filePath, 'utf-8');
        return safeJsonParse(raw);
    },
    async write(filePath, data) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    },
};
export const jsonHandler = {
    mimeTypes: ['application/json'],
    extensions: ['.json'],
    async read(filePath) {
        const raw = await fs.readFile(filePath, 'utf-8');
        return safeJsonParse(raw);
    },
    async write(filePath, data) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    },
};
//# sourceMappingURL=FileTypeRouter.js.map