# Obsidian Extended MCP v0.2.0-beta.3

AI-first Knowledge Base Server integrating Obsidian with MCP clients.

> **v0.2.0-beta.3** — Batch AI linking (`ai_link_batch`) with Ollama Cloud reliability fixes. `Connection: close` header prevents socket reuse errors on sequential requests. LinkAgent now targets all note titles (not just `concepts/`).
>
> **v0.2.0-beta.1** — Fixed event-loop blocking on large vaults (12,000+ notes). BackgroundIndexer and VaultManager now yield to the event loop every 50 iterations, eliminating MCP timeouts. Background indexing is skipped when `SEMANTIC_ENABLED=false`.

## Features

- **Filesystem CRUD** — read, write, patch, move, delete notes with atomic writes and backups
- **Semantic Search** — BM25 + vector embeddings with reciprocal rank fusion (RRF)
- **Graph Engine** — PageRank, BFS pathfinding, backlink/orphan/deadend analysis
- **AI Pipeline** — 7 agents: ingest, tag, query, compile, link, lint, enrich
- **CLI & REST Bridges** — integrate with Obsidian CLI and Local REST API
- **Multi-Vault** — manage multiple vaults via `VaultPool` + `VaultRouter`
- **Security Model** — 10 defense levels: transport auth, vault isolation, folder ACL, operation gating, approval engine, batch edit guard, sandbox, audit logging, JSON bomb protection, safe defaults
- **L9 Dreaming** — autonomous vault maintenance: link gap detection, merge suggestions, stale note pruning, MOC synthesis
- **Auto-Dreaming** — automatic background vault maintenance (prune empty/cache, fix tags) with cross-platform file watching via `chokidar`

## Installation

```bash
npm install -g obsidian-extended-mcp
# Binary name: obsidian-mcp
```

## Quick Start

1. Create a `.env` file in your project root (see `.env.example`):

```env
OBSIDIAN_VAULT_PATH=./vault
OPENAI_API_KEY=sk-...
DEFAULT_LLM_PROVIDER=openai
SEMANTIC_ENABLED=false
```

2. Initialize meta structure (optional):

```bash
obsidian-mcp init-meta --path ./vault
```

3. Run the MCP server:

```bash
node dist/index.js
```

Or configure your MCP client (Claude Desktop, Kimi, Cursor, etc.) to run:
```json
{
  "command": "node",
  "args": ["C:\\Users\\user\\obsidian-extended-mcp\\dist\\index.js"]
}
```

## Configuration

