v0.1b: 
# Obsidian Extended MCP — Техническая спецификация

> **Версия:** 2.11.0
> **Дата:** 2026-05-27
> **Статус:** Готово к реализации
> **Базовая реализация:** `@bitbonsai/mcpvault` (TypeScript, MIT)
> **Основной мост:** Официальный Obsidian CLI (`obsidian`, требуется Obsidian 1.12+)
> **Цепочка отката:** Локальный REST API (coddingtonbear) → Advanced URI → Только файловая система

---

## Содержание

1. [Резюме](#1-резюме)
2. [Глоссарий и соглашения](#2-глоссарий-и-соглашения)
3. [Обзор системы](#3-обзор-системы)
4. [Архитектура](#4-архитектура)
5. [Функциональные требования](#5-функциональные-требования)
6. [Спецификация интерфейса MCP](#6-спецификация-интерфейса-mcp)
7. [Нефункциональные требования](#7-нефункциональные-требования)
8. [Архитектура данных](#8-архитектура-данных)
9. [План реализации](#9-план-реализации)
10. [Стратегия тестирования](#10-стратегия-тестирования)
11. [CI/CD и интеграция с GitHub](#11-cicd-и-интеграция-с-github)
12. [Модель безопасности](#12-модель-безопасности)
13. [Приложения](#13-приложения)

---

## 1. Резюме

**Obsidian Extended MCP** — это **AI-first сервер Model Context Protocol**, где искусственный интеллект является центральным управляющим звеном всего жизненного цикла знаний. В отличие от обычных MCP (которые лишь «открывают дверь» к файлам), этот проект превращает AI из пассивного инструмента в **активного оператора базы знаний**.

**Философия:** Накопление → Обработка → Использование знаний происходит **только через AI** по единым правилам. Не важно, какую модель вы используете — GPT-4, Claude, Llama 3.1 или Mistral — протокол обработки остаётся неизменным.

### Что делает AI

| Этап | Действие AI | Результат |
|------|-------------|-----------|
| **Ingest** | Читает сырые заметки, извлекает сущности, структурирует | Стандартизированные источники с frontmatter |
| **Compile** | Синтезирует концепции, находит связи, строит MOC | Связанная база знаний |
| **Link** | Автоматически связывает упоминания с концепциями | Живой граф знаний |
| **Tag** | Классифицирует по онтологии, предлагает новые теги | Самоорганизующаяся таксономия |
| **Query** | Ищет по смыслу, строит контекст, отвечает с цитатами | Ответы на основе ваших знаний |
| **Lint** | Находит сирот, тупики, дубликаты, предлагает улучшения | Здоровое хранилище |

### Ключевые отличия

| Возможность | Обычные MCP (~50 шт.) | Obsidian Extended MCP (AI-first) |
|---------|----------------------|----------------------------------|
| **Роль AI** | Пассивный клиент (читает файлы) | Активный оператор (управляет всем циклом) |
| **Универсальность моделей** | Привязка к одному провайдеру | LLM Adapter: GPT-4 / Claude / Llama / Mistral |
| **Структура хранения** | Произвольные файлы | AI-управляемая онтология с валидацией |
| **Поиск** | Regex или простой текст | BM25 + семантический + графовый (RRF) |
| **Связи** | Ручные викиссылки | AI-автолинкинг + графовая аналитика |
| **Pipeline** | Нет | Ingest → Compile → Link → Tag → Query → Lint |
| **Прозрачность** | Чёрный ящик | Каждое AI-действие логируется с объяснением |
| **Скорость** | O(N) сканирование | O(1) Map-индексы, inverted index, concurrent reads |

### Базовая реализация и зависимости

- **Ядро:** TypeScript, Node.js 22+, 0 Python, 0 Docker
- **LLM Adapter:** Универсальный интерфейс над любой моделью (OpenAI, Anthropic, Ollama, transformers.js)
- **Хранилище:** Obsidian vault с AI-управляемой структурой (`raw/` → `source/` → `concepts/` → `moc/`)
- **Obsidian CLI:** Опционально; ядро работает без него (файловая система)


---

## 2. Глоссарий и соглашения

| Термин | Определение |
|------|-----------|
| **Vault** | Корневая папка, содержащая все markdown-файлы, вложения и метаданные |
| **MOC** | Map of Content — индексная заметка со ссылками на связанные концепции |
| **Wikilink** | Внутренняя ссылка Obsidian: `[[Note Name]]` или `[[Note Name\|Display]]` |
| **Frontmatter** | Блок YAML-метаданных в начале заметки (ограничен `---`) |
| **Конвейер Karpathy** | 6-фазный рабочий процесс знаний: Ingest → Compile → Link → Tag → Query → Lint |
| **Онтология** | Контролируемый словарь тегов и правил папок, хранящийся в `meta/ontology.md` |
| **Уровень 1 (ФС)** | Только файловая система — ядро (CRUD, поиск, граф через парсинг) |
| **Уровень 2 (CLI)** | Мост Obsidian CLI (команда `obsidian`, IPC через stdout) |
| **Уровень 2b (REST)** | Fallback-мост через плагин (HTTP к Local REST API) |
| **Уровень 3 (Pipeline)** | Автоматизационный слой Karpathy |
| **Уровень 4 (Semantic)** | Эмбеддинги, кластеризация, авто-тегирование, RAG |
| **Уровень 5 (Bootstrap)** | Протокол инъекции контекста для сессий LLM |
| **AI Core (L6)** | LLM Adapter + AI Agents — центральный управляющий слой |
| **LLM Adapter** | Универсальный интерфейс над любыми моделями (OpenAI, Anthropic, Ollama) |
| **AI Agent** | Специализированный AI-оператор (IngestAgent, CompileAgent, LinkAgent, TagAgent, QueryAgent, LintAgent, EnrichAgent) |
| **Structured Output** | Строго типизированный JSON от всех AI-операций с reasoning и confidence |

| **Диспетчер** | Рантайм-роутер, выбирающий лучший доступный уровень для каждой операции |

### Соглашения об именовании

- **Инструменты:** `layer_action_target` (например, `read_note`, `cli_backlinks`, `semantic_search`)
- **Ресурсы:** `vault://{scope}/{path}`
- **Промпты:** `prompt://{phase}`
- **Ключи конфигурации:** camelCase (`vaultPath`, `cliBridgeEnabled`)

---

## 3. Обзор системы

### 3.1. Высокоуровневая диаграмма

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM Client                               │
│         (Claude Desktop, Kimi CLI, Cursor, etc.)                │
└─────────────────────────┬───────────────────────────────────────┘
                          │ stdio / Streamable HTTP
┌─────────────────────────▼───────────────────────────────────────┐
│                  Obsidian Extended MCP Server                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Context    │  │  Dispatcher  │  │   Graceful Degradation│  │
│  │  Bootstrap   │──│   Router     │──│     (L1→L2→L2b)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Layer 1 │ │ Layer 2 │ │ Layer 2b│ │ Layer 3 │ │ Layer 4 │  │
│  │   FS    │ │  CLI    │ │  REST   │ │ Pipeline│ │ Semantic│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│  ┌─────────┐ ┌─────────────────────────────────────────────┐  │
│  │ Layer 5 │ │           Shared Services                    │  │
│  │Bootstrap│ │  Graph Engine │ Tag Engine │ File Router    │  │
│  └─────────┘ │  BM25 Index   │ Vector Idx │ Audit Logger   │  │
│              └─────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│   Vault      │  │ Obsidian CLI│  │   Ollama    │
│  (filesystem)│  │   (IPC)     │  │  (optional) │
└──────────────┘  └─────────────┘  └─────────────┘
```

### 3.2. Принципы проектирования

1. **Файловая система — источник истины.** Уровень 1 должен всегда функционировать автономно.
2. **Obsidian CLI — основная суперспособность** при наличии, но никогда не является жёсткой зависимостью.
3. **Плавная деградация — автоматическая.** Диспетчер пробует CLI → REST → ФС без вмешательства пользователя.
4. **Начальная загрузка контекста устраняет повторения.** LLM получает правила хранилища перед каждой сессией.
5. **Аудит всего.** Каждая операция записи логируется для воспроизводимости и безопасности.
6. **Производительность прежде всего.** Цели: <1с поиск для 10K заметок, <100мс для 100K с инкрементальной индексацией.

---

## 4. Архитектура

### 4.1. Уровень 1: Ядро файловой системы

**Ответственность:** Операции CRUD, текстовый поиск (BM25 + ripgrep), обход графа через парсинг regex, аппроксимация обратных ссылок, маршрутизация по типам файлов.

**Ключевая идея:** Даже без запущенного Obsidian хранилище — это папка markdown-файлов. Уровень 1 парсит викиссылки, frontmatter и теги прямо с диска.

### 4.2. Уровень 2: Мост Obsidian CLI (основной)

**Ответственность:** Доступ к внутренним API Obsidian через официальную команду `obsidian` CLI.

**Модель IPC:** `child_process.spawn('obsidian', ['eval', code])` → парсинг stdout (JSON — основной, plain text — fallback).

**Ключевые возможности:**
- Реальные обратные ссылки через `metadataCache` (не догадки по regex)
- Сироты, неразрешённые ссылки, тупики
- `app.workspace.getActiveFile()` — знать, что читает пользователь
- `DataviewAPI.query()` — выполнение DQL
- Автоматизация командной палитры
- Управление плагинами

### 4.3. Уровень 2b: Fallback REST API

**Ответственность:** Когда CLI недоступен (нет Obsidian 1.12+), используется плагин сообщества `obsidian-local-rest-api`.

**Возможности:** Получение активной заметки, Dataview DQL, вызов команд.

### 4.4. Уровень 3: Конвейер Karpathy

**Ответственность:** Автоматизация 6-фазного рабочего процесса знаний:

| Фаза | Вход | Выход | Автоматизация | Агент |
|-------|-------|--------|------------|-------|
| **Ingest** | Сырые заметки (`raw/`) | Структурированный источник (frontmatter, теги, ключевые идеи) | `ai_ingest` | IngestAgent |
| **Compile** | Источники (`source/`) | Концепции (`concepts/`) + обновление MOC | `ai_compile` | CompileAgent |
| **Link** | Заметки с несвязанными упоминаниями | Wikilinks между концепциями | `ai_link` | LinkAgent |
| **Tag** | Заметки без/с устаревшими тегами | Актуальная классификация по онтологии | `ai_link` | TagAgent |
| **Query** | Вопрос пользователя | Ответ с цитатами + предлагаемые правки | `ai_query` | QueryAgent |
| **Lint** | Полное хранилище | Отчёт о сиротах, мёртвых ссылках, устаревших MOC | `dream_scan` | LintAgent |

### 4.5. Уровень 4: Семантический движок

**Ответственность:** Поиск на основе эмбеддингов, авто-тегирование, кластеризация, RAG-извлечение контекста.

**Архитектура:** Индексация на уровне чанков, SQLite-метаданные, FAISS или плоское векторное хранилище, RRF-фьюжн с BM25.

### 4.6. Уровень 5: Протокол начальной загрузки контекста

**Ответственность:** В начале каждой сессии LLM автоматически инжектировать:
- `meta/ontology.md` — правила тегов, правила папок
- `meta/protocol.md` — инструкции 4-фазного конвейера
- `meta/link-rules.md` — как создавать викиссылки
- Снимок структуры хранилища
- Реестр скиллов (доступные инструменты и их назначения)

**Зачем:** Без этого LLM "забывает" соглашения хранилища каждую сессию и их приходится напоминать вручную.

### 4.7. Диспетчер и плавная деградация

```
User requests: get_backlinks("neural-networks")

Dispatcher logic:
1. Is Obsidian CLI available? 
   YES → cli_backlinks() → metadataCache (100% accurate)
   NO → goto 2

2. Is Local REST API plugin responding?
   YES → rest_graph_neighbors() → HTTP bridge
   NO → goto 3

3. Layer 1 (Filesystem)
   Parse all .md files for [[neural-networks]] links
   Accuracy: ~90-95% (misses aliases, embedded files)
   Return result with confidence flag
```

### 4.8. AI Core: LLM Adapter & Agents (AI-first слой)

**Философия:** AI — не пассивный клиент, а активный оператор. Все операции с знаниями проходят через единый LLM Adapter, который абстрагирует различия между моделями.

#### 4.8.1. LLM Adapter

Универсальный интерфейс над любыми моделями:

```
┌─────────────────────────────────────────────┐
│              LLM Adapter                    │
├─────────────┬─────────────┬─────────────────┤
│  OpenAI     │  Anthropic  │  Ollama/local   │
│  GPT-4/4o   │  Claude 3   │  Llama 3.1      │
│  o1-mini    │  Sonnet     │  Mistral        │
│  o3-mini    │  Opus       │  Qwen 2.5       │
└─────────────┴─────────────┴─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Unified API: generate(), embed(),          │
│  classify(), extract(), summarize()         │
│  — одинаковые входы/выходы для всех моделей │
└─────────────────────────────────────────────┘
```

**Ключевые принципы:**
- **Модельно-агностичность:** Смена GPT-4 на Llama 3.1 не меняет логику pipeline
- **Авто-выбор:** Лёгкие задачи → локальная модель (быстро, приватно). Сложные задачи → облачная модель (качественно)
- **Fallback:** Если API недоступен → автопереключение на локальную модель
- **Единый формат промптов:** Независимо от модели, системный промпт и user prompt структурируются одинаково

#### 4.8.2. AI Agents

Каждый агент — специализированный AI-оператор с собственным промптом и инструментами:

| Агент | Задача | Триггер | Модель |
|-------|--------|---------|--------|
| **IngestAgent** | Читает raw, извлекает сущности, структурирует frontmatter | Файл в `raw/` | Любая (легкая задача) |
| **CompileAgent** | Синтезирует концепции из источников, строит MOC | Batch или по запросу | Сильная модель |
| **LinkAgent** | Находит несвязанные упоминания, предлагает wikilinks | Периодический или по запросу | Любая |
| **TagAgent** | Классифицирует заметки, предлагает новые теги | При ingest/compile | Любая |
| **QueryAgent** | Отвечает на вопросы с цитатами из хранилища | User prompt | Сильная модель |
| **LintAgent** | Находит проблемы: сироты, тупики, дубликаты | Периодический | Любая |
| **EnrichAgent** | Добавляет определения, примеры, связи к существующим концепциям | По запросу | Сильная модель |

**Принцип работы:**
1. Агент получает задачу (например, "ingest `raw/article.md`")
2. Агент читает онтологию и протокол из `meta/`
3. Агент вызывает LLM Adapter с structured prompt
4. LLM возвращает структурированный результат (JSON с frontmatter, тегами, ссылками)
5. Агент валидирует результат по онтологии
6. Агент записывает результат в vault через Filesystem Layer
7. Каждое действие логируется: что сделано, почему, какая модель использовалась

#### 4.8.3. Structured Output Protocol

Все AI-операции возвращают строго типизированный JSON:

```typescript
interface AIResult<T> {
  model: string;           // "gpt-4o" | "claude-sonnet-3-5" | "llama3.1:8b"
  confidence: number;      // 0.0–1.0
  reasoning: string;       // Почему принято такое решение (для прозрачности)
  data: T;                 // Собственно результат
  tokens_used: number;     // Для учёта затрат
  latency_ms: number;      // Для мониторинга скорости
}
```

**Прозрачность:** Пользователь всегда может спросить "почему ты так решил?" — и получит цепочку рассуждений из поля `reasoning`.

---

## 5. Функциональные требования

### 5.1. Уровень 1: Ядро файловой системы (F1.1 – F1.20, F1.24)

| ID | Требование | Приоритет |
|----|-------------|----------|
| F1.1 | `read_note` — Чтение markdown-заметки с опциональным парсингом frontmatter | P0 |
| F1.2 | `write_note` — Атомарная запись с бэкапом (tmp → rename) | P0 |
| F1.3 | `append_note` — Добавление в конец или к конкретному заголовку | P0 |
| F1.4 | `patch_note` — Патч конкретного заголовка, блока или поля frontmatter | P0 |
| F1.5 | `delete_note` — Мягкое удаление (перемещение в `.trash/`) или жёсткое удаление | P0 |
| F1.6 | `move_note` — Перемещение файла + обновление всех викиссылок, указывающих на него | P0 |
| F1.7 | `list_directory` — Список файлов и папок в директории | P0 |
| F1.7b | `fs_list_notes` — Список markdown-заметок с фильтрами (теги, паттерны) | P0 |
| F1.8 | `search_notes` — Полнотекстовый поиск BM25 + ripgrep | P0 |
| F1.9 | ~~`fs_get_backlinks`~~ — Удалено; использовать `cli_backlinks` или `graph_neighbors` | — |
| F1.10 | ~~`fs_get_forward_links`~~ — Не реализовано | — |
| F1.11 | `fs_get_graph` — Полный граф хранилища в виде списка смежности (узлы + рёбра) | P0 |
| F1.12 | `graph_neighbors` — Подграф BFS/DFS вокруг заметки | P0 |
| F1.13 | `graph_analyze_centrality` — PageRank на графе хранилища | P1 |
| F1.14 | `graph_detect_communities` — Реализовано (L4 Semantic Engine) | — |
| F1.15 | `fs_graph_find_path` — Кратчайший путь между двумя заметками | P1 |
| F1.16 | `manage_tags` — Добавление/удаление тегов из frontmatter заметки | P0 |
| F1.17 | `list_all_tags` — Все теги с количеством вхождений | P0 |
| F1.18 | `validate_note` — Проверка валидности frontmatter, соответствия тегам | P1 |
| F1.19 | `get_vault_rules` — Возврат онтологии + протокола как контекста | P0 |
| F1.20 | ~~`fs_read_canvas`~~ — Удалено; использовать `read_file` | — |
| F1.21 | `read_file` — Чтение любого файла (markdown, canvas, json, изображения как base64) | P0 |
| F1.22 | `write_file` — Запись любого файла (текст, canvas, json, base64) | P0 |
| F1.23 | `batch_edit` — Применение трансформации к нескольким заметкам | P1 |
| F1.24 | `get_vault_stats` — Статистика хранилища | P1 |



### 5.2. Уровень 2: Мост Obsidian CLI (F2.1 – F2.11, F2.15 – F2.20)

| ID | Требование | Приоритет |
|----|-------------|----------|
| F2.1 | `cli_eval` — Выполнение произвольного JavaScript в контексте Obsidian | P0 |
| F2.2 | `cli_backlinks` — Реальные обратные ссылки из metadataCache | P0 |
| F2.3 | `cli_orphans` — Заметки с нулевым количеством входящих ссылок | P0 |
| F2.4 | `cli_unresolved` — Сломанные викиссылки | P0 |
| F2.5 | `cli_deadends` — Заметки с нулевым количеством исходящих ссылок | P0 |
| F2.6 | `cli_properties` — CRUD свойств frontmatter через CLI | P0 |

| F2.8 | `cli_search` — Нативный поиск Obsidian (быстрее regex) | P0 |
| F2.9 | `cli_daily` — Чтение/добавление/вставка ежедневной заметки | P1 |
| F2.10 | `cli_command` — Выполнение любой команды командной палитры по имени | P1 |
| F2.11 | `cli_plugin` — Список/включение/отключение/перезагрузка плагинов | P1 |

| F2.15 | Автообнаружение: проверка доступности `obsidian` CLI при старте | P0 |
| F2.16 | Восстановление IPC: экспоненциальный бэкофф при разрыве соединения | P0 |
| F2.17 | Парсинг вывода: JSON — основной, plain text — fallback, автообнаружение | P0 |
| F2.18 | Матрица таймаутов: 5с для запросов, 30с для eval, 60с для пакетных | P0 |
| F2.19 | Кэширование состояния CLI: кэширование orphans/unresolved для офлайн-использования | P1 |
| F2.20 | Коды ошибок: маппинг stderr CLI на структурированные MCP-ошибки | P0 |

### 5.3. Уровень 2b: Fallback REST API (F2b.1 – F2b.2)

| ID | Требование | Приоритет |
|----|-------------|----------|
| F2b.1 | `rest_active_note` — Текущая открытая заметка через HTTP | P1 |
| F2b.2 | `rest_dataview` — DQL-запрос через REST | P1 |


### 5.4. Уровень 3: Конвейер Karpathy (F3.1 – F3.8)

| ID | Требование | Приоритет |
|----|-------------|----------|
| F3.1 | `ai_ingest` — Преобразование сырой заметки в структурированный источник | P0 |
| F3.2 | `ai_compile` — Синтез концепций из папки `raw/` | P0 |
| F3.3 | `ai_query` — Ответ с контекстом из 3–5 связанных заметок | P0 |
| F3.4 | `dream_scan` — Полная проверка хранилища (сироты, мёртвые ссылки, устаревшие MOC) | P0 |
| F3.5 | `ai_link` — Предложение викиссылок для несвязанных упоминаний | P1 |
| F3.6 | `ai_enrich` — Логирование запроса+ответа в `sessions/` | P0 |
| F3.7 | `ai_compile` — Генерация Map of Content для домена | P1 |
| F3.8 | `ai_enrich` — Предложение улучшений заметки после запроса | P1 |
| F3.9 | `ai_tag` — Автоматическое тегирование заметок по онтологии с предложением новых тегов | P1 |

### 5.5. Уровень 4: Семантический движок (F4.1 – F4.2, F4.5)

| ID | Требование | Приоритет |
|----|-------------|----------|
| F4.1 | `semantic_search` — Поиск по сходству на основе эмбеддингов | P1 |
| F4.2 | `build_index` — Построение/перестроение векторного индекса | P1 |

| F4.5 | `semantic_rag` — Извлечение контекстных чанков для RAG | P1 |

### 5.6. Уровень 5: Начальная загрузка контекста (F5.1 – F5.8, F5.12 – F5.13)

| ID | Требование | Приоритет |
|----|-------------|----------|
| F5.1 | Автоинъекция `meta/ontology.md` при старте сессии | P0 |
| F5.2 | Автоинъекция `meta/protocol.md` при старте сессии | P0 |
| F5.3 | Автоинъекция `meta/link-rules.md` при старте сессии | P0 |
| F5.4 | Автоинъекция снимка структуры хранилища | P0 |
| F5.5 | Автоинъекция реестра скиллов (доступные инструменты) | P0 |
| F5.6 | Умное усечение при превышении лимита токенов контекста | P1 |
| F5.7 | Приоритет: ontology > protocol > link rules > structure > skills | P0 |
| F5.8 | Кэширование содержимого bootstrap для избежания чтения диска на запрос | P1 |

| F5.12 | Управление бюджетом токенов: резерв 20% для bootstrap | P1 |
| F5.13 | Fallback при отсутствии meta-файлов: генерация значений по умолчанию | P1 |


---

## 6. Спецификация интерфейса MCP

### 6.1. Инструменты — Полный реестр

Все инструменты следуют схеме MCP 2024. Входные схемы используют JSON Schema Draft 7.

#### Уровень 1: Ядро файловой системы

```json
{
  "name": "read_note",
  "description": "Read a markdown note from the vault",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Relative path to note" },
      "includeFrontmatter": { "type": "boolean" },
      "includeContent": { "type": "boolean" }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "write_note",
  "description": "Write a markdown note to the vault",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "content": { "type": "string" },
      "frontmatter": { "type": "object" },
      "overwrite": { "type": "boolean" }
    },
    "required": ["path", "content"]
  }
}
```

```json
{
  "name": "append_note",
  "description": "Append content to a note",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "content": { "type": "string" }
    },
    "required": ["path", "content"]
  }
}
```

```json
{
  "name": "patch_note",
  "description": "Patch a note with replace/append/prepend/delete",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "target": { "type": "string" },
      "operation": { "type": "string", "enum": ["replace", "append", "prepend", "delete"] },
      "replacement": { "type": "string" }
    },
    "required": ["path", "target", "operation"]
  }
}
```

```json
{
  "name": "delete_note",
  "description": "Delete a note (optionally soft-delete)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "soft": { "type": "boolean" }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "move_note",
  "description": "Move or rename a note",
  "inputSchema": {
    "type": "object",
    "properties": {
      "from": { "type": "string" },
      "to": { "type": "string" }
    },
    "required": ["from", "to"]
  }
}
```

```json
{
  "name": "list_directory",
  "description": "List files and folders in a directory",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    }
  }
}
```

```json
{
  "name": "fs_list_notes",
  "description": "List markdown notes with optional tag, date, or pattern filters",
  "inputSchema": {
    "type": "object",
    "properties": {
      "folder": { "type": "string", "description": "Subfolder to search" },
      "tag": { "type": "string", "description": "Filter by frontmatter tag" },
      "pattern": { "type": "string", "description": "Glob pattern" }
    }
  }
}
```

```json
{
  "name": "search_notes",
  "description": "Search notes by text query",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "folder": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "read_file",
  "description": "Read any file from the vault (markdown, canvas, json, images as base64)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "write_file",
  "description": "Write any file to the vault (text, canvas, json, base64 binary)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "content": { "type": "string" }
    },
    "required": ["path", "content"]
  }
}
```

```json
{
  "name": "manage_tags",
  "description": "Add, remove, or set tags on a note",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "action": { "type": "string", "enum": ["add", "remove", "set"] },
      "tags": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["path", "action", "tags"]
  }
}
```

```json
{
  "name": "list_all_tags",
  "description": "List all tags and their counts",
  "inputSchema": { "type": "object", "properties": {} }
}
```

```json
{
  "name": "validate_note",
  "description": "Validate note frontmatter, tags, and ontology compliance",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "get_vault_rules",
  "description": "Return ontology, folder rules, and protocol context",
  "inputSchema": { "type": "object", "properties": {} }
}
```

```json
{
  "name": "batch_edit",
  "description": "Apply a transformation to multiple notes matching criteria. Set preview=true to see changes without applying.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filter": { "type": "object", "properties": { "folder": { "type": "string" }, "glob": { "type": "string" }, "tag": { "type": "string" } } },
      "operation": { "type": "string", "enum": ["replace", "prepend", "append", "rename_tag"] },
      "target": { "type": "string" },
      "replacement": { "type": "string" },
      "preview": { "type": "boolean" }
    },
    "required": ["filter", "operation", "target"]
  }
}
```

```json
{
  "name": "get_vault_stats",
  "description": "Get vault statistics",
  "inputSchema": { "type": "object", "properties": {} }
}
```

```json
{
  "name": "fs_get_graph",
  "description": "Export full vault graph as adjacency list",
  "inputSchema": { "type": "object", "properties": {} }
}
```

```json
{
  "name": "graph_neighbors",
  "description": "Get graph neighbors of a note",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "direction": { "type": "string", "enum": ["both", "in", "out"] }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "graph_analyze_centrality",
  "description": "Calculate PageRank centrality for notes",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    }
  }
}
```

```json
{
  "name": "fs_graph_find_path",
  "description": "Shortest path between two notes via BFS",
  "inputSchema": {
    "type": "object",
    "properties": {
      "from": { "type": "string" },
      "to": { "type": "string" }
    },
    "required": ["from", "to"]
  }
}
```

#### Уровень 2: Мост Obsidian CLI

```json
{
  "name": "cli_eval",
  "description": "Execute JavaScript in Obsidian's context via CLI. Returns result.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "code": { "type": "string", "description": "JavaScript to execute" }
    },
    "required": ["code"]
  }
}
```

```json
{
  "name": "cli_backlinks",
  "description": "Get real backlinks from Obsidian metadataCache (100% accurate).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "cli_orphans",
  "description": "Find all orphan notes (no incoming links) using Obsidian metadataCache.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "folder": { "type": "string", "default": "." }
    }
  }
}
```

```json
{
  "name": "cli_unresolved",
  "description": "Find all unresolved (broken) wikilinks in the vault using Obsidian metadataCache.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "folder": { "type": "string", "default": "." }
    }
  }
}
```

```json
{
  "name": "cli_deadends",
  "description": "Find all dead-end notes (no outgoing links) using Obsidian metadataCache.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "folder": { "type": "string", "default": "." }
    }
  }
}
```

```json
{
  "name": "cli_properties",
  "description": "CRUD operations on Obsidian frontmatter properties via CLI.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string" },
      "action": { "type": "string", "enum": ["read", "set", "remove", "list"], "default": "read" },
      "property": { "type": "string" },
      "value": { "type": "string" }
    },
    "required": ["file", "action"]
  }
}
```

```json
{
  "name": "cli_search",
  "description": "Full-text search via Obsidian CLI (uses Obsidian native search engine).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "context": { "type": "boolean", "default": false }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "cli_daily",
  "description": "Access daily notes: get current daily note, append or prepend content.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": { "type": "string", "enum": ["read", "append", "prepend"], "default": "read" },
      "content": { "type": "string" }
    }
  }
}
```

```json
{
  "name": "cli_command",
  "description": "Execute any Obsidian command palette command by name.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    },
    "required": ["name"]
  }
}
```

```json
{
  "name": "cli_plugin",
  "description": "Manage Obsidian plugins: list enabled, enable, disable, reload, install, uninstall.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": { "type": "string", "enum": ["enable", "disable", "list"] },
      "id": { "type": "string" }
    },
    "required": ["action"]
  }
}
```

#### Уровень 2b: Fallback-мост (REST API / Advanced URI)

```json
{
  "name": "rest_active_note",
  "description": "Get currently open note via Local REST API plugin (fallback when CLI unavailable).",
  "inputSchema": {}
}
```

```json
{
  "name": "rest_dataview",
  "description": "Execute Dataview DQL query via Local REST API or Advanced URI (fallback).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "DQL query string" }
    },
    "required": ["query"]
  }
}
```

#### Уровень 3: Конвейер

```json
{
  "name": "ai_ingest",
  "description": "Ingest a raw note: create structured source note following ontology and protocol.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "raw_path": { "type": "string" },
      "auto_compile": { "type": "boolean", "default": false }
    },
    "required": ["raw_path"]
  }
}
```

```json
{
  "name": "ai_compile",
  "description": "Compile raw notes into concepts (Phase 2). Analyzes raw/ and updates concepts/ + index/MOC.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "since_days": { "type": "integer", "default": 7 },
      "dry_run": { "type": "boolean", "default": false }
    }
  }
}
```

```json
{
  "name": "ai_enrich",
  "description": "Log LLM interaction to sessions/ folder (file-back).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "response": { "type": "string" },
      "suggested_edits": { "type": "array", "items": { "type": "string" } },
      "tags": { "type": "array", "items": { "type": "string" }, "default": ["session"] }
    },
    "required": ["query", "response"]
  }
}
```

```json
{
  "name": "ai_link",
  "description": "Suggest wikilinks for unlinked mentions in a note.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "ai_compile",
  "description": "Generate a Map of Content (MOC) for a given domain.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "domain": { "type": "string", "description": "Domain or topic for the MOC" }
    },
    "required": ["domain"]
  }
}
```

```json
{
  "name": "ai_query",
  "description": "Answer a user query with context from 3–5 related notes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "context_paths": { "type": "array", "items": { "type": "string" }, "description": "Optional: specific notes to use as context" }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "ai_enrich",
  "description": "Suggest improvements for a note after a query.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"]
  }
}
```

```json
{
  "name": "ai_tag",
  "description": "Auto-tag notes based on ontology. Suggests new tags when existing ones don't fit.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Note path to auto-tag" },
      "suggest_new": { "type": "boolean", "default": false, "description": "Allow AI to suggest new tags not in ontology" }
    },
    "required": ["path"]
  }
}
```

#### Уровень 4: Семантический движок

```json
{
  "name": "bm25_search",
  "description": "BM25 full-text search over indexed notes",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "semantic_search",
  "description": "Semantic search via vector embeddings (RRF with BM25)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "semantic_search_db",
  "description": "Semantic search via SQLite FTS5 + persisted embeddings",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "db_stats",
  "description": "Get SQLite semantic database statistics",
  "inputSchema": { "type": "object", "properties": {} }
}
```

```json
{
  "name": "semantic_rag",
  "description": "Retrieve contextual chunks for RAG via semantic search",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "top_k": { "type": "number", "default": 5 }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "build_index",
  "description": "Trigger a full vault reindex",
  "inputSchema": { "type": "object", "properties": {} }
}
```

#### Multi-vault управление

```json
{
  "name": "pool_list_vaults",
  "description": "List all vaults in the pool",
  "inputSchema": { "type": "object", "properties": {} }
}
```

```json
{
  "name": "pool_add_vault",
  "description": "Add a vault to the pool",
  "inputSchema": {
    "type": "object",
    "properties": { "path": { "type": "string" } },
    "required": ["path"]
  }
}
```

```json
{
  "name": "pool_remove_vault",
  "description": "Remove a vault from the pool",
  "inputSchema": {
    "type": "object",
    "properties": { "path": { "type": "string" } },
    "required": ["path"]
  }
}
```

#### Уровень 5: Начальная загрузка контекста

```json
{
  "name": "get_context_bootstrap",
  "description": "Get the vault context bootstrap prompt for LLM sessions",
  "inputSchema": {
    "type": "object",
    "properties": {
      "maxTokens": { "type": "number" }
    }
  }
}
```

#### Инструменты безопасности и аудита

```json
{
  "name": "audit_log",
  "description": "Get recent audit log entries",
  "inputSchema": {
    "type": "object",
    "properties": {
      "event": { "type": "string" },
      "tool": { "type": "string" },
      "limit": { "type": "number" }
    }
  }
}
```

```json
{
  "name": "list_backups",
  "description": "List available backups of vault notes",
  "inputSchema": { "type": "object", "properties": {} }
}
```

```json
{
  "name": "rollback",
  "description": "Rollback a note to a previous backup",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "timestamp": { "type": "string" }
    },
    "required": ["path"]
  }
}
```

#### MABS — Model-Aware Backup System

| Инструмент | Описание | Чтение |
|------------|----------|--------|
| `mabs_list_models` | Список зарегистрированных AI-моделей | ✅ |
| `mabs_set_current_model` | Установить активную модель | ❌ |
| `mabs_snapshot_artifact` | Сохранить артефакт по хешу | ❌ |
| `mabs_list_artifacts` | Список снапшотов артефактов | ✅ |
| `mabs_artifact_history` | История версий артефакта | ✅ |
| `mabs_list_sessions` | Список сессий | ✅ |
| `mabs_can_replay` | Проверить возможность реплея сессии | ✅ |
| `mabs_export_backup` | Экспортировать бэкап | ✅ |
| `mabs_import_backup` | Импортировать бэкап | ❌ |
| `mabs_export_agnostic_bundle` | Экспорт агностичного бандла | ✅ |
| `mabs_import_agnostic_bundle` | Импорт агностичного бандла | ❌ |

#### Dreaming (L9)

| Инструмент | Описание | Чтение |
|------------|----------|--------|
| `dream_scan` | Сканировать хранилище на проблемы (link gaps, merge, prune, synthesize) | ✅ |
| `dream_finalize` | Финализировать сессию dreaming (архивировать выбранные пути) | ❌ |
| `dream_undo` | Отменить финализированную сессию | ❌ |

#### Dev System (L1–L4)

**Prompts (L1):**
| Инструмент | Описание |
|------------|----------|
| `dev_prompt_list` | Список dev prompts |
| `dev_prompt_get` | Получить prompt по ID |
| `dev_prompt_create` | Создать новый prompt |
| `dev_prompt_delete` | Удалить prompt |
| `dev_prompt_execute` | Выполнить prompt с подстановкой переменных |

**Skills (L2):**
| Инструмент | Описание |
|------------|----------|
| `dev_skill_list` | Список dev skills |
| `dev_skill_get` | Получить skill по ID |
| `dev_skill_create` | Создать новый skill |
| `dev_skill_delete` | Удалить skill |
| `dev_skill_execute` | Выполнить skill с контекстом |

**Agents (L3):**
| Инструмент | Описание |
|------------|----------|
| `dev_agent_list` | Список dev agents |
| `dev_agent_get` | Получить agent по ID |
| `dev_agent_create` | Создать новый agent |
| `dev_agent_delete` | Удалить agent |

**Workflows (L4):**
| Инструмент | Описание |
|------------|----------|
| `dev_workflow_list` | Список dev workflows |
| `dev_workflow_get` | Получить workflow по ID |
| `dev_workflow_create` | Создать новый workflow |
| `dev_workflow_delete` | Удалить workflow |
| `dev_workflow_advance` | Перейти workflow к следующей фазе |
| `dev_workflow_fail` | Отметить текущую фазу workflow как failed |

**CLAUDE.md:**
| Инструмент | Описание |
|------------|----------|
| `dev_claude_md_get` | Получить текущее содержимое CLAUDE.md |
| `dev_claude_md_append` | Добавить секцию в CLAUDE.md |

### 6.2. Ресурсы

| URI | Описание | Уровень |
|-----|-------------|-------|
| `vault://meta/ontology.md` | Текущая онтология | L1 |
| `vault://meta/protocol.md` | 4-фазный протокол | L1 |
| `vault://meta/link-rules.md` | Соглашения о ссылках | L1 |
| `vault://meta/templates/{name}.md` | Шаблоны | L1 |
| `vault://structure` | Живая структура папок (JSON) | L1 |
| `vault://graph/full` | Полный список смежности графа | L1/L2 |
| `vault://graph/{path}` | Локальный подграф | L1/L2 |
| `vault://index/moc` | Текущий MOC | L1 |
| `vault://stats` | Статистика хранилища | L1 |
| `vault://tags/all` | Все теги с количеством | L1/L2 |
| `vault://cli/status` | Доступность Obsidian CLI | L2 |
| `vault://plugins/enabled` | Активные плагины (через CLI) | L2 |

