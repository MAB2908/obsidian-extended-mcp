#!/usr/bin/env node
/**
 * Standalone batch orphan linker — runs without MCP protocol overhead.
 *
 * Usage:
 *   node scripts/run-link-batch.mjs 10          # link 10 orphans
 *   node scripts/run-link-batch.mjs 50 Archive  # link 50 orphans in Archive/
 *
 * Requires .env with OLLAMA_BASE_URL + OLLAMA_API_KEY (or OPENAI_API_KEY).
 */
import '../dist/shared/load-env.js';

import { VaultPool } from '../dist/layers/L1-filesystem/VaultPool.js';
import { FolderACL } from '../dist/security/FolderACL.js';
import { LLMAdapter } from '../dist/layers/L6-ai-core/LLMAdapter.js';
import { OllamaProvider } from '../dist/layers/L6-ai-core/providers/OllamaProvider.js';
import { OpenAIProvider } from '../dist/layers/L6-ai-core/providers/OpenAIProvider.js';
import { PipelineOrchestrator } from '../dist/layers/L3-pipeline/PipelineOrchestrator.js';
import { serverConfig, llmConfig } from '../dist/shared/config.js';

const vaultPath = serverConfig.vaultPath;
const limit = parseInt(process.argv[2], 10) || 5;
const folder = process.argv[3] || undefined;

console.log(`🔗 AI Link Batch (standalone)`);
console.log(`   Vault : ${vaultPath}`);
console.log(`   Limit : ${limit}`);
console.log(`   Folder: ${folder || '(all)'}`);
console.log(`   LLM   : ${llmConfig.defaultProvider}`);
console.log();

// Minimal mocks — only markDirty is used by runLinkBatch
const mockIndexer = {
  initialize: async () => {},
  markDirty: (path) => { console.error(`[indexer] dirty: ${path}`); },
};
const mockGraph = { addNode: () => {}, addEdge: () => {} };
const mockBm25 = { index: () => {}, search: () => [] };

async function main() {
  const acl = new FolderACL();
  const pool = new VaultPool();
  const entry = await pool.addVault(vaultPath, acl, serverConfig.enforceOntology);

  const adapter = new LLMAdapter(llmConfig.defaultProvider);

  if (llmConfig.ollamaBaseUrl) {
    adapter.registerProvider(
      new OllamaProvider({
        baseUrl: llmConfig.ollamaBaseUrl,
        model: llmConfig.ollamaModel,
        apiKey: llmConfig.ollamaApiKey,
      })
    );
  }
  if (llmConfig.openAiKey) {
    adapter.registerProvider(
      new OpenAIProvider({
        apiKey: llmConfig.openAiKey,
        model: llmConfig.openAiModel,
      })
    );
  }

  const pipeline = new PipelineOrchestrator(
    entry.vault,
    mockGraph,
    mockBm25,
    mockIndexer,
    adapter
  );

  console.log(`⏳ Scanning vault for orphans...`);
  const start = Date.now();

  const result = await pipeline.runLinkBatch(limit, folder);
  const elapsed = Date.now() - start;

  console.log(`\n✅ Done in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`   Processed       : ${result.data?.processed || 0}`);
  console.log(`   Total candidates: ${result.data?.totalCandidates || 0}`);

  if (result.data?.results) {
    for (const r of result.data.results) {
      console.log(`\n   📄 ${r.path}`);
      console.log(`      Links added: ${r.linksAdded}`);
      if (r.suggestions > 0) {
        console.log(`      Suggestions: ${r.suggestions}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(`\n❌ FAILED: ${err.message}`);
  if (err.cause) console.error(`   Cause: ${err.cause.message || err.cause}`);
  console.error(err.stack);
  process.exit(1);
});