All settings are controlled via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSIDIAN_VAULT_PATH` | `./vault` | Path to Obsidian vault |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `DEFAULT_LLM_PROVIDER` | `openai` | Default LLM provider |
| `SEMANTIC_ENABLED` | `false` | Enable vector semantic search |
| `MCP_AUTH_TOKEN` | — | Bearer token for transport auth |
| `MULTI_VAULT` | `false` | Enable multi-vault mode |
| `ENFORCE_ONTOLOGY` | `false` | Block writes violating folder tag rules (E402) |
| `READ_ONLY` | `false` | Block all write operations |
| `ENABLE_COMMANDS` | `false` | Allow `cli_command` / `cli_plugin` |
| `ENABLE_EVAL` | `false` | Allow `cli_eval` (sandboxed, disabled by default) |
| `ENABLE_BATCH_EDIT` | `false` | Allow `batch_edit` |
| `ENABLE_DELETE` | `false` | Allow `delete_note` |
| `SAFE_ZONES` | `raw/,sessions/` | Paths writable without confirmation |
| `FORBIDDEN_PATHS` | `.git/,.obsidian/,.trash/` | Blocked paths |
| `APPROVAL_MODE` | `auto` | `auto` / `interactive` / `strict` |
| `WRITE_PATHS` | `*` | Comma-separated writable paths |
| `OPENAI_MODEL` | — | OpenAI model name |
| `ANTHROPIC_MODEL` | — | Anthropic model name |
| `OLLAMA_MODEL` | `nomic-embed-text` | Ollama model name |
| `EMBED_MODEL` | `text-embedding-3-small` | Embedding model name |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `REST_API_URL` | `http://localhost:27123` | Obsidian Local REST API URL |
| `REST_API_TOKEN` | — | REST API bearer token |
| `OBSIDIAN_CLI_PATH` | — | Path to obsidian-cli binary |
| `MCP_CONFIG_PATH` | — | Path to YAML config file |
| **LLM Tuning** | | |
| `LLM_MAX_CACHE_SIZE` | `1000` | Max cached LLM responses |
| `LLM_CACHE_TTL_MS` | `3600000` | Cache TTL (1 hour) |
| `LLM_MAX_RETRIES` | `3` | Retry attempts on failure |
| `LLM_RETRY_BASE_DELAY_MS` | `1000` | Base retry delay |
| **Semantic / Graph** | | |
| `BM25_K1` | `1.5` | BM25 term frequency saturation |
| `BM25_B` | `0.75` | BM25 length normalization |
| `BM25_DEFAULT_LIMIT` | `50` | Default BM25 result limit |
| `RRF_K` | `60` | Reciprocal Rank Fusion constant |
| `GRAPH_PAGERANK_ITERATIONS` | `20` | PageRank iterations |
| `GRAPH_PAGERANK_DAMPING` | `0.85` | PageRank damping factor |
| `GRAPH_COMMUNITY_MAX_PASSES` | `10` | Community detection passes |
| `GRAPH_PATH_MAX_DEPTH` | `5` | Graph BFS max depth |
| `INDEXER_DEBOUNCE_MS` | `2000` | Background indexer debounce |
| `SEMANTIC_SEARCH_LIMIT` | `20` | Semantic search default limit |
| `SEMANTIC_RAG_TOP_K` | `5` | RAG top-k chunks |
| `TOPIC_LOADER_BATCH_SIZE` | `10` | Dreaming topic loader batch |
| **Security / Audit** | | |
| `SANDBOX_TIMEOUT_MS` | `5000` | CLI eval timeout (ms) |
| `SANDBOX_ALLOWED_GLOBALS` | `app,DataviewAPI,moment,MetadataCache` | Sandbox globals whitelist |
| `AUDIT_FORMAT` | `jsonl` | `jsonl` / `csv` / `markdown` |
| `AUDIT_MAX_AGE_DAYS` | `30` | Audit log retention |
| `AUDIT_BATCH_SIZE` | `100` | Entries per flush |
| `AUDIT_FLUSH_INTERVAL_MS` | `5000` | Flush interval |
| `AUDIT_ROTATION_MB` | `10` | Log rotation threshold |
| `AUDIT_MAX_BUFFER_SIZE` | `10000` | Max in-memory audit entries |
| **Pipeline** | | |
| `PIPELINE_COMPILE_SINCE_DAYS` | `30` | Compile lookback window |
| `PIPELINE_MOC_AGE_DAYS` | `90` | MOC staleness threshold |
| `PIPELINE_MIN_CONFIDENCE` | `0.7` | Min AI suggestion confidence |
| `PIPELINE_SEEDLING_MAX_AGE_DAYS` | `90` | Seedling max age before lint |
| **Filesystem** | | |
| `FS_TRASH_DIR` | `.trash` | Trash directory name |
| `FS_BACKUP_DIR` | `.mcp-cache/backups` | Backup directory |
| `FS_MAX_BACKUPS` | `20` | Max backups to retain |
| `FS_MAX_NOTE_SIZE` | `10485760` | Max note size (10 MB) |
| `FILE_TEXT_EXTENSIONS` | `.md,.txt,...` | Recognized text extensions |

## Security

The server implements an 8-level defense model:

1. Transport token verification (ready for HTTP transport)
2. Vault isolation — path traversal protection with symlink resolution
3. Folder ACL — read/write/safe-zone/forbidden paths, Unicode normalized, Windows case-insensitive
4. Operation gating — READ_ONLY, disable eval/commands/delete/batch-edit
5. Approval engine — 8 levels of required confirmation
6. Batch edit guard — preview → apply with automatic backup, ACL-enforced preview
7. Sandbox — 30+ forbidden patterns (eval, Function, Reflect, Proxy, constructor, unicode escapes, template literals, dynamic property access), NFC normalization, timeout, allowed globals
8. Audit logging — every write operation is logged with rollback support, atomic flush, bounded buffer
9. JSON bomb protection — size (10 MB) and depth (50) limits on all JSON parsers
10. Safe defaults — `allowedRoots` defaults to vault path, dangerous tools disabled by default

See `docs/SECURITY_MODEL.md` for the full specification.

## CLI

```bash
obsidian-mcp init-meta   # Initialize vault meta structure
obsidian-mcp check       # Check vault health
obsidian-mcp init-llm    # Create .env with LLM defaults
obsidian-mcp rollback --path ./vault --file path/to/note.md --to last
```

## MCP Tools (91)

### Filesystem (15)
`read_note`, `write_note`, `append_note`, `patch_note`, `delete_note`, `move_note`, `list_directory`, `search_notes`, `get_vault_stats`, `list_all_tags`, `read_file`, `write_file`, `manage_tags`, `validate_note`, `get_vault_rules`

### Semantic (13)
`bm25_search`, `graph_neighbors`, `graph_analyze_centrality`, `graph_detect_communities`, `build_index`, `semantic_search`, `semantic_search_db`, `db_stats`, `semantic_rag`, `fs_list_notes`, `fs_get_graph`, `fs_graph_find_path`

### AI Core (8)
`ai_ingest`, `ai_tag`, `ai_query`, `ai_compile`, `ai_link`, `ai_link_batch`, `ai_enrich`

### CLI Bridge (10)
`cli_backlinks`, `cli_orphans`, `cli_deadends`, `cli_unresolved`, `cli_search`, `cli_eval`, `cli_properties`, `cli_daily`, `cli_command`, `cli_plugin`

### REST Bridge (2)
`rest_active_note`, `rest_dataview`

### Security / Audit (4)
`audit_log`, `list_backups`, `rollback`, `batch_edit`

### Dreaming / Maintenance (3)
`dream_scan`, `dream_finalize`, `dream_undo`

### Pool — Multi-Vault (3)
`pool_list_vaults`, `pool_add_vault`, `pool_remove_vault`

### MABS — Model-Aware Backup (11)
`mabs_list_models`, `mabs_set_current_model`, `mabs_snapshot_artifact`, `mabs_list_artifacts`, `mabs_artifact_history`, `mabs_list_sessions`, `mabs_can_replay`, `mabs_export_backup`, `mabs_import_backup`, `mabs_export_agnostic_bundle`, `mabs_import_agnostic_bundle`

### Dev System (23)
`dev_prompt_list`, `dev_prompt_get`, `dev_prompt_create`, `dev_prompt_delete`, `dev_prompt_execute`, `dev_skill_list`, `dev_skill_get`, `dev_skill_create`, `dev_skill_delete`, `dev_skill_execute`, `dev_agent_list`, `dev_agent_get`, `dev_agent_create`, `dev_agent_delete`, `dev_workflow_list`, `dev_workflow_get`, `dev_workflow_create`, `dev_workflow_delete`, `dev_workflow_advance`, `dev_workflow_fail`, `dev_claude_md_get`, `dev_claude_md_append`

### Bootstrap (1)
`get_context_bootstrap`

### MABS — Model-Aware Backup (11)
`mabs_list_models`, `mabs_set_current_model`, `mabs_snapshot_artifact`, `mabs_list_artifacts`, `mabs_artifact_history`, `mabs_list_sessions`, `mabs_can_replay`, `mabs_export_backup`, `mabs_import_backup`, `mabs_export_agnostic_bundle`, `mabs_import_agnostic_bundle`

