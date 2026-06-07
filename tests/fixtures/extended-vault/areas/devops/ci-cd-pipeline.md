v0.2b: 
---
title: "CI/CD Pipeline"
date: 2026-05-18
tags: [concept, devops, automation]
status: evergreen
---

# CI/CD Pipeline

> Непрерывная интеграция и доставка.

## Компоненты
1. **Build** — компиляция, сборка артефактов
2. **Test** — unit, integration, e2e
3. **Security Scan** — SAST, DAST, dependency check
4. **Deploy** — staging → production

## Инструменты
- GitHub Actions
- GitLab CI
- Jenkins
- ArgoCD

## Связи
- [[test-pyramid]] — стратегия тестирования
- [[project-api-gateway]] — деплой микросервисов
