// v0.2b:
import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs, mkdirSync } from 'fs';
export class SemanticDatabase {
    db;
    dbPath;
    constructor(vaultPath) {
        this.dbPath = path.join(vaultPath, '.mcp-cache', 'semantic.db');
        mkdirSync(path.dirname(this.dbPath), { recursive: true });
        this.db = new Database(this.dbPath);
    }
    async initSchema() {
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
        tokenize = 'unicode61'
      );
    `);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_path);`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_path);`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_node ON chunks(node_path);`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path);`);
        // FTS is maintained explicitly via bulkUpdateFTS; drop legacy triggers if present
        this.db.exec(`DROP TRIGGER IF EXISTS nodes_fts_insert;`);
        this.db.exec(`DROP TRIGGER IF EXISTS nodes_fts_update;`);
        this.db.exec(`DROP TRIGGER IF EXISTS nodes_fts_delete;`);
    }
    createFTSTable() {
        this.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      path,
      title,
      content,
      tokenize = 'unicode61'
    );`);
    }
    upsertNode(node) {
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
    deleteNode(path) {
        this.db.prepare(`DELETE FROM nodes WHERE path = ?`).run(path);
    }
    getNode(path) {
        const row = this.db.prepare(`SELECT path, title, content_hash, word_count FROM nodes WHERE path = ?`).get(path);
        if (!row)
            return undefined;
        return { path: row.path, title: row.title, contentHash: row.content_hash, wordCount: row.word_count };
    }
    upsertEdge(edge) {
        const stmt = this.db.prepare(`
      INSERT INTO edges (from_path, to_path, type, context)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(from_path, to_path, type) DO UPDATE SET
        context = excluded.context
    `);
        stmt.run(edge.fromPath, edge.toPath, edge.type, edge.context ?? null);
    }
    deleteEdgesFrom(fromPath) {
        this.db.prepare(`DELETE FROM edges WHERE from_path = ?`).run(fromPath);
    }
    getEdges(fromPath) {
        const rows = this.db.prepare(`SELECT from_path, to_path, type, context FROM edges WHERE from_path = ?`).all(fromPath);
        return rows.map((r) => ({ fromPath: r.from_path, toPath: r.to_path, type: r.type, context: r.context ?? undefined }));
    }
    upsertChunk(chunk) {
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
    getChunkId(nodePath, chunkIndex) {
        const row = this.db.prepare(`SELECT id FROM chunks WHERE node_path = ? AND chunk_index = ?`).get(nodePath, chunkIndex);
        return row?.id ?? 0;
    }
    deleteChunks(nodePath) {
        this.db.prepare(`DELETE FROM chunks WHERE node_path = ?`).run(nodePath);
    }
    getChunks(nodePath) {
        const rows = this.db.prepare(`SELECT id, node_path, chunk_index, heading, content, token_count FROM chunks WHERE node_path = ?`).all(nodePath);
        return rows.map((r) => ({ id: r.id, nodePath: r.node_path, chunkIndex: r.chunk_index, heading: r.heading ?? undefined, content: r.content, tokenCount: r.token_count ?? undefined }));
    }
    upsertEmbedding(emb) {
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
    deleteEmbeddingsForNode(nodePath) {
        this.db.prepare(`
      DELETE FROM embeddings WHERE chunk_id IN (
        SELECT id FROM chunks WHERE node_path = ?
      )
    `).run(nodePath);
    }
    searchFTS(query, limit = 20) {
        const safeQuery = query
            .replace(/"/g, '""')
            .trim();
        const wrapped = safeQuery ? `"${safeQuery}"` : '';
        const stmt = this.db.prepare(`
      SELECT path, rank, snippet(search_index, 0, '>>>', '<<<', '...', 32) AS snippet
      FROM search_index
      WHERE search_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
        const rows = stmt.all(wrapped, limit);
        return rows.map((r) => ({ path: r.path, score: 1 / (1 + Math.abs(r.rank)), snippet: r.snippet }));
    }
    searchSimilar(queryVector, model, topK = 10) {
        const limit = topK * 10;
        const rows = this.db.prepare(`
      SELECT e.chunk_id, e.vector, c.node_path, c.content
      FROM embeddings e
      JOIN chunks c ON c.id = e.chunk_id
      WHERE e.model = ?
      LIMIT ?
    `).all(model, limit);
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
    updateFTSContent(path, content) {
        // Virtual FTS tables do not support UPSERT — use DELETE+INSERT
        this.db.prepare(`DELETE FROM search_index WHERE path = ?`).run(path);
        this.db.prepare(`INSERT INTO search_index(path, title, content) VALUES (?, ?, ?)`).run(path, '', content);
    }
    getStats() {
        const nodes = this.db.prepare(`SELECT COUNT(*) as c FROM nodes`).get().c;
        const edges = this.db.prepare(`SELECT COUNT(*) as c FROM edges`).get().c;
        const chunks = this.db.prepare(`SELECT COUNT(*) as c FROM chunks`).get().c;
        const embeddings = this.db.prepare(`SELECT COUNT(*) as c FROM embeddings`).get().c;
        return { nodes, edges, chunks, embeddings };
    }
    close() {
        this.db.close();
    }
    bulkIndex(nodes, edges, chunks) {
        const upsertNodeStmt = this.db.prepare(`
      INSERT INTO nodes (path, title, content_hash, word_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        title = excluded.title,
        content_hash = excluded.content_hash,
        word_count = excluded.word_count,
        updated_at = CURRENT_TIMESTAMP
    `);
        const upsertEdgeStmt = this.db.prepare(`
      INSERT INTO edges (from_path, to_path, type, context)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(from_path, to_path, type) DO UPDATE SET
        context = excluded.context
    `);
        const upsertChunkStmt = this.db.prepare(`
      INSERT INTO chunks (node_path, chunk_index, heading, content, token_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(node_path, chunk_index) DO UPDATE SET
        heading = excluded.heading,
        content = excluded.content,
        token_count = excluded.token_count
    `);
        const batchSize = 500;
        const chunkIds = [];
        console.error(`[SemanticDatabase] bulkIndex start: nodes=${nodes.length}, edges=${edges.length}, chunks=${chunks.length}`);
        const nodeTx = this.db.transaction((batch) => {
            for (const node of batch)
                upsertNodeStmt.run(node.path, node.title, node.contentHash, node.wordCount);
        });
        const edgeTx = this.db.transaction((batch) => {
            for (const edge of batch)
                upsertEdgeStmt.run(edge.fromPath, edge.toPath, edge.type, edge.context ?? null);
        });
        const chunkTx = this.db.transaction((batch) => {
            for (const chunk of batch) {
                const info = upsertChunkStmt.run(chunk.nodePath, chunk.chunkIndex, chunk.heading ?? null, chunk.content, chunk.tokenCount ?? null);
                chunk.id = Number(info.lastInsertRowid);
                chunkIds.push(chunk.id);
            }
        });
        console.error('[SemanticDatabase] inserting nodes...');
        for (let i = 0; i < nodes.length; i += batchSize) {
            nodeTx(nodes.slice(i, i + batchSize));
        }
        console.error('[SemanticDatabase] inserting edges...');
        for (let i = 0; i < edges.length; i += batchSize) {
            edgeTx(edges.slice(i, i + batchSize));
        }
        console.error('[SemanticDatabase] inserting chunks...');
        for (let i = 0; i < chunks.length; i += batchSize) {
            chunkTx(chunks.slice(i, i + batchSize));
        }
        console.error('[SemanticDatabase] bulkIndex done');
        return chunkIds;
    }
    clearAll() {
        console.error('[SemanticDatabase] clearAll start');
        this.db.exec('DELETE FROM embeddings');
        this.db.exec('DELETE FROM chunks');
        this.db.exec('DELETE FROM edges');
        this.db.exec('DELETE FROM nodes');
        console.error('[SemanticDatabase] clearAll done');
    }
    bulkUpdateFTS(ftsContents) {
        this.db.exec('DROP TABLE IF EXISTS search_index;');
        this.createFTSTable();
        const insertFtsStmt = this.db.prepare(`INSERT INTO search_index(path, title, content) VALUES (?, ?, ?)`);
        const batchSize = 1000;
        const tx = this.db.transaction((batch) => {
            for (const fts of batch) {
                insertFtsStmt.run(fts.path, fts.title ?? '', fts.content);
            }
        });
        for (let i = 0; i < ftsContents.length; i += batchSize) {
            tx(ftsContents.slice(i, i + batchSize));
        }
    }
    getAllEmbeddings(model) {
        const rows = this.db.prepare(`
      SELECT e.chunk_id, e.vector, e.dimensions, c.node_path, c.chunk_index
      FROM embeddings e
      JOIN chunks c ON c.id = e.chunk_id
      WHERE e.model = ?
    `).all(model);
        return rows.map((r) => {
            const buf = Buffer.from(r.vector);
            const vec = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
            return {
                chunkId: r.chunk_id,
                nodePath: r.node_path,
                chunkIndex: r.chunk_index,
                vector: vec,
                dimensions: r.dimensions,
            };
        });
    }
}
function cosineSimilarity(a, b) {
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
    if (normA === 0 || normB === 0)
        return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
//# sourceMappingURL=SemanticDatabase.js.map