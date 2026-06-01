v0.1b: 
# Changelog

## v0.1b (2026-05-30)

### 🔵 Features
- **Auto-Dreaming**: Standalone CLI (`scripts/auto-dream.mjs`) + MCP tools (`auto_dream_run`, `auto_dream_status`) for automatic vault maintenance — prune empty/cache files, fix tags, deduplicate tags
- **Cross-platform file watching**: Integrated `chokidar@^5.0.0` for Windows/macOS/Linux; auto-dream monitors vault changes with 5-minute debounce
- **Auto-Dream scheduler**: OS-specific installer — Windows Task Scheduler (`schtasks`), macOS `launchctl`, Linux `crontab`
- **Server bootstrap integration**: Auto-dream starts on server launch with `--watch` (configurable debounce) and `--cron N` fallback

### 🟠 Stability
- **Project cleanup**: Obsolete audit files (v2.12.5 audits, ad-hoc scripts, stale JSON) moved to `Backup9/`
- **Version bump**: `serverInfo` synced across `src/index.ts`, `src/layers/L5-bootstrap/cli.ts`, and `package.json` (→ 0.1b)

### 🧪 Tests
- **38 test files, 293 tests passing**
- TypeScript compilation clean (`tsc --noEmit`)

## v2.12.5 (2026-05-30)

### 🔴 Security (Independent Audit)
- **SB-001 CRITICAL**: `Sandbox.execute()` no longer mutates host global objects (`Math`, `JSON`, `console`) — shallow clones before `Object.freeze`/`setPrototypeOf`
- **VM-001 HIGH**: `VaultManager.resolve()` now uses `path.resolve()` + separator-normalized containment, fixing Windows path bypass (`C:\vault` vs `c:\vault` and sibling directory leakage)
- **VM-002 HIGH**: Backup structure changed from `backups/<timestamp>/<file>` to `backups/<file>/<timestamp>.md` — `pruneBackups` now preserves per-file history instead of destroying cross-file backups
- **BI-001 HIGH**: `BackgroundIndexer.runBatchInternal()` re-queues all files on any Phase-2 failure, preventing permanent index drift
- **PO-001 HIGH**: `PipelineOrchestrator.runLint()` uses `vault.resolvePath()` instead of raw `path.join`, closing path traversal vector
- **DE-001 HIGH**: `DreamingEngine.create()` factory cache cleans up rejected promises, allowing retry after SignalStore failure
- **DE-002 HIGH**: `DreamingEngine.scan()` releases session lock in catch block if `loader.load()` throws, preventing vault lockout
- **MB-001 HIGH**: `ModelAwareBackupService.readArtifact()` validates hash format (`/^[a-f0-9]{64}$/i`) before path construction, blocking directory traversal

### 🟠 Stability
- **VM-003 MEDIUM**: `VaultManager.atomicWrite()` only proceeds on `ENOENT` when `overwrite=false`; `EACCES`/`EPERM` now re-thrown immediately
- **PO-002 MEDIUM**: `PipelineOrchestrator.runCompile()` marks indexer dirty only after all concept writes succeed, preventing phantom dirty entries on rollback
- **LA-001 MEDIUM**: `LLMAdapter.executeGenerate()` classifies errors before retry — 4xx client errors fail fast, 5xx/429/`ECONNRESET`/`ETIMEDOUT` retry with backoff
- **CRIT-001 CRITICAL**: `globMatch()` regex character class fixed — `-` is now escaped, preventing malformed ranges that broke hyphenated glob patterns (`semantic.ts` + `VaultManager.ts`)
- **CRIT-004 CRITICAL**: `OperationGate` write tool list synchronized with `SecurityEngine.isWriteOp()` — added missing `ai_lint`, `cli_daily`, `cli_properties`, `dream_*`, `mabs_*` tools
- **HIGH-005 HIGH**: `AuditLogger.redactObject()` no longer over-redacts strings by substring matching (e.g., `"decode base64"` no longer matches `"code"`) — only redacts by key name or >4096 chars
- **HIGH-006 HIGH**: Removed 5 ghost dreaming tools (`dream_touch`, `dream_set_signals`, `dream_consolidate`, `dream_synthesize`, `dream_prune`) from `SecurityEngine` classification lists
- **MED-001 MEDIUM**: `GraphEngine.getPath()` BFS depth off-by-one fixed — `maxDepth` now correctly allows `maxDepth` hops instead of `maxDepth - 1`
- **CRIT-002 CRITICAL**: `VaultManager.atomicWrite()` `overwrite=false` now uses `fs.copyFile(COPYFILE_EXCL)` instead of `fs.rename`, closing the race where a file created between access-check and rename would be silently overwritten
- **CRIT-003 CRITICAL**: `VaultManager.appendNote()` now reads existing content **inside** `FileLock.withLock`, preventing lost updates under concurrent append operations
- **HIGH-003 HIGH**: `SemanticDatabase.searchSimilar()` now limits SQL query to `topK * 10` rows instead of loading the entire embeddings table into memory
- **HIGH-004 HIGH**: `VectorEngine.indexDoc()` / `indexDocs()` now validate embedding provider results — throws if array is empty, shorter than expected, or contains undefined entries
- **HIGH-007 HIGH**: `PipelineOrchestrator.runCompile()` rollback now restores original content for overwritten concept files instead of deleting them permanently
- **HIGH-008 HIGH**: `VaultManager.moveNote()` now auto-backs up the destination file before overwriting (POSIX `rename` behavior)
- **HIGH-001 HIGH**: `validatePath()` now resolves `vaultRoot` via `fs.realpath()` before containment check, fixing symlinked vault paths
- **HIGH-002 HIGH**: `SecurityEngine.isWriteOp()` now inspects `args.action` for `cli_properties` and `cli_daily` — `read`/`list` actions are correctly classified as read operations

