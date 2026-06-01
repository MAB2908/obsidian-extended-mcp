# 📖 Пошаговая инструкция по установке и настройке Obsidian Extended MCP v0.1b

> **Целевое время:** 15–20 минут  
> **Сложность:** Средняя (требуется базовое знание CLI)  
> **Платформы:** Windows, macOS, Linux

---

## Содержание

1. [Системные требования](#1-системные-требования)
2. [Способы установки](#2-способы-установки)
3. [Настройка LLM-провайдера](#3-настройка-llm-провайдера)
4. [Настройка окружения (.env)](#4-настройка-окружения-env)
5. [Настройка YAML-конфигурации](#5-настройка-yaml-конфигурации)
6. [Подготовка хранилища Obsidian](#6-подготовка-хранилища-obsidian)
7. [Настройка MCP-клиента](#7-настройка-mcp-клиента)
8. [Проверка работоспособности](#8-проверка-работоспособности)
9. [Настройка безопасности](#9-настройка-безопасности)
10. [Расширенная конфигурация](#10-расширенная-конфигурация)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Системные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| **Node.js** | 20.x | 22.x LTS |
| **ОЗУ** | 4 GB | 8 GB+ |
| **Диск** | 500 MB | 2 GB+ (для семантического индекса) |
| **ОС** | Windows 10+, macOS 13+, Ubuntu 22.04+ | Актуальная версия |
| **Obsidian** | Любая версия | Последняя |

### Проверка Node.js

```bash
node --version    # Должно быть v20+ или v22+
npm --version     # Должно быть v10+
```

Если Node.js не установлен, скачайте с [nodejs.org](https://nodejs.org/) или используйте менеджер версий:

```bash
# Windows (chocolatey)
choco install nodejs

# macOS (homebrew)
brew install node@22

# Linux (nvm — рекомендуется)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 22
nvm use 22
```

---

## 2. Способы установки

### Способ A: Глобальная установка через npm (рекомендуется)

```bash
npm install -g obsidian-extended-mcp
```

После установки бинарник доступен как:
```bash
obsidian-mcp --version    # 0.1b
```

### Способ B: Локальная установка в проекте

```bash
mkdir my-obsidian-mcp
cd my-obsidian-mcp
npm init -y
npm install obsidian-extended-mcp
```

Запуск через npx:
```bash
npx obsidian-mcp
```

### Способ C: Запуск без установки (через npx)

```bash
npx obsidian-extended-mcp --path /path/to/your/vault
```

### Способ D: Сборка из исходников (для разработки)

```bash
git clone <repository-url> obsidian-extended-mcp
cd obsidian-extended-mcp
npm install
npm run build          # Компиляция TypeScript → dist/
npm test               # Запуск тестов (292 шт.)
```

---

## 3. Настройка LLM-провайдера

Obsidian Extended MCP требует хотя бы одного LLM-провайдера. Поддерживаются три варианта:

### 3.1. OpenAI (рекомендуется для качества)

1. Получите API ключ на [platform.openai.com](https://platform.openai.com/api-keys)
2. Сохраните ключ — он понадобится на шаге 4

**Модели:**
- `gpt-4o` — лучшее качество
- `gpt-4o-mini` — баланс цена/качество (рекомендуется)
- `gpt-3.5-turbo` — экономичный вариант

### 3.2. Anthropic Claude

1. Получите API ключ на [console.anthropic.com](https://console.anthropic.com/)
2. Сохраните ключ

**Модели:**
- `claude-3-opus-20240229` — максимальное качество
- `claude-3-sonnet-20240229` — баланс
- `claude-3-haiku-20240307` — быстрый и дешёвый

### 3.3. Ollama (локальный, бесплатный)

1. Установите Ollama: [ollama.com/download](https://ollama.com/download)
2. Запустите сервер:

```bash
ollama serve           # Запуск API-сервера
# В другом терминале:
ollama pull llama3.1   # Основная модель
ollama pull nomic-embed-text  # Модель для эмбеддингов
```

3. Проверьте доступность:
```bash
curl http://localhost:11434/api/tags
```

**Преимущества Ollama:**
- Полная приватность (данные не покидают компьютер)
- Бесплатно
- Работает offline

**Недостатки:**
- Требует мощной видеокарты для скорости
- Качество ниже коммерческих API

### 3.4. Гибридный подход (рекомендуется для продакшена)

```env
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

**Принцип:**
- Лёгкие задачи (tag, link) → Ollama (быстро, бесплатно)
- Сложные задачи (compile, query) → GPT-4/Claude (качественно)

---

## 4. Настройка окружения (.env)

Создайте файл `.env` в рабочей директории (там, откуда запускаете MCP):

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

### 4.1. Минимальная конфигурация (обязательные параметры)

```env
# === Путь к хранилищу ===
OBSIDIAN_VAULT_PATH=/Users/you/Documents/Obsidian Vault
# Windows: C:\Users\you\Documents\Obsidian Vault

# === LLM Provider (выберите один) ===
# Вариант 1: OpenAI
OPENAI_API_KEY=sk-your-key-here
DEFAULT_LLM_PROVIDER=openai

# Вариант 2: Anthropic
# ANTHROPIC_API_KEY=sk-ant-your-key-here
# DEFAULT_LLM_PROVIDER=anthropic

# Вариант 3: Ollama
# OLLAMA_BASE_URL=http://localhost:11434
# DEFAULT_LLM_PROVIDER=ollama
```

### 4.2. Полная конфигурация (все параметры)

```env
# ─── Obsidian vault path ───
OBSIDIAN_VAULT_PATH=./vault

# ─── LLM Provider configuration ───
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-haiku-20240307

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBED_MODEL=nomic-embed-text

DEFAULT_LLM_PROVIDER=openai

# ─── LLM cache & retry tuning ───
LLM_MAX_CACHE_SIZE=1000
LLM_CACHE_TTL_MS=3600000
LLM_MAX_RETRIES=3
LLM_RETRY_BASE_DELAY_MS=1000

# ─── Semantic search ───
SEMANTIC_ENABLED=false
EMBED_MODEL=text-embedding-3-small

# BM25 / Graph / Search tuning
BM25_K1=1.5
BM25_B=0.75
BM25_DEFAULT_LIMIT=50
RRF_K=60
GRAPH_PAGERANK_ITERATIONS=20
GRAPH_PAGERANK_DAMPING=0.85
GRAPH_COMMUNITY_MAX_PASSES=10
GRAPH_PATH_MAX_DEPTH=5
INDEXER_DEBOUNCE_MS=2000
SEMANTIC_SEARCH_LIMIT=20
SEMANTIC_RAG_TOP_K=5

# ─── Filesystem tuning ───
FS_TRASH_DIR=.trash
FS_BACKUP_DIR=.mcp-cache/backups
FS_MAX_BACKUPS=20
FILE_TEXT_EXTENSIONS=md,txt

# ─── Obsidian CLI path (optional) ───
OBSIDIAN_CLI_PATH=

# ─── Local REST API ───
REST_API_URL=http://localhost:27123
REST_API_TOKEN=

# ─── Transport security ───
MCP_AUTH_TOKEN=

# ─── Multi-vault mode ───
MULTI_VAULT=false

# ─── Ontology enforcement ───
ENFORCE_ONTOLOGY=false

# ─── Operation policies ───
READ_ONLY=false
ENABLE_COMMANDS=true
ENABLE_EVAL=false
ENABLE_BATCH_EDIT=true
ENABLE_DELETE=true

# ─── Sandbox ───
SANDBOX_TIMEOUT_MS=5000
SANDBOX_ALLOWED_GLOBALS=app,DataviewAPI,moment,MetadataCache

# ─── Audit logging ───
AUDIT_FORMAT=jsonl
AUDIT_MAX_AGE_DAYS=30
AUDIT_BATCH_SIZE=100
AUDIT_FLUSH_INTERVAL_MS=5000
AUDIT_ROTATION_MB=10

# ─── Folder policies ───
SAFE_ZONES=raw/,sessions/
WRITE_PATHS=*
FORBIDDEN_PATHS=.git/,.obsidian/,.trash/

# ─── Approval mode: auto | interactive | strict ───
APPROVAL_MODE=auto

# ─── Pipeline tuning ───
PIPELINE_COMPILE_SINCE_DAYS=30
PIPELINE_MOC_AGE_DAYS=90
PIPELINE_MIN_CONFIDENCE=0.7
PIPELINE_SEEDLING_MAX_AGE_DAYS=90

# ─── Config file path (optional) ───
MCP_CONFIG_PATH=
```

### 4.3. Использование wizard

```bash
npx obsidian-mcp init-llm
```

Wizard создаст/обновит `.env` с дефолтными значениями. Отредактируйте файл, заменив `your-key-here` на реальные ключи.

---

## 5. Настройка YAML-конфигурации

В дополнение к `.env` можно использовать `mcp-config.yaml` для структурированной конфигурации. Переменные окружения имеют приоритет над YAML.

### 5.1. Создание mcp-config.yaml

```bash
cp mcp-config.yaml /path/to/your/config.yaml
```

### 5.2. Пример конфигурации

```yaml
server:
  vaultPath: /Users/you/Documents/Obsidian Vault
  multiVault: false
  authToken: ''
  enforceOntology: false

llm:
  defaultProvider: openai
  openAiKey: sk-your-key
  openAiModel: gpt-4o-mini
  anthropicKey: ''
  anthropicModel: ''
  ollamaBaseUrl: http://localhost:11434
  ollamaModel: llama3.1
  maxCacheSize: 1000
  cacheTtlMs: 3600000
  maxRetries: 3
  retryBaseDelayMs: 1000

semantic:
  enabled: false
  embedModel: text-embedding-3-small
  ollamaEmbedModel: nomic-embed-text
  bm25K1: 1.5
  bm25B: 0.75
  bm25DefaultLimit: 50
  rrfK: 60
  pageRankIterations: 20
  pageRankDamping: 0.85
  communityMaxPasses: 10
  pathMaxDepth: 5
  indexerDebounceMs: 2000
  semanticSearchLimit: 20
  semanticRagTopK: 5

security:
  approvalMode: auto
  readOnly: false
  enableCommands: true
  enableEval: false
  enableBatchEdit: true
  enableDelete: true
  safeZones:
    - raw/
    - sessions/
  writePaths:
    - '*'
  forbiddenPaths:
    - .git/
    - .obsidian/
    - .trash/
  sandboxTimeoutMs: 5000
  sandboxAllowedGlobals:
    - app
    - DataviewAPI
    - moment
    - MetadataCache
  auditFormat: jsonl
  auditMaxAgeDays: 30
  auditBatchSize: 100
  auditFlushIntervalMs: 5000
  auditRotationMb: 10

bridge:
  obsidianCliPath: ''
  restApiUrl: http://localhost:27123
  restApiToken: ''

pipeline:
  compileSinceDays: 7
  mocAgeDays: 30
  minConfidence: 0.7
  seedlingMaxAgeDays: 90

fs:
  trashDir: .trash
  backupDir: .mcp-cache/backups
  maxBackups: 20

fileType:
  textExtensions:
    - .md
    - .txt
    - .json
    - .canvas
    - .svg
    - .css
    - .js
    - .ts
    - .html
    - .xml
    - .yaml
    - .yml
```

### 5.3. Указание пути к конфигу

```bash
# Через env
MCP_CONFIG_PATH=/path/to/config.yaml npx obsidian-mcp

# Или в .env
MCP_CONFIG_PATH=/path/to/config.yaml
```

---

## 6. Подготовка хранилища Obsidian

### 6.1. Инициализация meta-структуры (рекомендуется)

MCP ожидает определённую структуру папок и meta-файлы для контекста LLM.

```bash
npx obsidian-mcp init-meta --path "/path/to/your/vault"
```

Эта команда создаст:

```
vault/
├── meta/
│   ├── ontology.md      # Онтология хранилища
│   ├── protocol.md      # Протокол работы
│   └── link-rules.md    # Правила ссылок
├── raw/                 # Сырые входные данные
├── source/              # Структурированные источники
├── concepts/            # Атомарные концепции
└── moc/                 # Maps of Content
```

### 6.2. Ручное создание (альтернатива)

Если хотите настроить структуру самостоятельно:

```bash
mkdir -p /path/to/vault/{meta,raw,source,concepts,moc}
```

Создайте файлы онтологии, протокола и правил ссылок в `meta/` (см. примеры в `docs/QUICKSTART.md`).

### 6.3. Проверка хранилища

```bash
npx obsidian-mcp check --path "/path/to/your/vault"
```

Ожидаемый вывод:
```
Vault check results:
  Path: /Users/you/Documents/Obsidian Vault
  Notes: 127
  Folders: 42
  Tags: 15
  Links: 340
✅ Vault looks healthy
```

---

## 7. Настройка MCP-клиента

### 7.1. Claude Desktop

Файл: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)  
или `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "obsidian-extended-mcp",
        "--path",
        "/Users/you/Documents/Obsidian Vault"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-your-key",
        "DEFAULT_LLM_PROVIDER": "openai"
      }
    }
  }
}
```

**С использованием .env:**
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["obsidian-extended-mcp"]
    }
  }
}
```

При этом `.env` должен лежать в рабочей директории Claude Desktop.

### 7.2. Kimi CLI

Файл: `~/.kimi/mcp-config.json`

```json
{
  "obsidian": {
    "command": "npx",
    "args": ["obsidian-extended-mcp", "--path", "/path/to/vault"],
    "env": {
      "OPENAI_API_KEY": "sk-your-key"
    }
  }
}
```

### 7.3. Cursor

Файл: `~/.cursor/mcp.json`

```json
{
  "mcpServers": [
    {
      "name": "obsidian",
      "command": "npx",
      "args": ["obsidian-extended-mcp", "--path", "/path/to/vault"]
    }
  ]
}
```

### 7.4. VS Code (Cline / Roo Code)

Файл настроек расширения → MCP Servers:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["obsidian-extended-mcp"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/vault",
        "OPENAI_API_KEY": "sk-your-key"
      }
    }
  }
}
```

### 7.5. Ручной запуск (для отладки)

```bash
# С .env в текущей директории
npx obsidian-extended-mcp

# С явными параметрами
OBSIDIAN_VAULT_PATH=/path/to/vault \
OPENAI_API_KEY=sk-... \
npx obsidian-extended-mcp
```

---

## 8. Проверка работоспособности

### 8.1. Проверка MCP-сервера

После настройки клиента перезапустите его. В интерфейсе должны появиться инструменты Obsidian.

### 8.2. Тестовые запросы

**Тест 1: Чтение заметки**
```
Прочитай заметку "README" из моего хранилища
```

**Тест 2: Поиск**
```
Найди заметки про машинное обучение
```

**Тест 3: Граф**
```
Покажи соседей заметки "Neural Networks"
```

**Тест 4: AI Pipeline (если настроен LLM)**
```
Переработай мои сырые заметки из папки raw/
```

### 8.3. Проверка логов

```bash
# Логи аудита
ls /path/to/vault/.mcp-cache/audit.log

# Логи индекса
ls /path/to/vault/.mcp-cache/
```

---

## 9. Настройка безопасности

### 9.1. Уровни защиты

| Уровень | Конфигурация | Описание |
|---------|--------------|----------|
| **Базовый** | `READ_ONLY=false`, `ENABLE_EVAL=false` | Только файловые операции + поиск |
| **Продвинутый** | + `MCP_AUTH_TOKEN=secret` | Транспортная авторизация |
| **Строгий** | + `APPROVAL_MODE=strict` | Каждая операция требует подтверждения |
| **Максимальный** | + `ENFORCE_ONTOLOGY=true` | Блокировка записей, нарушающих онтологию |

### 9.2. Безопасная конфигурация (для публичных серверов)

```env
# Отключить опасные операции
ENABLE_EVAL=false
ENABLE_COMMANDS=false
ENABLE_BATCH_EDIT=false
ENABLE_DELETE=false

# Включить авторизацию
MCP_AUTH_TOKEN=your-secure-random-token

# Строгий режим подтверждения
APPROVAL_MODE=strict

# Только чтение (если не нужны записи)
READ_ONLY=true

# Ограничить записываемые пути
WRITE_PATHS=raw/,sessions/,concepts/

# Запретить системные папки
FORBIDDEN_PATHS=.git/,.obsidian/,.trash/,meta/

# Включить аудит
AUDIT_FORMAT=jsonl
AUDIT_MAX_AGE_DAYS=90
```

### 9.3. Песочница (cli_eval)

`cli_eval` позволяет выполнять JavaScript в контексте Obsidian. **Отключен по умолчанию.**

```env
# Включить только если нужен доступ к Dataview и плагинам
ENABLE_EVAL=true
SANDBOX_TIMEOUT_MS=5000
SANDBOX_ALLOWED_GLOBALS=app,DataviewAPI,moment,MetadataCache
```

**Внимание:** Даже при включении код выполняется в sandbox с:
- shallow-clone глобальных объектов
- Object.freeze
- 100KB лимит на код
- 5 секунд таймаут

---

## 10. Расширенная конфигурация

### 10.1. Мульти-хранилище (Multi-Vault)

```env
MULTI_VAULT=true
```

При включении можно работать с несколькими хранилищами:
```
Используй хранилище "work" и найди заметки про проект X
```

### 10.2. Семантический поиск

```env
SEMANTIC_ENABLED=true
EMBED_MODEL=text-embedding-3-small
```

**Требования:**
- Для OpenAI: действующий API key
- Для Ollama: `ollama pull nomic-embed-text`

**Проверка:**
```
Найди семантически похожие заметки на "нейронные сети"
```

### 10.3. Obsidian CLI Bridge (опционально)

Для доступа к командам Obsidian (backlinks, orphans и т.д.):

1. Установите [obsidian-cli](https://github.com/Yakitrak/obsidian-cli)
2. Укажите путь:

```env
OBSIDIAN_CLI_PATH=/usr/local/bin/obsidian-cli
```

### 10.4. Local REST API Bridge (опционально)

Для доступа к активной заметке и Dataview:

1. Установите плагин [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) в Obsidian
2. Включите плагин и скопируйте API ключ
3. Настройте:

```env
REST_API_URL=http://localhost:27123
REST_API_TOKEN=your-rest-api-token
```

### 10.5. Настройка онтологии

Файл `meta/ontology.md`:

```markdown
---
ontology: true
---
# Vault Ontology

## Folders
- raw/ → unprocessed notes
- source/ → structured sources
- concepts/ → atomic concepts
- moc/ → maps of content

## Rules
- Use #status/draft for unfinished notes
- Use #status/final for reviewed notes
- concepts/ requires minimum 3 outbound links
```

Включите проверку:
```env
ENFORCE_ONTOLOGY=true
```

---

## 11. Troubleshooting

### Проблема: `MODULE_NOT_FOUND` при запуске

**Решение:**
```bash
npm install -g obsidian-extended-mcp
# или
npm install obsidian-extended-mcp
```

### Проблема: `Vault not found`

**Решение:**
```bash
# Проверьте путь
ls "/path/to/your/vault"

# Убедитесь, что путь указан правильно в .env
cat .env | grep OBSIDIAN_VAULT_PATH

# Или передайте явно
npx obsidian-mcp --path /correct/path
```

### Проблема: `LLM Adapter: no providers configured`

**Решение:**
```bash
# Проверьте .env
cat .env | grep -E "OPENAI|ANTHROPIC|OLLAMA"

# Запустите wizard
npx obsidian-mcp init-llm
```

### Проблема: `Ollama connection refused`

**Решение:**
```bash
# Запустите Ollama
ollama serve

# Проверьте доступность
curl http://localhost:11434/api/tags
```

### Проблема: `Search returns 0 results`

**Решение:**
```bash
# Убедитесь, что заметки в .md
ls /path/to/vault/*.md

# Проверьте права на чтение
ls -la /path/to/vault

# Переиндексируйте
npx obsidian-mcp check --path /path/to/vault
```

### Проблема: `Permission denied` на запись

**Решение:**
```bash
# Проверьте READ_ONLY
cat .env | grep READ_ONLY

# Проверьте WRITE_PATHS
cat .env | grep WRITE_PATHS

# Проверьте права на папку
chmod 755 /path/to/vault
```

### Проблема: `meta/ontology.md not found`

**Решение:**
```bash
npx obsidian-mcp init-meta --path /path/to/vault
```

### Проблема: Claude Desktop не видит инструменты

**Решение:**
1. Перезапустите Claude Desktop
2. Проверьте путь к config:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. Проверьте JSON на валидность: `python -m json.tool claude_desktop_config.json`
4. Посмотрите логи Claude: `~/.claude/logs/`

### Проблема: `AuthTransportWrapper` / `Unauthorized`

**Решение:**
```bash
# Проверьте токен
cat .env | grep MCP_AUTH_TOKEN

# Или отключите авторизацию
MCP_AUTH_TOKEN=
```

### Проблема: Batch edit не работает

**Решение:**
```bash
# Включите в .env
ENABLE_BATCH_EDIT=true
```

### Проблема: `cli_eval` не доступен

**Решение:**
```bash
# Включите (осторожно!)
ENABLE_EVAL=true
```

### Проблема: Семантический поиск медленный

**Решение:**
```bash
# Уменьшите лимиты
SEMANTIC_SEARCH_LIMIT=10
BM25_DEFAULT_LIMIT=20

# Или используйте Ollama для эмбеддингов
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

## Приложение A: Полный список env-переменных

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `OBSIDIAN_VAULT_PATH` | `./vault` | Путь к хранилищу |
| `OPENAI_API_KEY` | — | OpenAI API ключ |
| `OPENAI_MODEL` | `gpt-4o-mini` | Модель OpenAI |
| `ANTHROPIC_API_KEY` | — | Anthropic API ключ |
| `ANTHROPIC_MODEL` | `claude-3-haiku-20240307` | Модель Anthropic |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `llama3.1` | Модель Ollama |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Модель для эмбеддингов |
| `DEFAULT_LLM_PROVIDER` | `openai` | Провайдер по умолчанию |
| `SEMANTIC_ENABLED` | `false` | Включить семантический поиск |
| `EMBED_MODEL` | `text-embedding-3-small` | Модель эмбеддингов |
| `MCP_AUTH_TOKEN` | — | Токен авторизации |
| `MULTI_VAULT` | `false` | Мульти-хранилище |
| `ENFORCE_ONTOLOGY` | `false` | Проверка онтологии |
| `READ_ONLY` | `false` | Режим только чтения |
| `ENABLE_COMMANDS` | `true` | Команды Obsidian |
| `ENABLE_EVAL` | `false` | JavaScript eval |
| `ENABLE_BATCH_EDIT` | `true` | Batch edit |
| `ENABLE_DELETE` | `true` | Удаление заметок |
| `APPROVAL_MODE` | `auto` | Режим подтверждения |
| `SAFE_ZONES` | `raw/,sessions/` | Безопасные зоны |
| `WRITE_PATHS` | `*` | Разрешённые пути записи |
| `FORBIDDEN_PATHS` | `.git/,.obsidian/,.trash/` | Запрещённые пути |
| `REST_API_URL` | `http://localhost:27123` | Local REST API URL |
| `REST_API_TOKEN` | — | REST API токен |
| `OBSIDIAN_CLI_PATH` | — | Путь к obsidian-cli |
| `MCP_CONFIG_PATH` | — | Путь к YAML-конфигу |
| `LLM_MAX_CACHE_SIZE` | `1000` | Размер кэша LLM |
| `LLM_CACHE_TTL_MS` | `3600000` | TTL кэша |
| `LLM_MAX_RETRIES` | `3` | Попыток retry |
| `LLM_RETRY_BASE_DELAY_MS` | `1000` | Базовая задержка retry |
| `BM25_K1` | `1.5` | BM25 параметр K1 |
| `BM25_B` | `0.75` | BM25 параметр B |
| `BM25_DEFAULT_LIMIT` | `50` | Лимит BM25 |
| `RRF_K` | `60` | RRF константа |
| `GRAPH_PAGERANK_ITERATIONS` | `20` | Итераций PageRank |
| `GRAPH_PAGERANK_DAMPING` | `0.85` | Damping PageRank |
| `GRAPH_COMMUNITY_MAX_PASSES` | `10` | Проходов community detection |
| `GRAPH_PATH_MAX_DEPTH` | `5` | Глубина BFS |
| `INDEXER_DEBOUNCE_MS` | `2000` | Debounce индексатора |
| `SEMANTIC_SEARCH_LIMIT` | `20` | Лимит семантического поиска |
| `SEMANTIC_RAG_TOP_K` | `5` | Top-K для RAG |
| `TOPIC_LOADER_BATCH_SIZE` | `10` | Batch size topic loader |
| `SANDBOX_TIMEOUT_MS` | `5000` | Таймаут sandbox |
| `SANDBOX_ALLOWED_GLOBALS` | `app,DataviewAPI,moment,MetadataCache` | Разрешённые глобалы |
| `AUDIT_FORMAT` | `jsonl` | Формат аудита |
| `AUDIT_MAX_AGE_DAYS` | `30` | Время хранения аудита |
| `AUDIT_BATCH_SIZE` | `100` | Размер batch аудита |
| `AUDIT_FLUSH_INTERVAL_MS` | `5000` | Интервал flush аудита |
| `AUDIT_ROTATION_MB` | `10` | Ротация аудита (MB) |
| `PIPELINE_COMPILE_SINCE_DAYS` | `30` | Дней для compile |
| `PIPELINE_MOC_AGE_DAYS` | `90` | Дней для MOC |
| `PIPELINE_MIN_CONFIDENCE` | `0.7` | Минимальная уверенность |
| `PIPELINE_SEEDLING_MAX_AGE_DAYS` | `90` | Макс. возраст seedling |
| `FS_TRASH_DIR` | `.trash` | Папка корзины |
| `FS_BACKUP_DIR` | `.mcp-cache/backups` | Папка бэкапов |
| `FS_MAX_BACKUPS` | `20` | Макс. бэкапов |
| `FILE_TEXT_EXTENSIONS` | `md,txt` | Текстовые расширения |

---

## Приложение B: CLI-команды

```bash
obsidian-mcp --version              # Версия
obsidian-mcp init-meta --path ./vault   # Инициализация meta-структуры
obsidian-mcp check --path ./vault       # Проверка хранилища
obsidian-mcp init-llm               # Wizard настройки LLM
obsidian-mcp rollback --file note.md --to last   # Откат к бэкапу
```

---

## Приложение C: Структура проекта

```
obsidian-extended-mcp/
├── src/
│   ├── layers/
│   │   ├── L1-filesystem/      # VaultManager, FileLock, VaultPool
│   │   ├── L2-cli-bridge/      # CliBridge
│   │   ├── L2b-rest/           # RestBridge
│   │   ├── L3-pipeline/        # PipelineOrchestrator, Dispatcher
│   │   ├── L4-semantic/        # GraphEngine, BM25, VectorEngine
│   │   ├── L5-bootstrap/       # ContextBootstrap, CLI entrypoint
│   │   ├── L6-ai-core/         # LLMAdapter, провайдеры
│   │   ├── L7-dev-system/      # Prompt/Skill/Agent/Workflow
│   │   └── L9-dreaming/        # DreamingEngine
│   ├── security/               # SecurityEngine, Sandbox, AuditLogger
│   ├── shared/                 # Types, errors, utils, config
│   ├── tools/                  # MCP tool handlers
│   └── index.ts                # Server entrypoint
├── tests/                      # 292 теста
├── docs/                       # Документация
├── dist/                       # Скомпилированный код
├── .env.example                # Шаблон env
├── mcp-config.yaml             # Шаблон YAML-конфигурации
└── package.json
```
