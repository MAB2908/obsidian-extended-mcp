v0.1b: 
# Каталог ошибок и восстановления — Obsidian Extended MCP

> **Версия:** 0.1b  
> **Дата:** 2026-05-28  
> **Область:** Полная матрица ошибок, recovery actions, troubleshooting  
> **Язык:** Русский

---

## Содержание

1. [Иерархия ошибок](#1-иерархия-ошибок)
2. [Layer 1: Filesystem Errors](#2-layer-1-filesystem-errors)
3. [Layer 2: CLI Bridge Errors](#3-layer-2-cli-bridge-errors)
4. [Layer 2b: REST Fallback Errors](#4-layer-2b-rest-fallback-errors)
5. [Layer 3: Pipeline Errors](#5-layer-3-pipeline-errors)
6. [Layer 4: Semantic Engine Errors](#6-layer-4-semantic-engine-errors)
7. [Layer 5: Context Bootstrap Errors](#7-layer-5-context-bootstrap-errors)
8. [Общие runtime ошибки](#8-общие-runtime-ошибки)
9. [Graceful Degradation Matrix](#9-graceful-degradation-matrix)
10. [Troubleshooting Flowchart](#10-troubleshooting-flowchart)

---

## 1. Иерархия ошибок

```
McpError (базовый класс)
├── LayerUnavailableError     → fallback на другой слой
├── FileSystemError           → retry, backup restore
├── CliError                  → reconnect, fallback
├── RestError                 → fallback на CLI или FS
├── PipelineError             → partial result, log
├── SemanticError             → disable feature, fallback BM25
├── ConfigError               → stop, require fix
└── SecurityError             → stop, log audit
```

### Структура ошибки

```typescript
interface McpError {
  code: string;           // машиночитаемый код
  layer: string;          // где произошла
  severity: 'fatal' | 'error' | 'warning' | 'info';
  message: string;        // человекочитаемое описание
  recovery: string;       // рекомендуемое действие
  fallback?: string;      // альтернативный слой
  retryable: boolean;     // можно ли retry
  maxRetries?: number;    // сколько раз
}
```

---

## 2. Layer 1: Filesystem Errors

### E101 — Path Security Error

| Поле | Значение |
|------|----------|
| **Код** | `E101` |
| **Сообщение** | `Path traversal detected or path outside vault: {path}` |
| **Причина** | Попытка доступа за пределами vault или path traversal |
| **Severity** | fatal |
| **Recovery** | Использовать относительный путь внутри корня vault |
| **Retryable** | Нет |
| **Fallback** | — |

### E102 — File Locked (EBUSY)

| Поле | Значение |
|------|----------|
| **Код** | `E102` |
| **Сообщение** | `Resource busy or locked: {path}` |
| **Причина** | Obsidian открыл файл в редакторе; git hook; sync plugin |
| **Severity** | warning |
| **Recovery** | Retry с jitter: `delay = 100ms * (attempt + 1) + random(50ms)` |
| **Retryable** | Да (3 попытки) |
| **Fallback** | — |

```javascript
// Полная реализация с atomic write (tmp → rename) и backup
async function atomicWrite(path, content, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const tmpPath = `${path}.tmp.${Date.now()}`;
    const bakPath = `${path}.bak`;

    try {
      if (await fs.exists(path)) {
        await fs.copy(path, bakPath);
      }
      await fs.writeFile(tmpPath, content, { flag: 'wx' });
      await fs.rename(tmpPath, path);
      await fs.remove(bakPath).catch(() => {});
      return;
    } catch (e) {
      if (e.code === 'EBUSY') {
        await sleep(100 * (i + 1) + Math.random() * 50);
        continue;
      }
      // Restore backup on failure
      if (await fs.exists(bakPath)) {
        await fs.copy(bakPath, path);
      }
      throw e;
    }
  }
  throw new Error(`Write failed after ${retries} retries`);
}
```

### E103 — Permission Denied

| Поле | Значение |
|------|----------|
| **Код** | `E103` |
| **Сообщение** | `Permission denied: {path}` |
| **Причина** | Нет прав на чтение/запись в vault |
| **Severity** | fatal |
| **Recovery** | Проверить права: `chmod -R 755 /path/to/vault` |
| **Retryable** | Нет |
| **Fallback** | — |

### E104 — Corrupted Cache

| Поле | Значение |
|------|----------|
| **Код** | `E104` |
| **Сообщение** | `Cache corrupted: {reason}` |
| **Причина** | Кэш повреждён (неожиданное завершение процесса, диск full) |
| **Severity** | warning |
| **Recovery** | Удалить `.mcp-cache`; перестроить при следующем запросе |
| **Retryable** | Да (автоматически) |
| **Fallback** | Полный rescan файловой системы |

```bash
rm .mcp-cache/graph.json
# Или через CLI:
obsidian eval "JSON.stringify(app.metadataCache.resolvedLinks)" > .mcp-cache/graph.json
```

### E105 — BM25 Index Corrupted

| Поле | Значение |
|------|----------|
| **Код** | `E105` |
| **Сообщение** | `BM25 index corrupted or incompatible version` |
| **Причина** | Major update MCP; повреждение файла |
| **Severity** | warning |
| **Recovery** | `rm -rf .mcp-cache/search-index/`; индекс перестроится инкрементально |
| **Retryable** | Да |
| **Fallback** | ripgrep fallback (медленнее, но работает) |

### E106 — File Not Found

| Поле | Значение |
|------|----------|
| **Код** | `E106` |
| **Сообщение** | `File not found: {path}` |
| **Причина** | Запрошенный файл не существует в vault |
| **Severity** | error |
| **Recovery** | Проверить путь; если создаётся новый — использовать `write_note` |
| **Retryable** | Нет |
| **Fallback** | — |

### E107 — File Exists

| Поле | Значение |
|------|----------|
| **Код** | `E107` |
| **Сообщение** | `File already exists: {path}. Use overwrite=true to replace.` |
| **Причина** | Файл уже существует при попытке записи без overwrite |
| **Severity** | error |
| **Recovery** | Использовать `overwrite=true` или удалить существующий файл |
| **Retryable** | Нет |
| **Fallback** | — |

### E108 — Unknown Operation

| Поле | Значение |
|------|----------|
| **Код** | `E108` |
| **Сообщение** | `Unknown operation: {operation}` |
| **Причина** | Указана неподдерживаемая операция |
| **Severity** | error |
| **Recovery** | Использовать поддерживаемые операции: replace, append, prepend, delete, add, remove, set |
| **Retryable** | Нет |
| **Fallback** | — |

### E109 — Read Failed

| Поле | Значение |
|------|----------|
| **Код** | `E109` |
| **Сообщение** | `Read failed: {path}` |
| **Причина** | Ошибка чтения файла (права, диск, повреждение) |
| **Severity** | error |
| **Recovery** | Проверить права файла и состояние диска |
| **Retryable** | Да (1 попытка) |
| **Fallback** | — |

### E110 — No Backup

| Поле | Значение |
|------|----------|
| **Код** | `E110` |
| **Сообщение** | `No backup found for {path}` |
| **Причина** | Резервная копия не найдена для отката |
| **Severity** | error |
| **Recovery** | Проверить `.mcp-cache/backups/` или создать новый бэкап |
| **Retryable** | Нет |
| **Fallback** | — |

### E111 — Write Failed

| Поле | Значение |
|------|----------|
| **Код** | `E111` |
| **Сообщение** | `Write failed after {retries} retries: {path}` |
| **Причина** | Не удалось записать файл после всех попыток |
| **Severity** | error |
| **Recovery** | Проверить место на диске, блокировки файлов и права |
| **Retryable** | Нет |
| **Fallback** | — |

---

## 3. Layer 2: CLI Bridge Errors

### E201 — CLI Not Found

| Поле | Значение |
|------|----------|
| **Код** | `E201` |
| **Сообщение** | `Obsidian CLI not found. Is the CLI plugin installed?` |
| **Причина** | Obsidian не установлен; CLI не в PATH; Obsidian < 1.12 |
| **Severity** | warning |
| **Recovery** | Проверить `which obsidian`; добавить в PATH; обновить Obsidian |
| **Retryable** | Да (3 попытки) |
| **Fallback** | Layer 1 (filesystem) + Layer 2b (REST если доступен) |

```bash
# macOS
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"

# Проверка
obsidian vault
```

### E202 — CLI Timeout

| Поле | Значение |
|------|----------|
| **Код** | `E202` |
| **Сообщение** | `CLI command timed out after {timeoutMs}ms` |
| **Причина** | Сложная eval; Obsidian занят; deadlock в плагине |
| **Severity** | warning |
| **Recovery** | Увеличить таймаут или проверить отзывчивость Obsidian |
| **Retryable** | Да (1 попытка с удвоенным таймаутом) |
| **Fallback** | Layer 1 или REST |

```javascript
class CliBridge {
  async _reconnect() {
    for (let i = 0; i < this.maxRetries; i++) {
      const delay = Math.min(this.baseDelay * Math.pow(2, i) + Math.random() * 100, 30000);
      await sleep(delay);
      if (await this.checkAvailability()) {
        this.state = 'connected';
        return true;
      }
    }
    return false;
  }
}
```

### E203 — Unknown CLI Action

| Поле | Значение |
|------|----------|
| **Код** | `E203` |
| **Сообщение** | `Unknown {context} action: {action}` |
| **Причина** | Указано неподдерживаемое действие для CLI |
| **Severity** | error |
| **Recovery** | Использовать поддерживаемые действия |
| **Retryable** | Нет |
| **Fallback** | — |

### E204 — CLI Response Error

| Поле | Значение |
|------|----------|
| **Код** | `E204` |
| **Сообщение** | `CLI returned error: {details}` |
| **Причина** | CLI вернул ошибку выполнения |
| **Severity** | error |
| **Recovery** | Проверить состояние Obsidian и конфигурацию плагинов |
| **Retryable** | Нет |
| **Fallback** | — |

### E205 — Command Not Supported

| Поле | Значение |
|------|----------|
| **Код** | `E205` |
| **Статус** | **Зарезервирован для v2.3+** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

### E206 — CLI Exit Error

| Поле | Значение |
|------|----------|
| **Код** | `E206` |
| **Сообщение** | `CLI exited with code {code}: {stderr}` |
| **Причина** | CLI-процесс завершился с ненулевым кодом |
| **Severity** | error |
| **Recovery** | Проверить консоль Obsidian на ошибки |
| **Retryable** | Нет |
| **Fallback** | — |

### E207 — CLI Parse Error

| Поле | Значение |
|------|----------|
| **Код** | `E207` |
| **Сообщение** | `Failed to parse CLI output: {details}` |
| **Причина** | Невозможно распарсить вывод CLI |
| **Severity** | error |
| **Recovery** | Проверить совместимость версии CLI-плагина |
| **Retryable** | Нет |
| **Fallback** | — |

---

## 4. Layer 2b: REST Fallback Errors

### E301 — REST Query Error

| Поле | Значение |
|------|----------|
| **Код** | `E301` |
| **Сообщение** | `Dataview query failed: {query} — {details}` |
| **Причина** | Ошибка выполнения Dataview-запроса через REST |
| **Severity** | error |
| **Recovery** | Проверить плагин Dataview и синтаксис запроса |
| **Retryable** | Да (1 попытка) |
| **Fallback** | Layer 1 (filesystem) |

### E302 — TLS Certificate Error

| Поле | Значение |
|------|----------|
| **Код** | `E302` |
| **Статус** | **Зарезервировано — не реализовано в v2.12.5** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

### E303 — REST Endpoint Not Found

| Поле | Значение |
|------|----------|
| **Код** | `E303` |
| **Статус** | **Зарезервировано — не реализовано в v2.12.5** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

---

## 5. Layer 3: Pipeline Errors

> **Примечание:** Класс `PipelineError` существует в коде, но специфические коды ошибок данного слоя пока не определены. Код `E401` перемещён в раздел «Ошибки безопасности».

### E402 — Ontology Violation

| Поле | Значение |
|------|----------|
| **Код** | `E402` |
| **Класс** | `OntologyViolationError` (наследуется от `SecurityError`) |
| **Severity** | error |
| **Сообщение** | `Ontology violation in {path}: {violations}` |
| **Причина** | Заметка нарушает правила онтологии (отсутствует обязательный тег, запрещённый тег, или тег не из разрешённого списка) |
| **Recovery** | Исправить frontmatter tags в соответствии с правилами онтологии |
| **Retryable** | Нет |
| **Fallback** | — |

**Когда возникает:**
- Когда `ENFORCE_ONTOLOGY=true` и заметка не соответствует правилам папки (required/forbidden tags).

**Пример:**
```typescript
throw new OntologyViolationError('concepts/test.md', [
  'Missing required tag: concept',
  'Forbidden tag: source'
]);
```

### E403 — Circular Link Detected

| Поле | Значение |
|------|----------|
| **Код** | `E403` |
| **Статус** | **Зарезервировано — не реализовано в v2.12.5** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

### E404 — Insufficient Links

| Поле | Значение |
|------|----------|
| **Код** | `E404` |
| **Статус** | **Зарезервировано — не реализовано в v2.12.5** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

---

## 6. Layer 4: Semantic Engine Errors

> **Примечание:** Класс `SemanticError` существует в коде, но специфические коды ошибок данного слоя пока не определены.

### E501 — Embedding Model Not Found

| Поле | Значение |
|------|----------|
| **Код** | `E501` |
| **Статус** | **Зарезервировано — не реализовано в v2.12.5** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

### E502 — Out of Memory (Indexing)

| Поле | Значение |
|------|----------|
| **Код** | `E502` |
| **Статус** | **Зарезервировано — не реализовано в v2.12.5** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

### E503 — Vector Dimension Mismatch

| Поле | Значение |
|------|----------|
| **Код** | `E503` |
| **Статус** | **Зарезервировано — не реализовано в v2.12.5** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

---

## 7. Layer 5: Context Bootstrap Errors

> **Примечание:** Класс `ConfigError` существует в коде, но специфические коды ошибок данного слоя пока не определены.

### E601 — Meta Files Missing

| Поле | Значение |
|------|----------|
| **Код** | `E601` |
| **Статус** | **Зарезервирован для bootstrap validation (v2.3+)** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

### E602 — Context Too Large

| Поле | Значение |
|------|----------|
| **Код** | `E602` |
| **Статус** | **Зарезервирован для context truncation (v2.3+)** |
| **Severity** | — |
| **Recovery** | — |
| **Retryable** | — |
| **Fallback** | — |

---

## 8. Общие runtime ошибки

### E001 — Layer Unavailable

| Поле | Значение |
|------|----------|
| **Код** | `E001` |
| **Тип** | `LayerUnavailableError` |
| **Сообщение** | `Layer unavailable: {layer}` |
| **Причина** | Запрошенный слой (CLI, REST, semantic) недоступен или не инициализирован |
| **Severity** | error |
| **Recovery** | Проверить конфигурацию слоя или использовать fallback |
| **Retryable** | Да (3 попытки) |
| **Fallback** | Другой слой (например, REST → CLI → FS) |

### E901 — Config Invalid

| Поле | Значение |
|------|----------|
| **Код** | `E901` |
| **Тип** | `ConfigInvalidError` |
| **Сообщение** | `Config invalid: {reason}` |
| **Причина** | Неверная конфигурация при старте (SEMANTIC_ENABLED без ключей, короткий MCP_AUTH_TOKEN) |
| **Severity** | fatal |
| **Recovery** | Проверить `.env.example` и задать обязательные переменные |
| **Retryable** | Нет |
| **Fallback** | — |

### E902 — Vault Path Not Found

| Поле | Значение |
|------|----------|
| **Код** | `E902` |
| **Тип** | `VaultPathNotFoundError` |
| **Сообщение** | `Vault path not found: {path}` |
| **Причина** | Указанный `OBSIDIAN_VAULT_PATH` не существует или не является директорией |
| **Severity** | fatal |
| **Recovery** | Задать `OBSIDIAN_VAULT_PATH` на существующую директорию |
| **Retryable** | Нет |
| **Fallback** | — |

### E903 — Audit Log Write Failed

| Поле | Значение |
|------|----------|
| **Код** | `E903` |
| **Тип** | `AuditLogWriteFailedError` |
| **Сообщение** | `Audit log write failed: {details}` |
| **Причина** | Недостаточно места на диске или нет прав на `.mcp-cache/` |
| **Severity** | error |
| **Recovery** | Проверить место на диске и права на `.mcp-cache/` |
| **Retryable** | Да (1 попытка) |
| **Fallback** | — |

### E904 — Memory Limit Exceeded

| Поле | Значение |
|------|----------|
| **Код** | `E904` |
| **Тип** | `MemoryLimitExceededError` |
| **Сообщение** | `Memory limit exceeded: {limit}` |
| **Причина** | Процесс превысил лимит памяти при индексации или batch-операции |
| **Severity** | fatal |
| **Recovery** | Уменьшить размер batch или включить chunked processing |
| **Retryable** | Нет |
| **Fallback** | — |

---

## 8a. Ошибки безопасности

### E401 — ACL Denied

| Поле | Значение |
|------|----------|
| **Код** | `E401` |
| **Сообщение** | `{Action} denied by ACL: {path}` |
| **Причина** | Операция заблокирована политикой ACL папки |
| **Severity** | fatal |
| **Recovery** | Проверить политику ACL папки или запросить доступ |
| **Retryable** | Нет |
| **Fallback** | — |

---

## 9. Graceful Degradation Matrix

| Ошибка | Layer 2 (CLI) | Layer 2b (REST) | Layer 1 (FS) | Результат |
|--------|--------------|-----------------|--------------|-----------|
| Obsidian закрыт | ❌ | ❌ | ✅ | FS-only mode |
| CLI недоступен (нет Obsidian 1.12+) | ❌ | ✅ | ✅ | REST + FS |
| REST plugin не установлен | ❌ | ❌ | ✅ | FS-only |
| File locked (EBUSY) | Retry | Retry | Retry + jitter | Success или Error |
| Graph cache corrupted | ❌ | ❌ | ✅ | Rebuild from FS |
| BM25 index corrupted | ❌ | ❌ | ✅ | Rebuild from FS |
| Out of memory | — | — | Streaming | Chunked processing |
| CLI eval security violation | ❌ | — | — | Error (no fallback) |
| LLM unavailable | — | — | — | Skip auto-features |

---

## 10. Troubleshooting Flowchart

```
Пользователь видит ошибку
        │
        ▼
┌─────────────────────────────┐
│  Это ошибка записи (write)? │
└─────────────────────────────┘
   │                  │
   ДА                 НЕТ
   │                  ▼
   ▼        ┌─────────────────────────┐
┌──────────┐│  Это ошибка CLI/IPC?    │
│ E102/103 │└─────────────────────────┘
│ EBUSY?   │   │                  │
└──────────┘   ДА                 НЕТ
   │           │                  ▼
   ДА          ▼        ┌─────────────────┐
   │      ┌──────────┐  │  Это ошибка     │
   ▼      │ E201/202 │  │  config/vault?  │
Retry 3x  │ ECONN?   │  └─────────────────┘
   │      └──────────┘   │             │
   │         │           ДА            НЕТ
   │         ДА          │             ▼
   │         │           ▼    ┌─────────────────┐
   │         ▼      ┌────────┐│  Это pipeline   │
   │    Reconnect   │ E901/  ││  /semantic?     │
   │    backoff     │ E902   │└─────────────────┘
   │         │      └────────┘   │           │
   │         │         │         ДА          НЕТ
   │         │         ДА        │           ▼
   │         │         │         ▼    ┌─────────────┐
   │         │         ▼    ┌────────┐│ Unknown     │
   │         │    Fix config│ E801   ││ error →     │
   │         │    or path   │        ││ log + report│
   │         │              └────────┘└─────────────┘
   │         │                 │
   │         │                 ДА
   │         │                 │
   │         │                 ▼
   │         │         Check LLM/Model
   │         │         Retry with backoff
   │         │
   │         НЕТ (CLI OK)
   │         │
   │         ▼
   │    Fallback to REST
   │    or Filesystem
   │
   НЕТ (не EBUSY)
   │
   ▼
Permission denied?
   │
   ДА → Fix chmod/chown
   │
   НЕТ → Log unexpected error
```

### Quick Fix Commands

```bash
# Проверить, запущен ли Obsidian
pgrep -f Obsidian || echo "Obsidian not running"

# Проверить CLI
obsidian vault

# Проверить права vault
ls -la /path/to/vault

# Очистить кэш
rm -rf .mcp-cache/*

# Проверить место на диске
df -h

# Проверить логи MCP
tail -f sessions/mcp-audit.log

# Проверить Ollama (если semantic)
curl http://localhost:11434/api/tags

# Перезапуск MCP Server
pkill -f obsidian-extended-mcp
npx @yourscope/obsidian-extended-mcp /path/to/vault
```

### E8xx — AI Core Errors

#### `E801` — `LLMHttpError`
**Тип:** LLMProviderError (runtime, retryable)  
**Сообщение:** `LLM provider HTTP error {status}: {body}`

**Когда:** HTTP-запрос к провайдеру LLM завершился с ошибкой (неверный API-ключ, rate limit, недоступность).  
**Решение:**
- Проверить `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
- Проверить rate limits
- Проверить статус провайдера
- Retry с backoff (до 3 попыток)

---

#### `E802` — `AIModelUnavailable`
**Тип:** AIError (runtime, retryable)  
**Статус:** **Зарезервировано — не реализовано в v2.12.5**  
**Сообщение:** `Model '{model}' unavailable on provider '{provider}'. Status: {status}`

---

#### `E803` — `AIStructuredOutputError`
**Тип:** AIError (runtime)  
**Статус:** **Зарезервировано — не реализовано в v2.12.5**  
**Сообщение:** `AI returned invalid JSON. Model: {model}. Raw: {raw}`

---

#### `E804` — `AIOntologyViolation`
**Тип:** AIError (runtime)  
**Статус:** **Зарезервировано — не реализовано в v2.12.5**  
**Сообщение:** `AI suggestion violates ontology rule: {rule}. Confidence: {confidence}`

---

#### `E805` — `AIIterationLimitExceeded`
**Тип:** AIError (runtime)  
**Статус:** **Зарезервировано — не реализовано в v2.12.5**  
**Сообщение:** `Agent {agent} exceeded max iterations ({limit}) without convergence`

---

*Каталог составлен на основе Runtime Specification v1.6, CLI Protocol v1.6, AI Core Specification v3.0 и опыта аудита 52 MCP-реализаций.*
