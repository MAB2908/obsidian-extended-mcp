#!/usr/bin/env node
// v0.2b:
// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VaultManager } from '../../dist/layers/L1-filesystem/VaultManager.js';
import { GraphEngine } from '../../dist/layers/L4-semantic/GraphEngine.js';
import { BM25Engine } from '../../dist/layers/L4-semantic/BM25Engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERF_DIR = path.join(__dirname, '.perf-vault');

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

async function generateSyntheticVault(basePath, { noteCount, linksPerNote, wordsPerNote }) {
  await fs.mkdir(basePath, { recursive: true });
  const paths = [];
  for (let i = 0; i < noteCount; i++) {
    const folder = `folder${(i % 10).toString().padStart(2, '0')}`;
    const fileName = `note-${i.toString().padStart(5, '0')}.md`;
    const relPath = `${folder}/${fileName}`;
    paths.push(relPath);
    const links = [];
    for (let j = 0; j < linksPerNote; j++) {
      const targetIdx = Math.floor(Math.random() * noteCount);
      const target = `folder${(targetIdx % 10).toString().padStart(2, '0')}/note-${targetIdx.toString().padStart(5, '0')}`;
      links.push(`[[${target}]]`);
    }
    const paragraphs = Math.ceil(wordsPerNote / 50);
    const body = Array.from({ length: paragraphs }, () => LOREM).join('\n\n');
    const content = `---\ntitle: "Note ${i}"\ntags: [synthetic, test]\n---\n\n# Note ${i}\n\n${body}\n\n## Links\n${links.join('\n')}\n`;
    const fullPath = path.join(basePath, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
  return paths;
}

async function cleanupVault(basePath) {
  await fs.rm(basePath, { recursive: true, force: true });
}

async function benchGraphBuild(noteCount, targetMs) {
  const vaultPath = `${PERF_DIR}-${noteCount}`;
  await generateSyntheticVault(vaultPath, { noteCount, linksPerNote: 5, wordsPerNote: 200 });
  const vault = new VaultManager(vaultPath);
  const graph = new GraphEngine();

  const start = Date.now();
  const files = await vault.listNotes('');
  for (const relPath of files) {
    const note = await vault.readNote(relPath, { includeFrontmatter: true, includeContent: true });
    graph.addNode({
      path: relPath,
      title: note.title,
      aliases: (note.frontmatter.aliases) || [],
      tags: note.tags,
      frontmatter: note.frontmatter,
      outbound: note.outboundLinks,
      inbound: [],
      isOrphan: note.outboundLinks.length === 0,
      isDeadend: false,
      hasUnresolvedLinks: false,
    });
    for (const target of note.outboundLinks) {
      graph.addEdge(relPath, target, 'wikilink');
    }
  }
  const elapsed = Date.now() - start;

  console.log(`Graph build ${noteCount} notes: ${elapsed}ms (target: <${targetMs}ms)`);
  await cleanupVault(vaultPath);
}

async function benchBM25Search() {
  const vaultPath = `${PERF_DIR}-bm25`;
  await generateSyntheticVault(vaultPath, { noteCount: 10000, linksPerNote: 3, wordsPerNote: 200 });
  const vault = new VaultManager(vaultPath);
  const bm25 = new BM25Engine();

  const files = await vault.listNotes('');
  for (const relPath of files) {
    const note = await vault.readNote(relPath, { includeFrontmatter: false, includeContent: true });
    bm25.addDoc(relPath, `${note.title} ${note.content}`);
  }

  const start = Date.now();
  const results = bm25.search('lorem ipsum', 20);
  const elapsed = Date.now() - start;

  console.log(`BM25 search 10K notes: ${elapsed}ms (target: <100ms) — results: ${results.length}`);
  await cleanupVault(vaultPath);
}

async function benchIngestLike() {
  const vaultPath = `${PERF_DIR}-ingest`;
  await generateSyntheticVault(vaultPath, { noteCount: 100, linksPerNote: 3, wordsPerNote: 500 });
  const vault = new VaultManager(vaultPath);
  const bm25 = new BM25Engine();
  const graph = new GraphEngine();

  const start = Date.now();
  const note = await vault.readNote('folder00/note-00000.md', { includeFrontmatter: true, includeContent: true });
  bm25.addDoc(note.path, `${note.title} ${note.content}`);
  graph.addNode({
    path: note.path,
    title: note.title,
    aliases: [],
    tags: note.tags,
    frontmatter: note.frontmatter,
    outbound: note.outboundLinks,
    inbound: [],
    isOrphan: note.outboundLinks.length === 0,
    isDeadend: false,
    hasUnresolvedLinks: false,
  });
  const elapsed = Date.now() - start;

  console.log(`Ingest-like read+index: ${elapsed}ms (target: <1000ms)`);
  await cleanupVault(vaultPath);
}

async function main() {
  console.log('=== Obsidian Extended MCP Benchmarks ===');
  await benchGraphBuild(1000, 500);
  await benchGraphBuild(10000, 2000);
  await benchBM25Search();
  await benchIngestLike();
  console.log('=== Benchmarks complete ===');
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
