v0.1b: 
---
title: "Semantic Search"
date: 2026-05-14
tags: [concept, ai, nlp, search]
status: evergreen
---

# Semantic Search

> Поиск по смыслу, а не по ключевым словам.

## Подходы
1. **Dense Retrieval** — векторный поиск (cosine similarity)
2. **Sparse Retrieval** — BM25, TF-IDF
3. **Hybrid** — комбинация dense + sparse

## Реализация
- [[embedding]] — векторизация запроса и документов
- [[vector-database]] — хранение и поиск векторов
- [[rag]] — retrieval augmented generation

## Метрики
- MRR (Mean Reciprocal Rank)
- NDCG (Normalized Discounted Cumulative Gain)
- Recall@K
