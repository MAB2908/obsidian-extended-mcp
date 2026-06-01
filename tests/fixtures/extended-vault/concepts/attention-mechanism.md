v0.1b: 
---
title: "Attention Mechanism"
date: 2026-05-12
tags: [concept, ai, nlp, transformers]
status: evergreen
---

# Attention Mechanism

> Механизм, позволяющий модели фокусироваться на релевантных частях входа.

## Self-Attention
$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

## Multi-Head Attention
Несколько параллельных механизмов внимания с различными проекциями.

## Применения
- Машинный перевод
- Суммаризация текста
- Вопросно-ответные системы
- Компьютерное зрение (ViT)

## Связи
- [[transformers]] — архитектура на основе attention
- [[attention-is-all-you-need]] — оригинальная статья
