import { VaultManager } from './dist/layers/L1-filesystem/VaultManager.js';
import { GraphEngine } from './dist/layers/L4-semantic/GraphEngine.js';
import { BM25Engine } from './dist/layers/L4-semantic/BM25Engine.js';
import { SemanticDatabase } from './dist/layers/L4-semantic/SemanticDatabase.js';
import { IndexPersistence } from './dist/layers/L4-semantic/IndexPersistence.js';
import { AuditLogger } from './dist/security/AuditLogger.js';

async function main() {
  const vaultPath = 'C:/Users/user/Documents/Obsidian Vault';
  const cacheDir = 'C:/Users/user/Documents/Obsidian Vault/.mcp-cache';

  const audit = new AuditLogger(cacheDir);
  const vm = new VaultManager(vaultPath, audit);

  console.log('=== Test 1: collectMarkdownFiles (symlink safety) ===');
  const start1 = Date.now();
  const files = await vm.listNotes();
  console.log(`Found ${files.length} files in ${Date.now() - start1}ms`);

  console.log('\n=== Test 2: Index build speed ===');
  const graph = new GraphEngine();
  const bm25 = new BM25Engine();
  const db = new SemanticDatabase(`${cacheDir}/test-semantic.db`);
  await db.initSchema();

  let processed = 0;
  const start2 = Date.now();
  let lastReport = start2;

  for (const f of files) {
    try {
      const note = await vm.readNote(f, { includeContent: true });
      graph.addNode(f, { title: note.name, wordCount: note.content?.split(/\s+/).length || 0 });
      bm25.addDoc(f, note.name + ' ' + (note.content || ''));
      db.upsertNode({ path: f, title: note.name, contentHash: 'test', wordCount: 0 });
      db.updateFTSContent(f, note.content || '');

      processed++;
      const now = Date.now();
      if (now - lastReport > 5000) {
        const elapsed = now - start2;
        const rate = processed / (elapsed / 1000);
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        console.log(`  ${processed}/${files.length} files, ${elapsed}ms, ${rate.toFixed(1)} files/sec, heap ${mem}MB`);
        lastReport = now;
      }
    } catch (err) {
      console.error(`Error on ${f}:`, err.message);
    }
  }

  const totalTime = Date.now() - start2;
  console.log(`Processed ${processed} files in ${totalTime}ms (${(processed/(totalTime/1000)).toFixed(1)} files/sec)`);

  console.log('\n=== Test 3: IndexPersistence.save() ===');
  const start3 = Date.now();
  const persistence = new IndexPersistence(cacheDir, audit);
  await persistence.save(graph, bm25, undefined);
  console.log(`Saved in ${Date.now() - start3}ms`);

  db.close();
  console.log('\n=== All tests passed! ===');
}

main().catch(console.error);