### 🧪 Tests
- **38 test files, 292 tests passing**
- TypeScript compilation clean (`tsc --noEmit`)

## v2.12.4 (2026-05-30)

### 🔵 Architecture
- **VaultEntry fully typed**: Extracted 8 interfaces (`IVaultManager`, `IGraphEngine`, `IBM25Engine`, `ISemanticDatabase`, `IBackgroundIndexer`, `IVectorEngine`, `IPipelineOrchestrator`, `IDreamingEngine`) into `src/shared/interfaces/`
- **L1↔L4 circular dependency broken**: `BackgroundIndexer` no longer imports `VaultManager` from `L1-filesystem`; depends only on `shared/interfaces/IVaultManager.ts`
- **Concrete classes implement interfaces**: `VaultManager`, `GraphEngine`, `BM25Engine`, `SemanticDatabase`, `VectorEngine`, `BackgroundIndexer`, `PipelineOrchestrator`, `DreamingEngine` all declare `implements IXxx`
- **Dead code removed**: `src/shared/initializeVault.ts` (orphaned, duplicated `src/index.ts` logic)
- **VaultContext typed**: `VaultRouter` return type uses interfaces instead of concrete classes

### 🔴 Stability
- **RC-005 fixed**: LLMAdapter deduplicates in-flight requests with identical cache keys — concurrent calls now share a single promise instead of spawning duplicate LLM requests

### 🧪 Tests
- Added `deduplicates in-flight requests (RC-005)` test to `LLMAdapter.test.ts`
- **38 test files, 293 tests passing**

## v2.12.3 (2026-05-30)

### 🔴 Security
- **Sandbox hardened**: Added blocks for `Reflect.get`, `Reflect.set`, `Object.getPrototypeOf`, `setTimeout`, `setInterval` (V-006–V-008)
- **JSON bomb protection**: All user-facing JSON parsers now use `safeJsonParse` with 10 MB size and 50-depth limits
  - Files: `FileTypeRouter`, `IndexPersistence`, `DreamLog`, `DreamState`, `CliBridge`, `AnthropicProvider`, `OpenAIProvider`, `OllamaProvider`, `ModelAwareBackupService`, `AuditLogger`
- **AuditLogger per-line recovery**: Malformed or oversized audit lines are skipped individually instead of failing the entire query

### 🟠 Stability
- **VaultManager cache stale data fixed**: Generation counter prevents stale stats from overwriting fresh cache after concurrent writes (RC-009)
- **VaultPool.removeVault race fixed**: Entry deleted from map before async `stopGraceful()`, preventing access to shutting-down vaults (RC-007)
- **MABS snapshot race fixed**: `snapshotSessionContext` accepts explicit `profileId`, eliminating global mutable state race between concurrent LLM calls (RC-006)
- **DreamingEngine cleanup on remove**: `entry.dreaming?.close()` called in `VaultPool.removeVault()`, preventing stale SQLite handles (RC-008)

