---
title: "Project: MCP Obsidian"
date: 2026-05-20
tags: [project, obsidian, mcp, typescript]
status: active
priority: high
---

# Project: MCP Obsidian

## Цель
Создать полноценный MCP (Model Context Protocol) сервер для интеграции LLM с Obsidian vault.

## Задачи
- [x] Базовый MCP сервер
- [x] Файловые операции (CRUD)
- [x] Поиск (BM25 + semantic)
- [x] Граф знаний
- [x] Безопасность (sandbox, ACL)
- [ ] Ollama Cloud интеграция
- [ ] Mobile support
- [ ] Плагин для Obsidian

## Архитектура
```
Client (Claude/Kimi) → MCP Server → Obsidian Vault
                            ↓
                    BM25 | Semantic | Graph
```

## Ресурсы
- [[obsidian-mcp]] — инструмент
- [[api-design]] — принципы
- [[type-safety]] — TypeScript

## Лог
| Дата | Событие |
|------|---------|
| 2026-05-20 | Проект запущен |
| 2026-05-25 | v2.0 с security layer |
| 2026-05-30 | v2.12.5 — аудит пройден |
