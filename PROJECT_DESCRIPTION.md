v0.2b: 
# Obsidian Extended MCP — Comprehensive Project Overview

**Version:** 0.1b (beta)  
**Repository:** https://github.com/MAB2908/obsidian-extended-mcp

---

## 1. What Is This

**Obsidian Extended MCP** is a server-side bridge (MCP Server) that transforms your Obsidian knowledge base (vault) into a fully-fledged data store for AI agents. Unlike plugins that run inside Obsidian, this project is a **standalone Node.js server** connectable to any MCP-compatible client (Claude Desktop, Kimi, Cline, Continue, and others) via the standard MCP protocol.

The project solves a fundamental problem: most AI assistants cannot work with local notes, knowledge graphs, or the semantic context of the user. Obsidian Extended MCP gives AI **91 tools** for reading, writing, searching, analyzing, and transforming notes — with full access control, auditing, and security.

---

## 2. Problem Statement

### Problem: AI Works in a Vacuum
Standard LLMs have no access to your personal notes, research, projects, or the connections between them. Even if you copy text into a prompt, you lose:
- The graph of links between notes
- Change history
- Tags and ontology
- Context from previous sessions

### Problem: Existing Integrations Are Too Simple
Existing MCP servers for Obsidian provide only basic CRUD (create/read/update/delete notes). They do not understand:
- What a MOC (Map of Content) is
- Which notes are "orphans" (without backlinks)
- Where link gaps exist in the knowledge graph
- How to search by meaning rather than keywords

### Problem: Security
Giving AI direct filesystem access is dangerous. A multi-layered security model is needed that:
- Prevents escaping the vault boundaries
- Separates read/write permissions by folder
- Requires confirmation for dangerous operations
- Maintains an audit log of all changes
- Protects against path traversal and symlink attacks

### Problem: Scale
When a vault contains 10,000+ notes, simple text search stops working. You need:
- BM25 ranking
- Vector semantic search
- Graph algorithms (PageRank, clustering)
- Background indexing

---

## 3. How It Differs from Other Implementations

### Comparison with Basic MCP Servers for Obsidian

| Feature | Basic MCP Servers | Obsidian Extended MCP |
|---------|-------------------|----------------------|
| Read/write notes | ✅ | ✅ |
| Semantic search (vector) | ❌ | ✅ (BM25 + embeddings + RRF) |
| Graph analysis | ❌ | ✅ (PageRank, BFS, Louvain clustering) |
| AI agents (7 types) | ❌ | ✅ (ingest, tag, query, compile, link, lint, enrich) |
| Autonomous vault maintenance | ❌ | ✅ (L9 Dreaming + Auto-Dreaming) |
| Multi-vault | ❌ | ✅ (VaultPool + VaultRouter) |
| Security model (10 layers) | ❌ | ✅ |
| Audit and rollback | ❌ | ✅ |
| CLI Bridge (obsidian-cli) | ❌ | ✅ |
| REST Bridge (Local REST API) | ❌ | ✅ |
| Model-Aware Backup System | ❌ | ✅ |
| Dev System (L1-L4 prompts/skills/agents/workflows) | ❌ | ✅ |
| Sandboxed code execution | ❌ | ✅ |
| Batch edit with preview and ACL | ❌ | ✅ |

### Comparison with Obsidian Plugins

Plugins run **inside** Obsidian and are limited by its API. Obsidian Extended MCP:
- Runs **outside** Obsidian — the server can be on a different machine
- Supports **multiple vaults** simultaneously
- Is accessible to **any MCP client**, not just Obsidian
- Has a **REST API** for integration with external services
- Provides a **semantic layer** that plugins cannot implement due to WebAssembly limitations

### Comparison with Vector Databases (Pinecone, Weaviate, Chroma)

Vector databases store embeddings but do not understand:
- Folder hierarchy and Obsidian ontology
- Wiki-links `[[...]]`
- Frontmatter and tags
- The graph structure of knowledge

Obsidian Extended MCP **combines** vector search with graph analysis and the filesystem — it is not a replacement, but an overlay on top of the existing vault structure.

---

## 4. Architecture (9 Layers)

The project is built on a **layered architecture** with clear separation of concerns:

### L1 — Filesystem (VaultManager, VaultPool, VaultRouter)
Atomic file operations, locks, backups, path validation, protection against path traversal.