### 6.3. Промпты

| URI | Контекст | Задача |
|-----|---------|------|
| `prompt://ingest` | Правила хранилища + сырая заметка | Создать структурированную исходную заметку |
| `prompt://compile` | Правила хранилища + raw/ (N дней) + concepts/ | Синтезировать концепции, минимум 3 викиссылки |
| `prompt://lint` | Правила хранилища + полный граф | Найти проблемы |
| `prompt://query_enhance` | Правила хранилища + 3–5 связанных заметок | Ответить с цитатами [[...]], предложить правки |
| `prompt://create_moc` | Правила хранилища + концепции по домену | Сгенерировать Map of Content |

---

## 7. Нефункциональные требования

| ID | Требование | Целевое значение |
|----|-------------|--------|
| NF1 | **Производительность поиска** — 10K заметок | < 1с |
| NF2 | **Производительность поиска** — 100K заметок (инкрементальный) | < 100мс |
| NF3 | **Построение графа** — 10K заметок | < 5с начальное, < 100мс инкрементальное |
| NF4 | **Задержка команд CLI** | < 500мс для запросов |
| NF5 | **Время плавной деградации** | < 2с на обнаружение и переключение уровня |
| NF6 | **Потолок памяти** | < 512МБ для 10K заметок, < 2ГБ для 100K |
| NF7 | **Параллельные операции чтения** | Неограниченно |
| NF8 | **Параллельные операции записи** | Эксклюзивно на файл |
| NF9 | **Хранение аудит-лога** | 90 дней или 10K записей |
| NF10 | **Бэкап перед записью** | Всегда (конфигурируемо) |
| NF11 | **Хранение мягкого удаления** | 30 дней |
| NF12 | **Обнаружение доступности CLI** | При старте + периодический heartbeat каждые 30с |
| NF13 | **Бюджет токенов начальной загрузки контекста** | Макс 20% от окна контекста |
| NF14 | **Поддержка транспорта** | stdio (по умолчанию) + Streamable HTTP |
| NF15 | **Кроссплатформенность** | macOS, Windows, Linux |

