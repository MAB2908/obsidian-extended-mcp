# Чек-лист работоспособности obsidian-extended-mcp

Дата проверки: 2026-06-15
Среда: Windows 11, Git Bash
Vault: `C:/Users/user/Documents/Obsidian Vault` (12591 notes, 35836 chunks)
LLM: `deepseek-v4-pro:cloud` через Ollama Cloud (`https://ollama.com/v1/chat/completions`)
Embeddings: `nomic-embed-text:latest` через локальный Ollama (`http://localhost:11434`)
Obsidian Desktop: закрыт

## Легенда

- ✅ — работает
- ⚠️ — работает с ограничениями / требует внимания
- ❌ — не работает в текущей конфигурации
- ⬜ — не тестировалось

---

## L1 — Файловая система

| Команда | Статус | Примечание |
|---------|--------|------------|
| `read_note` | ✅ | Читает существующие заметки, frontmatter, content |
| `read_file` | ✅ | Читает markdown-файлы |
| `write_note` | ✅ | Создаёт/перезаписывает заметки |
| `write_file` | ⬜ | Не тестировалось (бинарные/текстовые файлы) |
| `append_note` | ✅ | Дописывает в конец |
| `patch_note` | ⚠️ | Не добавляет `.md` автоматически; используйте полный путь с `.md` |
| `delete_note` | ✅ | Работает (backup → удаление) |
| `move_note` | ⬜ | Не тестировалось |
| `list_directory` | ✅ | Возвращает файлы и папки |
| `search_notes` | ✅ | Простой текстовый поиск |
| `fs_list_notes` | ✅ | Список заметок с фильтрами |
| `get_vault_stats` | ✅ | 12591 notes, 552 folders, 20859 tags, 12135 links |
| `list_all_tags` | ✅ | Возвращает теги и счётчики |
| `manage_tags` | ✅ | Добавляет теги |
| `validate_note` | ✅ | Работает |

## L2 — Граф

| Команда | Статус | Примечание |
|---------|--------|------------|
| `fs_get_graph` | ✅ | Возвращает граф в формате adjacency list |
| `fs_graph_find_path` | ✅ | BFS-путь между заметками |
| `graph_neighbors` | ✅ | Соседи узла |
| `graph_analyze_centrality` | ✅ | PageRank |
| `graph_detect_communities` | ✅ | Louvain communities |

## L3 — Поиск / индекс

| Команда | Статус | Примечание |
|---------|--------|------------|
| `build_index` | ✅ | Запускает полную переиндексацию |
| `db_stats` | ✅ | nodes: 12591, edges: 12135, chunks: 35836, embeddings: 35836 |
| `bm25_search` | ✅ | Возвращает BM25-результаты |
| `semantic_search` | ✅ | RRF из BM25 + векторного поиска |
| `semantic_search_db` | ✅ | Работает после смены FTS5 tokenizer на `unicode61` |
| `semantic_rag` | ✅ | Возвращает релевантные чанки |

## L4 — AI pipeline

| Команда | Статус | Примечание |
|---------|--------|------------|
| `ai_query` | ✅ | Отвечает на вопрос по базе знаний |
| `ai_link` | ✅ | Работает на существующих заметках; prompt ограничен для cloud-модели |
| `ai_link_batch` | ⬜ | Не тестировалось |
| `ai_tag` | ✅ | Работает |
| `ai_enrich` | ✅ | Работает |
| `ai_ingest` | ⬜ | Не тестировалось |
| `ai_compile` | ⬜ | Не тестировалось |

## L5 — Backup / Audit

| Команда | Статус | Примечание |
|---------|--------|------------|
| `audit_log` | ✅ | Возвращает последние события |
| `list_backups` | ✅ | Список бэкапов |
| `rollback` | ⬜ | Не тестировалось |

## L6 — Batch / Context

| Команда | Статус | Примечание |
|---------|--------|------------|
| `batch_edit` | ✅ | Preview-режим работает |
| `get_context_bootstrap` | ✅ | Возвращает системный промпт для агентов |

## L7 — CLI bridge (Obsidian CLI)

Obsidian Desktop закрыт → используется fallback на Windows.

