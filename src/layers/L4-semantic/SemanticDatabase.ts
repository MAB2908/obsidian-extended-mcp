// v0.2b:
import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs, mkdirSync } from 'fs';
import type { ISemanticDatabase } from '../../shared/interfaces/ISemanticDatabase.js';

export interface DbNode {
  path: string;
  title: string;
  contentHash: string;
  wordCount: number;
}

export interface DbEdge {
  fromPath: string;
  toPath: string;
  type: 'wikilink' | 'backlink' | 'implicit' | 'alias';
  context?: string;
}

export interface DbChunk {
  nodePath: string;
  chunkIndex: number;
  heading?: string;
  content: string;
  tokenCount?: number;
}

export interface DbEmbedding {
  chunkId: number;
  model: string;
  vector: Float32Array;
  dimensions: number;
}

export interface FTSSearchResult {
  path: string;
  score: number;
  snippet?: string;
}

export class SemanticDatabase implements ISemanticDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(vaultPath: string) {
    this.dbPath = path.join(vaultPath, '.mcp-cache', 'semantic.db');
    mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
  }

  async initSchema(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    this.db.exec(`PRAGMA journal_mode = WAL;`);
    this.db.exec(`PRAGMA synchronous = NORMAL;`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        title TEXT,
        content_hash TEXT,
        word_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_path TEXT NOT NULL,
        to_path TEXT NOT NULL,
        type TEXT DEFAULT 'wikilink',
        context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_path, to_path, type)
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        heading TEXT,
        content TEXT NOT NULL,
        token_count INTEGER,
        UNIQUE(node_path, chunk_index)
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        chunk_id INTEGER PRIMARY KEY,
        model TEXT NOT NULL,
        vector BLOB NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
      );
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        path,
        title,
        content,
        tokenize = 'porter'
      );
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_path);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_path);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_node ON chunks(node_path);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path);`);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes
      BEGIN
        INSERT INTO search_index(path, title, content)
        VALUES (NEW.path, NEW.title, '');
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes
      BEGIN
        UPDATE search_index SET title = NEW.title WHERE path = NEW.path;
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes
      BEGIN
        DELETE FROM search_index WHERE path = OLD.path;
      END;
    `);
  }

  upsertNode(node: DbNode): void {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (path, title, content_hash, word_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        title = excluded.title,
        content_hash = excluded.content_hash,
        word_count = excluded.word_count,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(node.path, node.title, node.contentHash, node.wordCount);
  }

  deleteNode(path: string): void {
    this.db.prepare(`DELETE FROM nodes WHERE path = ?`).run(path);
  }

  getNode(path: string): DbNode | undefined {
    const row = this.db.prepare(`SELECT path, title, content_hash, word_count FROM nodes WHERE path = ?`).get(path) as
      | { path: string; title: string; content_hash: string; word_count: number }
      | undefined;
    if (!row) return undefined;
    return { path: row.path, title: row.title, contentHash: row.content_hash, wordCount: row.word_count };
  }

  upsertEdge(edge: DbEdge): void {
    const stmt = this.db.prepare(`
      INSERT INTO edges (from_path, to_path, type, context)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(from_path, to_path, type) DO UPDATE SET
        context = excluded.context
    `);
    stmt.run(edge.fromPath, edge.toPath, edge.type, edge.context ?? null);
  }

  deleteEdgesFrom(fromPath: string): void {
    this.db.prepare(`DELETE FROM edges WHERE from_path = ?`).run(fromPath);
  }

  getEdges(fromPath: string): DbEdge[] {
    const rows = this.db.prepare(`SELECT from_path, to_path, type, context FROM edges WHERE from_path = ?`).all(fromPath) as Array<{
      from_path: string; to_path: string; type: string; context: string | null;
    }>;
    return rows.map((r) => ({ fromPath: r.from_path, toPath: r.to_path, type: r.type as DbEdge['type'], context: r.context ?? undefined }));
  }

  upsertChunk(chunk: DbChunk): number {
    const stmt = this.db.prepare(`
      INSERT INTO chunks (node_path, chunk_index, heading, content, token_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(node_path, chunk_index) DO UPDATE SET
        heading = excluded.heading,
        content = excluded.content,
        token_count = excluded.token_count
    `);
    const info = stmt.run(chunk.nodePath, chunk.chunkIndex, chunk.heading ?? null, chunk.content, chunk.tokenCount ?? null);
    return Number(info.lastInsertRowid) || this.getChunkId(chunk.nodePath, chunk.chunkIndex);
  }

  private getChunkId(nodePath: string, chunkIndex: number): number {
    const row = this.db.prepare(`SELECT id FROM chunks WHERE node_path = ? AND chunk_index = ?`).get(nodePath, chunkIndex) as { id: number } | undefined;
    return row?.id ?? 0;
  }

  deleteChunks(nodePath: string): void {
    this.db.prepare(`DELETE FROM chunks WHERE node_path = ?`).run(nodePath);
  }

  getChunks(nodePath: string): Array<DbChunk & { id: number }> {
    const rows = this.db.prepare(`SELECT id, node_path, chunk_index, heading, content, token_count FROM chunks WHERE node_path = ?`).all(nodePath) as Array<{
      id: number; node_path: string; chunk_index: number; heading: string | null; content: string; token_count: number | null;
    }>;
    return rows.map((r) => ({ id: r.id, nodePath: r.node_path, chunkIndex: r.chunk_index, heading: r.heading ?? undefined, content: r.content, tokenCount: r.token_count ?? undefined }));
  }

  upsertEmbedding(emb: DbEmbedding): void {
    const buf = Buffer.from(emb.vector.buffer, emb.vector.byteOffset, emb.vector.byteLength);
    const stmt = this.db.prepare(`
      INSERT INTO embeddings (chunk_id, model, vector, dimensions)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(chunk_id) DO UPDATE SET
        model = excluded.model,
        vector = excluded.vector,
        dimensions = excluded.dimensions
    `);
    stmt.run(emb.chunkId, emb.model, buf, emb.dimensions);
  }

  deleteEmbeddingsForNode(nodePath: string): void {
    this.db.prepare(`
      DELETE FROM embeddings WHERE chunk_id IN (
        SELECT id FROM chunks WHERE node_path = ?
      )
    `).run(nodePath);
  }

  searchFTS(query: string, limit = 20): FTSSearchResult[] {
    const stmt = this.db.prepare(`
      SELECT path, rank, snippet(search_index, 0, '>>>', '<<<', '...', 32) AS snippet
      FROM search_index
      WHERE search_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    const rows = stmt.all(query, limit) as Array<{ path: string; rank: number; snippet: string }>;
    return rows.map((r) => ({ path: r.path, score: 1 / (1 + Math.abs(r.rank)), snippet: r.snippet }));
  }

  searchSimilar(queryVector: Float32Array, model: string, topK = 10): FTSSearchResult[] {
    const limit = topK * 10;
    const rows = this.db.prepare(`
      SELECT e.chunk_id, e.vector, c.node_path, c.content
      FROM embeddings e
      JOIN chunks c ON c.id = e.chunk_id
      WHERE e.model = ?
      LIMIT ?
    `).all(model, limit) as Array<{ chunk_id: number; vector: Buffer; node_path: string; content: string }>;

    const scored = rows.map((r) => {
      // Copy to guarantee 4-byte alignment (Buffer may be a view into pooled memory)
      const buf = Buffer.from(r.vector);
      const vec = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      const score = cosineSimilarity(queryVector, vec);
      return { path: r.node_path, score, snippet: r.content.slice(0, 200) };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  updateFTSContent(path: string, content: string): void {
    // Virtual FTS tables do not support UPSERT — use DELETE+INSERT
    this.db.prepare(`DELETE FROM search_index WHERE path = ?`).run(path);
    this.db.prepare(`INSERT INTO search_index(path, title, content) VALUES (?, ?, ?)`).run(path, '', content);
  }

  getStats(): { nodes: number; edges: number; chunks: number; embeddings: number } {
    const nodes = (this.db.prepare(`SELECT COUNT(*) as c FROM nodes`).get() as { c: number }).c;
    const edges = (this.db.prepare(`SELECT COUNT(*) as c FROM edges`).get() as { c: number }).c;
    const chunks = (this.db.prepare(`SELECT COUNT(*) as c FROM chunks`).get() as { c: number }).c;
    const embeddings = (this.db.prepare(`SELECT COUNT(*) as c FROM embeddings`).get() as { c: number }).c;
    return { nodes, edges, chunks, embeddings };
  }

  close(): void {
    this.db.close();
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