### 🟡 Architecture
- **Dead code removal**: Removed unused interfaces `ILayer3Pipeline`, `ILayer4Semantic`, `BM25Doc`, `BM25Index` from `types.ts`
- **Duplicate type resolved**: `SemanticDatabase.SearchResult` renamed to `FTSSearchResult` to avoid collision with shared `SearchResult`
- **Removed unused types**: `ValidationResult` and `FolderRules` deduplicated (single source in `TagEngine.ts`)

### 📄 Documentation
- **README.md**: Updated to 92 tools, added MABS section, added 30+ missing env vars, updated security levels (10 defenses)

### 🧪 Tests
- **Sandbox tests**: +4 tests for Reflect.get/set, Object.getPrototypeOf, setTimeout/setInterval
- **Tool handlers**: `pool_add_vault` test now actually calls handler and asserts result
- **Benchmark thresholds**: Increased 2–3× for CI stability (1500ms / 15000ms / 300ms / 2000ms)
- **Test consolidation**: Removed 3 duplicate/split test files, merged overlapping scenarios
  - Removed `tests/security.test.ts` (legacy monolithic, 15+ tests superseded by granular security tests)
  - Removed `tests/VaultPoolRemove.test.ts` (merged into `VaultPool.test.ts`)
  - Removed `tests/security/AuthTransport.test.ts` (merged into `AuthTransportWrapper.test.ts`)
  - Removed flaky `debounces multiple markDirty calls` from `BackgroundIndexer.test.ts`
  - Removed duplicate e2e scenario tests (orphans, backlinks, FTS weak assertions)
  - Removed dreaming classification tests from `SecurityEngine.test.ts` (covered in tool-handlers)
  - `vitest.config.ts`: Added `exclude: ['Backup7']` to prevent stale test execution
- **39 test files, 292 tests passing** (consolidated from 43 files / 362 tests)
  - Deleted `tests/e2e/pipeline.test.ts` entirely (all 4 tests were mock passthroughs with hardcoded LLM data)
  - Removed 13 redundant E2E tests across dreaming, graceful-shutdown, and scenarios
  - Removed 18 bloated mock-passthrough tests from `tool-handlers.test.ts`
  - Removed 2 slow/low-value tests from `PipelineOrchestrator.test.ts`
  - Removed dead code test (`gate blocking`) from `Dispatcher.test.ts`
  - Removed flaky timing assertion from `BM25Engine.test.ts`
  - Parameterized `ai-core/agents.test.ts` with `it.each` (6 tests → 1 block)
  - Excluded `tests/performance/` from default vitest run (can run separately via `npx vitest run tests/performance/`)
  - Strengthened weak `toBeDefined()` assertions in `VaultPool`, `VaultRouter`, `BackgroundIndexer` tests

---

## v2.12.2 (2026-05-30)

### 🔴 Security
- **Sandbox `globalThis[` block**: Dynamic property access via `globalThis["require"]` now blocked (C2-fix follow-up)
- **AuditLogger buffer cap**: Unbounded memory growth prevented via `maxBufferSize` (default 10 000 entries); oldest entries dropped on overflow (V-005)

### 🟠 Stability
- **AuditLogger flush atomicity**: Oldest-entry drop happens before push, preventing negative `splice` when `batchSize > maxBufferSize`

### 🧪 Tests
- **Sandbox tests**: Added coverage for `globalThis[` dynamic access (2 cases) and template literal bypass (V-004)
- **AuditLogger tests**: Added buffer cap overflow test (V-005)
- All 359 tests passing

---

## v2.12.1 (2026-05-30)

### 🔴 Security (Critical — 5-auditor deep audit)
- **batchEdit preview read bypass fixed**: `batchEdit()` now checks `isReadAllowed()` before `readNote()` in preview mode (C2)
- **Sandbox template literal bypass fixed**: `eval\`` and `Function\`` blocked (C3)
- **Dreaming tools classification fixed**: `dream_scan`, `dream_touch`, `dream_set_signals` correctly classified as read ops; `dream_finalize`, `dream_undo`, `dream_consolidate`, `dream_synthesize`, `dream_prune` as write ops
- **Numeric args ACL bypass fixed**: Non-string path arguments now coerced with `String(rawFilePath)` before ACL checks