| Команда | Статус | Примечание |
|---------|--------|------------|
| `cli_backlinks` | ✅ | Fallback на граф |
| `cli_orphans` | ✅ | Fallback на граф |
| `cli_deadends` | ✅ | Fallback на граф |
| `cli_unresolved` | ✅ | Fallback на файловую систему |
| `cli_search` | ✅ | Fallback на vault search |
| `cli_properties` | ⬜ | Не тестировалось |
| `cli_daily` | ⬜ | Не тестировалось |
| `cli_command` | ❌ | Нет fallback, требует открытый Obsidian Desktop |
| `cli_plugin` | ❌ | Нет fallback, требует открытый Obsidian Desktop |

## L8 — Local REST API

Obsidian Desktop закрыт → недоступно.

| Команда | Статус | Примечание |
|---------|--------|------------|
| `rest_active_note` | ❌ | REST API unavailable |
| `rest_dataview` | ❌ | REST API unavailable |

## L9 — Vault pool

| Команда | Статус | Примечание |
|---------|--------|------------|
| `pool_list_vaults` | ✅ | Возвращает текущий vault |
| `pool_add_vault` | ⬜ | Не тестировалось |
| `pool_remove_vault` | ⬜ | Не тестировалось |

## L10 — 4-Level Dev System

| Команда | Статус | Примечание |
|---------|--------|------------|
| `dev_prompt_list` | ✅ | Список dev prompts |
| `dev_prompt_get` | ⬜ | Не тестировалось |
| `dev_prompt_create` | ⬜ | Не тестировалось |
| `dev_prompt_delete` | ⬜ | Не тестировалось |
| `dev_prompt_execute` | ⬜ | Не тестировалось |
| `dev_skill_list` | ✅ | Список dev skills |
| `dev_skill_get` | ⬜ | Не тестировалось |
| `dev_skill_create` | ⬜ | Не тестировалось |
| `dev_skill_delete` | ⬜ | Не тестировалось |
| `dev_skill_execute` | ⬜ | Не тестировалось |
| `dev_agent_list` | ✅ | Список dev agents |
| `dev_agent_get` | ⬜ | Не тестировалось |
| `dev_agent_create` | ⬜ | Не тестировалось |
| `dev_agent_delete` | ⬜ | Не тестировалось |
| `dev_workflow_list` | ✅ | Список workflows |
| `dev_workflow_get` | ⬜ | Не тестировалось |
| `dev_workflow_create` | ⬜ | Не тестировалось |
| `dev_workflow_delete` | ⬜ | Не тестировалось |
| `dev_workflow_advance` | ⬜ | Не тестировалось |
| `dev_workflow_fail` | ⬜ | Не тестировалось |
| `dev_claude_md_get` | ✅ | Возвращает CLAUDE.md |
| `dev_claude_md_append` | ⬜ | Не тестировалось |

## L11 — Dreaming

| Команда | Статус | Примечание |
|---------|--------|------------|
| `dream_scan` | ✅ | Работает (kind=link) |
| `dream_finalize` | ⬜ | Не тестировалось |
| `dream_undo` | ⬜ | Не тестировалось |
| `auto_dream_run` | ⬜ | Не тестировалось |
| `auto_dream_install_scheduler` | ⬜ | Не тестировалось |
| `auto_dream_status` | ✅ | Читает лог |

## L12 — MABS (Model-Aware Backup System)

| Команда | Статус | Примечание |
|---------|--------|------------|
| `mabs_list_models` | ✅ | Показывает `ollama/deepseek-v4-pro:cloud` |
| `mabs_set_current_model` | ⬜ | Не тестировалось |
| `mabs_list_artifacts` | ⚠️ | Падает без `set_current_model` |
| `mabs_snapshot_artifact` | ⬜ | Не тестировалось |
| `mabs_artifact_history` | ⬜ | Не тестировалось |
| `mabs_list_sessions` | ⬜ | Не тестировалось |
| `mabs_can_replay` | ⬜ | Не тестировалось |
| `mabs_export_backup` | ⬜ | Не тестировалось |
| `mabs_import_backup` | ⬜ | Не тестировалось |
| `mabs_export_agnostic_bundle` | ⬜ | Не тестировалось |
| `mabs_import_agnostic_bundle` | ⬜ | Не тестировалось |

---

## Известные проблемы

1. **`patch_note` не добавляет `.md` автоматически**
   - Передавайте полный путь, например `"path": "test.md"`.

2. **CLI tools `cli_command` и `cli_plugin`**
   - Не работают без открытого Obsidian Desktop (нет fallback).

3. **REST API tools**
   - Не работают без запущенного Obsidian Desktop + Local REST API plugin.

4. **`index-bm25.json` занимает ~350 МБ**
   - Функционально работает, но занимает много места. Можно оптимизировать, если потребуется.