---

## 8. Архитектура данных

### 8.1. Структура хранилища

```
vault-root/
├── raw/                    # Сырые входные данные (статьи, заметки с совещаний)
├── concepts/               # Постоянные заметки (минимум 3 ссылки)
├── index/                  # MOC и индексы
├── sessions/               # Логи взаимодействия с LLM
├── attachments/            # Вложения (изображения, файлы)
└── meta/
    ├── ontology.md         # Контролируемый словарь тегов
    ├── protocol.md         # Правила 4-фазного конвейера
    ├── link-rules.md       # Соглашения о викиссылках
    ├── system-prompt-obsidian.md
    └── templates/
        ├── source.md
        ├── concept.md
        └── session.md
```

### 8.2. Структура кэша

```
.mcp-cache/
├── graph.json              # Список смежности (узлы + рёбра)
├── metadata.json           # Индекс frontmatter (путь → frontmatter)
├── search-index/           # BM25-индекс
├── vector-index/           # FAISS/Chroma (опционально)
├── cli-state.json          # Последний статус CLI, кэшированные orphans/unresolved
└── audit.log               # Все операции записи
```

### 8.3. Схема графового движка

```json
{
  "nodes": {
    "concepts/neural-networks.md": {
      "title": "Neural Networks",
      "tags": ["concept", "ai"],
      "outbound": ["backpropagation", "gradient-descent", "transformers"],
      "inbound": ["concepts/backpropagation.md", "index/MOC-ai.md"]
    }
  },
  "edges": [
    { "from": "concepts/neural-networks.md", "to": "concepts/backpropagation.md", "type": "wikilink" }
  ]
}
```

