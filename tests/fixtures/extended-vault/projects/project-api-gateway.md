v0.1b: 
---
title: "Project: API Gateway"
date: 2026-05-22
tags: [project, dev, api, infrastructure]
status: active
priority: low
---

# Project: API Gateway

## Цель
Универсальный шлюз для микросервисной архитектуры.

## Функции
- **Routing** — распределение запросов
- **Rate Limiting** — ограничение нагрузки
- **Auth** — JWT validation
- **Caching** — кэширование ответов
- **Observability** — метрики и логи

## Технологии
- Kong / Envoy /自建
- Redis для rate limiting
- Prometheus + Grafana

## Связи
- [[api-design]] — принципы REST/GraphQL
- [[dependency-injection]] — архитектура
