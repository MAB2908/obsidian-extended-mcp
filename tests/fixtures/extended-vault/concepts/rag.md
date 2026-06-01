v0.1b: 
---
title: "RAG: Retrieval Augmented Generation"
date: 2026-05-14
tags: [concept, ai, llm, architecture]
status: evergreen
---

# RAG

> Архитектура, комбинирующая retrieval и генерацию для улучшения ответов LLM.

## Pipeline
1. **Indexing** — документы разбиваются на чанки и индексируются
2. **Retrieval** — поиск релевантных чанков по запросу
3. **Generation** — LLM генерирует ответ с учётом retrieved контекста

## Преимущества
- Снижение галлюцинаций
- Доступ к актуальным данным
- Верифицируемые источники

## Варианты
- **Naive RAG** — базовый retrieval + generation
- **Advanced RAG** — query rewriting, reranking
- **Modular RAG** — гибкая оркестрация

## Связи
- [[embedding]] — векторный поиск
- [[llm-alignment]] — качество генерации
- [[vector-database]] — хранение индекса