---

## 9. Статус реализации v2.11.0

### Реализовано ✅

**Уровень 1 — Файловая система (16 инструментов):**
`read_note`, `write_note`, `append_note`, `patch_note`, `delete_note`, `move_note`, `list_directory`, `search_notes`, `get_vault_stats`, `list_all_tags`, `read_file`, `write_file`, `manage_tags`, `validate_note`, `get_vault_rules`, `batch_edit`

**Уровень 2 — CLI Bridge (10 инструментов):**
`cli_backlinks`, `cli_orphans`, `cli_deadends`, `cli_unresolved`, `cli_search`, `cli_eval`, `cli_properties`, `cli_daily`, `cli_command`, `cli_plugin`

**Уровень 2b — REST Bridge (2 инструмента):**
`rest_active_note`, `rest_dataview`

**Уровень 3 — Pipeline (7 AI-агентов):**
`ai_ingest`, `ai_tag`, `ai_query`, `ai_compile`, `ai_link`, `ai_enrich`

**Уровень 4 — Semantic Engine (13 инструментов):**
`bm25_search`, `graph_neighbors`, `graph_analyze_centrality`, `graph_detect_communities`, `build_index`, `semantic_search`, `semantic_search_db`, `db_stats`, `semantic_rag`, `fs_list_notes`, `fs_get_graph`, `fs_graph_find_path`

