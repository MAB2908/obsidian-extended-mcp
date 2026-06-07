// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import { PathSecurityError } from './errors.js';

export function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '');
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function validatePath(vaultRoot: string, requestedPath: string): Promise<string> {
  // Reject absolute paths and obvious path traversal markers
  if (requestedPath.startsWith('/')) {
    throw new PathSecurityError(requestedPath);
  }
  // Reject Windows absolute paths (C:\, \\server\share)
  if (/^[a-zA-Z]:[\\/]/.test(requestedPath) || requestedPath.startsWith('\\\\')) {
    throw new PathSecurityError(requestedPath);
  }
  const normalized = path.normalize(requestedPath).replace(/\\/g, '/');
  if (normalized.startsWith('../') || normalized.startsWith('..') || normalized.startsWith('~/')) {
    throw new PathSecurityError(requestedPath);
  }
  const full = path.resolve(vaultRoot, normalized);
  // Resolve symlinks to ensure containment
  let resolved: string;
  try {
    resolved = await fs.realpath(full);
  } catch {
    resolved = full;
  }
  // Also resolve vaultRoot to handle symlinked vault paths (HIGH-001)
  let resolvedRoot: string;
  try {
    resolvedRoot = await fs.realpath(vaultRoot);
  } catch {
    resolvedRoot = vaultRoot;
  }
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (!resolved.startsWith(rootWithSep) && resolved !== resolvedRoot) {
    throw new PathSecurityError(requestedPath);
  }
  return normalized;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(hash);
}

/** Safely parse JSON with size and depth limits to prevent bombs */
export function safeJsonParse(raw: string, maxSize = 10 * 1024 * 1024, maxDepth = 50): unknown {
  if (raw.length > maxSize) {
    throw new Error(`JSON payload exceeds maximum size of ${maxSize} bytes`);
  }
  const obj = JSON.parse(raw);
  const checkDepth = (value: unknown, depth: number): void => {
    if (depth > maxDepth) {
      throw new Error(`JSON payload exceeds maximum depth of ${maxDepth}`);
    }
    if (Array.isArray(value)) {
      for (const item of value) checkDepth(item, depth + 1);
    } else if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) checkDepth((value as Record<string, unknown>)[key], depth + 1);
    }
  };
  checkDepth(obj, 0);
  return obj;
}
