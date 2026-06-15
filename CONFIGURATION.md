# Configuration Guide — Obsidian Extended MCP v0.3.4

Configuration hierarchy (highest → lowest priority):

1. Environment variables (`.env`)
2. `mcp-config.yaml` (if present)
3. Hardcoded defaults in `src/shared/config.ts`

## Quick start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set `OBSIDIAN_VAULT_PATH` to your Obsidian vault.
3. Pick an LLM provider preset and fill in the key/URL.
4. Adjust security flags (`ENABLE_COMMANDS`, `ENABLE_EVAL`, etc.) as needed.
5. Run:
   ```bash
   npm run build
   node dist/index.js
   ```

---

## 1. Vault

| Variable / YAML key | Default | Description |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` / `server.vaultPath` | `./vault` | Absolute or relative path to your Obsidian vault. |
| `MULTI_VAULT` / `server.multiVault` | `false` | Enable multi-vault pool mode. |
| `ENFORCE_ONTOLOGY` / `server.enforceOntology` | `false` | Reject writes that violate `meta/ontology.md`. |

---

## 2. LLM Provider (pick one)

### Local / privacy-first: Ollama

```bash
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBED_MODEL=nomic-embed-text
```

### OpenAI

```bash
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### Anthropic

```bash
DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

### Mixed: Ollama embeddings + OpenAI chat

```bash
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

## 3. Semantic Search

| Variable / YAML key | Default | Description |
|---|---|---|
| `SEMANTIC_ENABLED` / `semantic.enabled` | `false` | Enable vector embeddings. If false, `semantic_search` falls back to FTS5. |
| `EMBED_MODEL` / `semantic.embedModel` | `text-embedding-3-small` | OpenAI embedding model. |
| `OLLAMA_EMBED_MODEL` / `semantic.ollamaEmbedModel` | `nomic-embed-text` | Ollama embedding model. |
| `RRF_K` / `semantic.rrfK` | `60` | Reciprocal Rank Fusion constant. |
| `INDEXER_DEBOUNCE_MS` / `semantic.indexerDebounceMs` | `1000` | Delay before incremental reindex after file changes. |
| `SEMANTIC_SEARCH_LIMIT` / `semantic.semanticSearchLimit` | `10` | Default result limit. |
| `SEMANTIC_RAG_TOP_K` / `semantic.semanticRagTopK` | `5` | Default top-k for RAG context. |

---

## 4. Security

### Operation gates (secure-by-default)

| Variable / YAML key | Default | Description |
|---|---|---|
| `READ_ONLY` / `security.readOnly` | `false` | Global read-only mode. |
| `ENABLE_COMMANDS` / `security.enableCommands` | `false` | Enable `cli_command`, `cli_plugin`, `rest_execute_command`. |
| `ENABLE_EVAL` / `security.enableEval` | `false` | Enable `cli_eval` (arbitrary JS execution). |
| `ENABLE_BATCH_EDIT` / `security.enableBatchEdit` | `false` | Enable `batch_edit`. |
| `ENABLE_DELETE` / `security.enableDelete` | `false` | Enable `delete_note` and `audit_purge`. |
| `ENABLE_AUDIT` / `security.enableAudit` | `true` | Enable audit logging. |

### Approval mode

| Value | Behavior |
|---|---|
| `auto` | Apply AI suggestions automatically if confidence is high enough. |
| `interactive` | Suggest, wait for confirmation (recommended). |
| `strict` | Require explicit approval for every destructive operation. |

### Folder ACL

| Variable / YAML key | Default | Description |
|---|---|---|
| `SAFE_ZONES` / `security.safeZones` | `raw/,sessions/` | Paths writable without extra confirmation. |
| `WRITE_PATHS` / `security.writePaths` | `*` | Allowed write paths. |
| `FORBIDDEN_PATHS` / `security.forbiddenPaths` | `.git/,.obsidian/,.trash/` | Paths that can never be written. |

---

## 5. Audit Logging