**Уровень 5 — Bootstrap (1 инструмент):**
`get_context_bootstrap`

**Уровень 6 — Pool (3 инструмента):**
`pool_add_vault`, `pool_remove_vault`, `pool_list_vaults`

**Уровень 7 — Security / Audit (3 инструмента):**
`audit_log`, `list_backups`, `rollback`

**Уровень 8 — Dev System (22 инструмента):**
`dev_prompt_create`, `dev_prompt_delete`, `dev_prompt_execute`, `dev_prompt_list`, `dev_prompt_get`,
`dev_skill_create`, `dev_skill_delete`, `dev_skill_execute`, `dev_skill_list`, `dev_skill_get`,
`dev_agent_create`, `dev_agent_delete`, `dev_agent_list`, `dev_agent_get`,
`dev_workflow_create`, `dev_workflow_delete`, `dev_workflow_advance`, `dev_workflow_fail`, `dev_workflow_list`, `dev_workflow_get`,
`dev_claude_md_append`, `dev_claude_md_get`

**Уровень 9 — Dreaming (3 инструмента):**
`dream_scan`, `dream_finalize`, `dream_undo`

**Итого: 80 MCP-инструментов, 21 класс ошибок, 8 уровней защиты.**

### В разработке / Future 🔵

- **Multi-vault** — `VaultProcessPool`, `VaultRouter`
- **Louvain community detection** — обнаружение сообществ в графе
- **E2E тесты** — автоматизация сценариев SC-01..SC-08
- **HTTP transport** — `MCP_AUTH_TOKEN` готов, ждёт wiring
- **E2xx / E3xx / E5xx / E6xx / E8xx / E9xx** — зарезервированы для v2.3+

