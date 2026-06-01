v0.1b: 
---
title: "Embedding"
date: 2026-05-14
tags: [concept, ai, nlp, representation]
status: evergreen
---

# Embedding

> Плотные векторные представления объектов в непрерывном пространстве.

## Суть
Каждому объекту (слову, предложению, изображению) сопоставляется вектор фиксированной размерности. Похожие объекты имеют близкие векторы.

## Типы
- **Word2Vec** — контекстные векторы слов
- **GloVe** — глобальные векторы
- **BERT embeddings** — контекстуализированные
- **Image embeddings** — CLIP, ResNet

## Применения
- [[semantic-search]] — поиск по смыслу
- [[rag]] — Retrieval Augmented Generation
- [[recommendation-systems]] — рекомендации

## Связи
- [[neural-networks]] — базовая технология
- [[transformers]] — современные эмбеддинги
- [[vector-database]] — хранение векторов