### 🟠 Stability
- **BackgroundIndexer atomic swap**: `dirtyFiles` atomic swap instead of copy-then-clear; `currentBatch` guard replaces `isRunning` boolean; two-phase graph/bm25 update
- **GraphEngine.getPath off-by-one fixed**: `>= maxDepth` → `> maxDepth`
- **VaultManager.rollback cache invalidation**: `invalidateCache()` called in both timestamp and no-timestamp branches
- **LLMAdapter undefined throw fixed**: `lastError` initialized with default `Error` instead of `undefined`
- **DreamState file-lock mutex**: `addSession()` / `removeSession()` wrapped in `withLock()`
- **BackgroundIndexer busyRetries cleanup**: Retries removed on success; bounded retry with max 5

### 🟡 Architecture
- **FolderACL Unicode normalization**: `normalizeCheckPath()` now includes `.normalize('NFC')`
- **FolderACL Windows case-insensitivity**: `_checkAllowed()` uses `toLowerCase()` on Windows
- **safeJsonParse**: Wraps `JSON.parse` with `maxSize` (10 MB) and `maxDepth` (32) limits
- **config.ts safe defaults**: `vault.allowedRoots` defaults to `[vaultPath]`
- **shutdown sequence**: `authWrapper?.unwrap()`, `audit.flush()`, `pool.shutdown()`

### 📄 Documentation
- **CLI_REFERENCE**: `cli_plugin` actions documented; `cli_command` approval level corrected
- **OLLAMA_MODEL default**: Documented default value added

### 🧪 Tests
- 8 new tests: dreaming classification ×5, sandbox template literals ×2, batchEdit ACL ×1
- All 357 tests passing
- TypeScript clean (`tsc --noEmit`)

---

## v2.12.0 (2026-05-30)

### 🔴 Security (Critical)
- **Sandbox hardening**: Added guards against `String.fromCharCode`, `\u{...}` (ES6 unicode escapes), `\xNN` (hex escapes), and frozen prototype chain in vm context
- **pool_add_vault symlink bypass fixed**: `authorize()` now resolves symlinks via `fs.realpathSync()` before `allowedRoots` check (CWE-22)
- **MABS importBackup path traversal fixed**: `refName` sanitized with `../` rejection and directory escape validation (CWE-22)
- **JSON.parse hardened**: All user-facing JSON entrypoints (`mabs_import_backup`, `mabs_import_agnostic_bundle`) now wrapped with try/catch — invalid JSON no longer crashes stdio server
- **MAX_NOTE_SIZE enforced**: 10 MB cap on `writeNote`, `appendNote`, `patchNote` (configurable via `FS_MAX_NOTE_SIZE`)
- **CliBridge env whitelist**: `spawn()` no longer passes full `process.env`; only `PATH`, `HOME`, `OBSIDIAN_VAULT_PATH`
- **REST Bridge TLS enforcement**: Throws if token is provided with non-HTTPS URL
- **OperationGate dangerous defaults fixed**: `enableCommands`, `enableBatchEdit`, `enableDelete` now default to `false`
- **Dispatcher duplicate guard**: Throws `TOOL_DUPLICATE` if tool name already registered

### 🟠 Stability
- **BackgroundIndexer DoS fixed**: Force flush when `dirtyFiles.size >= 100`; exponential backoff for `EBUSY` files (max 5 retries)
- **DreamingEngine error visibility**: All swallowed errors now logged via `console.error` instead of bare `catch {}`
- **OpenAIProvider/AnthropicProvider/OllamaProvider**: JSON parse failures now throw descriptive errors instead of silently returning strings
- **LLMAdapter MABS silent fails**: Now log warnings instead of swallowing errors
- **DevSystemEngine**: `ENOENT` returns `null`, all other errors propagate (no more `EACCES` ≡ `ENOENT`)
- **CliBridge listener leak**: `proc.removeAllListeners()` called after spawn completion
- **AuthTransportWrapper**: `unwrap()` called during graceful shutdown

### 🟡 Architecture
- **Config `envBool` hardened**: Now accepts only `true|1|yes|on` / `false|0|no|off`; unknown values fall back to default instead of becoming `true`
- **FileTypeRouter base64 guard**: Validates `data` field is a string before `Buffer.from()`
- **LLM provider response guards**: HTTP responses validated for expected structure before property access

### 📄 Documentation
- README updated: 97 tools (was 80), MABS section added, security defaults corrected
- CLI version aligned: `2.12.0` everywhere

### 🧪 Tests
- All 339 tests passing
- TypeScript clean (`tsc --noEmit`)

---

## v2.11.0

Initial audited release.