---

## 10. Стратегия тестирования

### 10.1. Тестовое хранилище

```
test-vault/
├── raw/
│   ├── 2026-05-20-article-transformers.md
│   ├── 2026-05-21-meeting-notes.md
│   └── 2026-05-22-inbox-thought.md
├── concepts/
│   ├── neural-networks.md
│   ├── backpropagation.md
│   └── attention-mechanism.md
├── index/
│   └── MOC-ai.md
├── sessions/
│   └── 2026-05-20-14-30-hello.md
├── meta/
│   ├── ontology.md
│   ├── protocol.md
│   ├── link-rules.md
│   └── templates/
│       ├── source.md
│       ├── concept.md
│       └── session.md
└── attachments/
    └── images/
```

### 10.2. Тестовые сценарии

| Сценарий | Вход | Ожидаемый результат | Уровень |
|----------|-------|-----------------|-------|
| Ingest | `raw/article-transformers.md` | Создан `concepts/transformers.md` с тегами | L3 |
| Compile links | 5 новых raw-файлов | Обновлён `index/MOC-ai.md` | L3 |
| Backlinks (CLI) | `cli_backlinks("neural-networks")` | 2+ реальных обратных ссылки | L2 |
| Backlinks (FS) | `graph_neighbors("neural-networks")` | 2+ обратных ссылки (regex) | L1 |
| Orphans (CLI) | `cli_orphans()` | 0 сирот | L2 |
| Search | `search_notes("transformer")` | Топ-3 релевантных | L1 |
| Patch | `patch_note("nn.md", "## Section", "X")` | Обновлён только заголовок | L1 |
| Graph | `graph_neighbors("ai", depth=2)` | JSON с узлами и рёбрами | L1 |
| CLI Eval | `cli_eval("app.workspace.getActiveFile().path")` | Текущий путь файла | L2 |
| CLI Dataview | `cli_eval("DataviewAPI.query('TABLE tags FROM #project')")` | DQL-результат | L2 |
| Move + update links | `move_note("old.md", "new.md")` | Перемещён, ссылки обновлены | L1 |
| Semantic | `semantic_search("machine learning")` | Топ-5 похожих заметок | L4 |
| Lint | `dream_scan()` | 0 unresolved, 0 orphans | L3 |
| Session | Query + Response | Создан `sessions/YYYY-MM-DD-*.md` | L3 |
| Context Bootstrap | Старт сессии | Инжектированы Ontology + protocol | L5 |