### Dev System — 4-Level (22)
`dev_prompt_list`, `dev_prompt_create`, `dev_prompt_get`, `dev_prompt_delete`, `dev_prompt_execute`, `dev_skill_list`, `dev_skill_create`, `dev_skill_get`, `dev_skill_delete`, `dev_skill_execute`, `dev_agent_list`, `dev_agent_create`, `dev_agent_get`, `dev_agent_delete`, `dev_workflow_list`, `dev_workflow_create`, `dev_workflow_get`, `dev_workflow_delete`, `dev_workflow_advance`, `dev_workflow_fail`, `dev_claude_md_get`, `dev_claude_md_append`

## Batch Linking (Standalone)

For large vaults, use the standalone batch runner without MCP protocol overhead:

```bash
node scripts/run-link-batch.mjs 10        # link 10 orphans
node scripts/run-link-batch.mjs 50 Archive # link 50 orphans in Archive/
```

Requires `OLLAMA_BASE_URL` and `OLLAMA_API_KEY` (for Ollama Cloud) or `OPENAI_API_KEY` in `.env`.

## Development

```bash
npm install
npm run build
npm test
```

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CONFIG_PATH` | `mcp-config.yaml` | Path to YAML config file |
| `LLM_MAX_CACHE_SIZE` | `1000` | LLM cache size |
| `LLM_CACHE_TTL_MS` | `3600000` | LLM cache TTL |
| `LLM_MAX_RETRIES` | `3` | Max LLM retries |
| `LLM_RETRY_BASE_DELAY_MS` | `1000` | Base retry delay |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `BM25_K1` | `1.5` | BM25 k1 parameter |
| `BM25_B` | `0.75` | BM25 b parameter |
| `BM25_DEFAULT_LIMIT` | `50` | BM25 default result limit |
| `RRF_K` | `60` | RRF fusion constant |
| `GRAPH_PAGERANK_ITERATIONS` | `20` | PageRank iterations |
| `GRAPH_PAGERANK_DAMPING` | `0.85` | PageRank damping factor |
| `GRAPH_COMMUNITY_MAX_PASSES` | `10` | Louvain max passes |
| `GRAPH_PATH_MAX_DEPTH` | `5` | BFS max depth |
| `INDEXER_DEBOUNCE_MS` | `2000` | Background indexer debounce |
| `SEMANTIC_SEARCH_LIMIT` | `20` | Semantic search limit |
| `SEMANTIC_RAG_TOP_K` | `5` | RAG top-k |
| `SANDBOX_TIMEOUT_MS` | `5000` | Sandbox execution timeout |
| `AUDIT_FORMAT` | `jsonl` | Audit log format |
| `AUDIT_MAX_AGE_DAYS` | `30` | Audit retention |
| `AUDIT_BATCH_SIZE` | `100` | Audit batch size |
| `AUDIT_FLUSH_INTERVAL_MS` | `5000` | Audit flush interval |
| `AUDIT_ROTATION_MB` | `10` | Audit rotation threshold |
| `PIPELINE_COMPILE_SINCE_DAYS` | `30` | Compile depth in days |
| `PIPELINE_MOC_AGE_DAYS` | `90` | MOC staleness threshold |
| `PIPELINE_MIN_CONFIDENCE` | `0.7` | AI minimum confidence |
| `PIPELINE_SEEDLING_MAX_AGE_DAYS` | `90` | Seedling max age |
| `FS_TRASH_DIR` | `.trash` | Trash directory |
| `FS_BACKUP_DIR` | `.mcp-cache/backups` | Backup directory |
| `FS_MAX_BACKUPS` | `20` | Max backup count |
| `FS_MAX_NOTE_SIZE` | `10485760` | Max note size in bytes (10 MB) |
| `FILE_TEXT_EXTENSIONS` | `.md,.txt,…` | Text file extensions (see config.ts) |

## Requirements

- Node.js >= 20
- Obsidian (optional, for CLI/REST bridge features)

## License

MIT