### L2 — Bridges (CLI Bridge + REST Bridge)
Integration with Obsidian via `obsidian-cli` and Local REST API. Allows retrieving backlinks, orphans, unresolved links — data unavailable through the filesystem.

### L3 — Pipeline (Dispatcher + PipelineOrchestrator)
Orchestration of AI operations. Concept compilation, vault linting, note enrichment.

### L4 — Semantic (BM25 + Vector Engine + Graph Engine + SemanticDatabase)
Full-text BM25 search, vector embeddings (OpenAI/Ollama), Reciprocal Rank Fusion, graph analysis (PageRank, Louvain, BFS).

### L5 — Bootstrap (ContextBootstrap + CLI)
Contextual loading at startup: ontology, link rules, session history. Gives AI an understanding of vault structure before work begins.

### L6 — AI Core (7 agents + LLM Adapter)
- **Ingest** — transforms raw notes into structured concepts
- **Tag** — auto-tagging based on ontology
- **Query** — answers questions based on the vault
- **Compile** — compiles recent changes into concepts and MOCs
- **Link** — suggests links between notes
- **Lint** — finds problems (orphans, duplicates, stale notes)
- **Enrich** — enriches metadata

### L7 — Dev System (4 Levels)
- **L1** — Prompts: instruction templates for AI
- **L2** — Skills: reusable procedures
- **L3** — Agents: autonomous roles with system prompts
- **L4** — Workflows: multi-phase processes (spec → draft → simplify → verify)
- **CLAUDE.md** — central knowledge repository about the project

### L8 — Security (10 Defense Layers)
Transport auth → Vault isolation → Folder ACL → Operation gating → Approval engine → Batch edit guard → Sandbox → Audit logging → JSON bomb protection → Safe defaults.

### L9 — Dreaming (Autonomous Maintenance)
Autonomous vault analysis: link gap detection, merge candidates, stale notes, missing MOCs. **Auto-Dreaming** — background maintenance with cross-platform file watching (chokidar).

---

## 5. Value Proposition (Use Cases)

### For Researchers and Writers
- Semantic search across 10,000+ notes: "find everything I wrote about cognitive biases in the context of decision making"
- Automatic MOC generation from accumulated materials
- Discovery of hidden connections between ideas through graph analysis

### For Developers
- Dev System (L1-L4) for managing prompts, skills, and agents in code
- Model-Aware Backup System (MABS) — artifact versioning tied to the AI model
- Sandboxed execution for safe user script execution

### For Teams and Organizations
- Multi-vault: one server serves vaults for different projects
- Folder ACL: different teams have access only to their folders
- Audit logging: complete history of who changed what and when

### For PKM Enthusiasts
- Auto-Dreaming: the vault cleans itself of empty files, fixes tags, removes cache
- 7 AI agents turn raw notes into a connected knowledge base
- Rollback of any change via the backup system

---

## 6. Technical Highlights

- **TypeScript + ESM** — modern stack, Node.js ≥ 20
- **SQLite** — local storage for embeddings and semantic index (no external DB required)
- **Zero external DB dependencies** — works out of the box
- **Cross-platform** — Windows, macOS, Linux (including file watching)
- **293 tests** — 38 test files, critical path coverage
- **Atomic writes** — no operation will corrupt a note on failure
- **File locking** — concurrent access to the same file without data loss

---

## 7. Project Philosophy

> **"AI should work with your knowledge, not replace it."**

Obsidian Extended MCP does not try to replace Obsidian or become a black box. It:
- Works with **ordinary markdown files** — no vendor lock-in
- **Enhances** rather than changes your vault structure
- **Respects ontology** — you can enforce tag and folder rules
- **Is secure by default** — all dangerous functions are disabled, enable only what you need
- **Is transparent** — every action is logged, every change can be rolled back

---

## 8. Status and Roadmap (Beta)

**Current Status (v0.2b):**
- ✅ All 9 architectural layers implemented
- ✅ 91 MCP tools
- ✅ 293 tests passing
- ✅ Security audit passed (14 fixes in v2.12.5)
- ✅ Cross-platform file watching (Auto-Dreaming)

**Upcoming Plans:**
- Web UI for server management
- Obsidian plugin (native integration)
- Canvas file support
- Git synchronization

---

## 9. Quick Start

```bash
npm install -g obsidian-extended-mcp
obsidian-mcp init-meta --path ./my-vault
node dist/index.js
```

Connect to Claude Desktop, Kimi, Cline, or any MCP client — and your notes become context for AI.