### 10.3. Уровни тестирования

- **Unit:** Отдельные обработчики инструментов, парсеры, алгоритмы графа
- **Integration:** Маршрутизация Диспетчера, fallback уровней, файловые операции
- **E2E:** Полный конвейер (ingest → compile → query → lint) на тестовом хранилище
- **Performance:** Синтетические хранилища на 10K и 100K заметок
- **Compatibility:** macOS, Windows, Linux; с и без Obsidian CLI

---

## 11. CI/CD и интеграция с GitHub

### 11.1. Структура репозитория

```
obsidian-extended-mcp/
├── src/
│   ├── layer1/           # Ядро файловой системы
│   ├── layer2/           # Мост CLI
│   ├── layer2b/          # REST fallback
│   ├── layer3/           # Конвейер
│   ├── layer4/           # Семантический движок
│   ├── layer5/           # Начальная загрузка контекста

│   ├── shared/           # Графовый движок, движок тегов, аудит-логгер
│   ├── dispatcher.ts     # Роутер
│   └── server.ts         # Точка входа MCP-сервера
├── tests/
│   ├── fixtures/         # Тестовое хранилище
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── cli-bridge.md
│   ├── pipeline.md
│   └── security.md
├── .github/
│   ├── workflows/
│   │   ├── ci.yml        # Тесты + Линт
│   │   ├── release.yml   # npm publish + GitHub Release
│   │   └── npm.yml       # Публикация в npm
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── scripts/
│   └── setup-obsidian-cli.sh

├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

### 11.2. GitHub Actions Workflows

**CI (`ci.yml`):**
```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [22, 24]   # Минимальная поддерживаемая версия — Node.js 22+
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run build
```

**Release (`release.yml`):**
```yaml
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
```



### 11.3. Шаблоны задач

**Bug Report:**
- Затронутый уровень (1–6)
- Версия Obsidian / Доступность CLI
- Минимальные шаги воспроизведения
- Ожидаемое vs фактическое поведение
- Логи (с `DEBUG=obsidian-mcp:*`)

**Feature Request:**
- Целевой уровень
- Описание use case
- Предлагаемая схема инструмента/ресурса/промпта
- Рассмотренные альтернативы

### 11.4. Руководство по участию

1. Форкнуть репозиторий
2. Создать feature-ветку (`git checkout -b feature/layer-X-description`)
3. Добавить тесты для новой функциональности
4. Убедиться, что все тесты проходят (`npm test`)
5. Обновить документацию
6. Отправить PR с заполненным шаблоном

---

## 12. Модель безопасности

### 12.1. Уровни одобрения

| Уровень | Действие | Требуется |
|-------|--------|----------|
| 1 | Операции чтения | Ничего |
| 2 | Запись в `raw/`, `sessions/` | Ничего (безопасные зоны) |
| 3 | Запись в `concepts/`, `index/` | Подтверждение пользователя |
| 4 | Удаление, перемещение, пакетное редактирование | Подтверждение пользователя |
| 5 | CLI eval (произвольный JS) | Явное opt-in + песочница |
| 6 | Установка/удаление плагинов | Явное opt-in |

### 12.2. Защита данных

- Все записи атомарны (tmp + rename)
- Автоматические бэкапы перед перезаписью
- Мягкое удаление вместо жёсткого (по умолчанию)
- Аудит-лог всех мутаций
- Данные не покидают локальную машину (если не используется внешний LLM API)

### 12.3. Песочница CLI Eval

```javascript
// Whitelist approach for cli_eval
const ALLOWED_GLOBALS = ['app', 'DataviewAPI', 'moment'];
const FORBIDDEN_PATTERNS = [/require\s*\(/, /fs\s*\./, /child_process/];

function validateEval(code) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) throw new SecurityError('Forbidden pattern detected');
  }
  return true;
}
```

---

## 13. Приложения

### Приложение A: Контракт онтологии (`meta/ontology.md`)

```markdown
---
title: Vault Ontology
version: 1.0
---