| Variable / YAML key | Default | Description |
|---|---|---|
| `AUDIT_FORMAT` / `security.auditFormat` | `jsonl` | `jsonl`, `csv`, or `markdown`. |
| `AUDIT_MAX_AGE_DAYS` / `security.auditMaxAgeDays` | `90` | Age-based rotation threshold. |
| `AUDIT_BATCH_SIZE` / `security.auditBatchSize` | `50` | Entries per flush. |
| `AUDIT_FLUSH_INTERVAL_MS` / `security.auditFlushIntervalMs` | `5000` | Max time before flush. |
| `AUDIT_ROTATION_MB` / `security.auditRotationMb` | `10` | Size-based rotation threshold. |
| `AUDIT_REMOTE_URL` / `security.auditRemoteUrl` | `''` | Optional external audit endpoint. |
| `AUDIT_REMOTE_TOKEN` / `security.auditRemoteToken` | `''` | Bearer token for remote sink. |

---

## 6. Transports

### stdio (default)

No extra configuration required. Used by Claude Desktop, Kimi, Cursor via MCP config.

### Streamable HTTP

```bash
MCP_AUTH_TOKEN=$(openssl rand -hex 32)
MCP_HTTP_ENABLED=true
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=8787
MCP_HTTP_PATH=/mcp
```

Endpoints:

- `POST /mcp` — MCP messages
- `GET /health` — health check
- `GET /metrics` — request/session metrics

**Security:** bind to `127.0.0.1` by default; use a reverse proxy with HTTPS for remote access.

---

## 7. Bridges

### Obsidian CLI

```bash
OBSIDIAN_CLI_PATH=/path/to/obsidian-cli
```

If unset, CLI tools fall back to graph/filesystem heuristics.

### Local REST API

Requires the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin.

```bash
REST_API_URL=http://localhost:27123
REST_API_TOKEN=...
```

---

## 8. Filesystem Tuning

| Variable / YAML key | Default | Description |
|---|---|---|
| `FS_TRASH_DIR` / `fs.trashDir` | `.trash` | Soft-delete directory. |
| `FS_BACKUP_DIR` / `fs.backupDir` | `.mcp-cache/backups` | Backup directory. |
| `FS_MAX_BACKUPS` / `fs.maxBackups` | `50` | Max backups per file. |
| `FS_BACKUP_BEFORE_WRITE` / `fs.backupBeforeWrite` | `true` | Create `.bak` before overwrite/patch. |
| `FS_MAX_NOTE_SIZE` / `fs.maxNoteSize` | `10485760` | Max note size in bytes (10 MB). |

---

## 9. Pipeline Tuning

| Variable / YAML key | Default | Description |
|---|---|---|
| `PIPELINE_COMPILE_SINCE_DAYS` | `30` | Look-back window for `ai_compile`. |
| `PIPELINE_MOC_AGE_DAYS` | `90` | MOC staleness threshold. |
| `PIPELINE_MIN_CONFIDENCE` | `0.7` | Min confidence for auto-applying AI suggestions. |
| `PIPELINE_SEEDLING_MAX_AGE_DAYS` | `90` | Max age for seedling notes. |

---

## 10. Auto-Dreaming

| Variable / YAML key | Default | Description |
|---|---|---|
| `AUTO_DREAM_ENABLED` | `false` | Run dreaming on schedule. |
| `AUTO_DREAM_INTERVAL` | `24` | Hours between runs. |
| `AUTO_DREAM_WATCH` | `true` | Trigger on file changes. |
| `AUTO_DREAM_DEBOUNCE` | `5` | Minutes to debounce file changes. |
| `AUTO_DREAM_DRY_RUN` | `false` | Preview only, do not write. |

---

## Recommended presets

### Safe local development

```bash
OBSIDIAN_VAULT_PATH=./vault
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
SEMANTIC_ENABLED=false
APPROVAL_MODE=interactive
ENABLE_COMMANDS=false
ENABLE_EVAL=false
ENABLE_BATCH_EDIT=false
ENABLE_DELETE=false
ENABLE_AUDIT=true
```

### Maximum functionality (trusted environment)

```bash
OBSIDIAN_VAULT_PATH=./vault
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
SEMANTIC_ENABLED=true
APPROVAL_MODE=interactive
ENABLE_COMMANDS=true
ENABLE_EVAL=true
ENABLE_BATCH_EDIT=true
ENABLE_DELETE=true
ENABLE_AUDIT=true
REST_API_URL=http://localhost:27123
REST_API_TOKEN=...
```

### HTTP-only server

```bash
MCP_AUTH_TOKEN=$(openssl rand -hex 32)
MCP_HTTP_ENABLED=true
MCP_STDIO_DISABLED=true
READ_ONLY=true
ENABLE_AUDIT=true
```
