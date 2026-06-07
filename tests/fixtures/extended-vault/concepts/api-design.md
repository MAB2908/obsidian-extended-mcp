v0.2b: 
---
title: "API Design"
date: 2026-05-16
tags: [concept, dev, architecture]
status: evergreen
---

# API Design

> Принципы проектирования программных интерфейсов.

## REST
- Stateless взаимодействие
- Ресурсы идентифицируются URI
- HTTP методы: GET, POST, PUT, DELETE
- Коды статусов для семантики

## GraphQL
- Клиент запрашивает нужные поля
- Единый endpoint
- Типизированная схема

## gRPC
- Protocol Buffers
- HTTP/2
- Стриминг

## Связи
- [[type-safety]] — контракты API
- [[project-api-gateway]] — реализация
- [[dependency-injection]] — архитектура сервисов