## Allowed Tags
| Tag | Purpose | Folder | Rules |
|-----|---------|--------|-------|
| #raw | Raw material | raw/ | Auto on ingest |
| #source | Source | raw/ | If URL/author present |
| #concept | Permanent note | concepts/ | After compile |
| #project | Project | projects/ | If deadline |
| #moc | Index | index/ | For hubs |
| #session | Dialog log | sessions/ | Auto |
| #person | Person | people/ | Contact info |
| #tool | Tool/software | tools/ | With usage notes |

## Status Tags
| Tag | Meaning |
|-----|---------|
| #evergreen | Permanent, maintained |
| #draft | Work in progress |
| #seedling | New idea, may grow |
| #archived | No longer relevant |

## Tag Creation Rules
1. New tags ONLY via PR to ontology.md
2. LLM cannot create tags outside the list
3. Hierarchy via prefixes: #ai-ml, #ai-nlp

## Folder Rules
- Folder created when ≥3 notes of same type
- Name = plural of tag
- raw/ accepts anything
- concepts/ requires ≥3 wikilinks
- index/ requires ≥5 links, auto-updated
```

### Приложение B: Контракт протокола (`meta/protocol.md`)

```markdown
---
title: Obsidian Agent Protocol
method: Karpathy LLM Knowledge Bases
---

## Phase 1: Ingest
- Read raw/YYYY-MM-DD-*.md
- Create structured source with frontmatter
- Tags: [source, #topic]
- Extract: 3 key ideas, 2 open questions

## Phase 2: Compile
- Analyze raw/ for N days
- For each idea:
  1. Check concepts/ for duplicates
  2. Create or update concept
  3. Minimum 3 [[wikilinks]]
  4. Update index/MOC.md

## Phase 3: Query & Enhance
- Gather context: 3–5 related notes
- Answer with citations [[...]]
- End with: suggested_edits
- Save session to sessions/

## Phase 4: Lint & Maintain
- Broken links
- Orphan notes
- Duplicate titles
- Invalid tags
- Stale MOCs
```

### Приложение C: IPC-протокол моста CLI

**Структура команды:**
```bash
obsidian eval "JSON.stringify(app.metadataCache.getBacklinks('note-name'))"
```

**Парсинг вывода:**
1. Попытка JSON.parse(stdout) — основной
2. Если не удалось, попытка JSON.parse после извлечения первого `{...}` или `[...]`
3. Если не удалось, возврат raw text с флагом `parsed: false`

**Коды ошибок:**
| Код | Значение | Действие |
|------|---------|--------|
| `ENOENT` | CLI не найден | Пометить недоступным, fallback на REST/ФС |
| `ECONNREFUSED` | Obsidian не запущен | Retry с бэкофф, затем fallback |
| `TIMEOUT` | Команда превысила лимит | Возврат частичного результата или ошибки |
| `JSON_PARSE_ERROR` | Вывод не является валидным JSON | Возврат plain text |

**Матрица таймаутов:**
| Тип команды | Таймаут |
|--------------|---------|
| Query (backlinks, orphans) | 5с |
| Eval (простой JS) | 10с |
| Search | 15с |
| Batch (compile, lint) | 60с |


### Приложение D: Стек технологий

| Компонент | Технология | Обоснование |
|-----------|-----------|-----------|
| **Runtime** | Node.js 22+ | MCP SDK нативный, базовый mcpvault |
| **Language** | TypeScript | Типобезопасность, экосистема |
| **MCP SDK** | `@modelcontextprotocol/sdk` | Официальный |
| **Transport** | stdio + Streamable HTTP | Универсальная совместимость |
| **Search** | BM25 (custom) + ripgrep | Быстро, без зависимостей |
| **Graph** | Custom adjacency list | Просто, быстро, сериализуемо |
| **Embeddings** | transformers.js / Ollama | Локально, приватно |

| **Testing** | Jest | Стандарт для TS |
| **Linting** | ESLint + Prettier | Качество кода |
| **CI/CD** | GitHub Actions | Нативная интеграция с GitHub |
| **Distribution** | npm (Node.js 22+) | Глобальная установка |

### Приложение E: Сравнение с существующими решениями

| Параметр | mcpvault (baseline) | obsidian-brain | cyanheads | **Extended MCP** |
|-----------|---------------------|----------------|-----------|------------------|
| Language | TypeScript | TypeScript | TypeScript | TypeScript |
| Transport | stdio | stdio | stdio | **stdio + HTTP** |
| Obsidian dependency | None | Requires plugin | Requires plugin | **Opt-in (CLI)** |
| Real backlinks | No | Via plugin | Via plugin | **Yes (CLI)** |
| Graph analytics | No | Basic | Advanced | **PageRank + Louvain** |
| Semantic search | No | Yes | Yes | **Yes (RRF fusion)** |
| Karthy pipeline | No | No | No | **Yes (4 phases)** |
| Context bootstrap | No | No | No | **Yes (auto-inject)** |
| File types | Markdown | Markdown | Markdown | **10+ types** |
| Graceful degradation | N/A | No | No | **CLI → REST → FS** |
| OSS License | MIT | MIT | MIT | **MIT** |

### Приложение F: Критерии успеха

| Критерий | Минимум | Цель |
|-----------|---------|--------|
| Время ingest | < 5с | < 1с |
| Compile (100 raw) | < 30с | < 10с |
| Время ответа на запрос | < 5с | < 2с |
| Backlinks (CLI) | 100% | 100% |
| Backlinks (FS) | > 90% | > 95% |
| Обнаружение сирот | 0 ложных срабатываний | 0 ложных срабатываний |
| Точность lint | > 90% | > 95% |
| Размер хранилища | 10K заметок | 100K заметок |
| Uptime | 99% | 99.9% |

---

*Спецификация составлена на основе аудита 52 реализаций MCP, официальной документации Obsidian CLI и методологии Karpathy LLM Knowledge Base.*

*Базовая реализация: @bitbonsai/mcpvault v0.11.2*
