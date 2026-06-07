v0.2b: 
# Спецификация Audit Logger: Obsidian Extended MCP

> **Версия:** 0.1b  
> **Дата:** 2026-05-27  
> **Статус:** Готово к реализации  
> **Связанные документы:** `SECURITY_MODEL.md`, `IMPLEMENTATION_GUIDE.md` §7

---

## Содержание

1. [Обзор](#1-обзор)
2. [Архитектура](#2-архитектура)
3. [Форматы логов](#3-форматы-логов)
4. [Event Types](#4-event-types)
5. [Класс AuditLogger](#5-класс-auditlogger)
6. [Search API](#6-search-api)
7. [Ротация и хранение](#7-ротация-и-хранение)
8. [GDPR-compliant purge](#8-gdpr-compliant-purge)
9. [Performance](#9-performance)
10. [Конфигурация](#10-конфигурация)

---

## 1. Обзор

Audit Logger — центральный компонент наблюдаемости Obsidian Extended MCP. Каждая write-операция, fallback, ошибка и security-событие записываются в структурированный лог для последующего аудита, отладки и восстановления.

### Принципы

1. **Append-only** — логи не модифицируются после записи.
2. **Structured** — JSON Lines по умолчанию, машиночитаемый формат.
3. **Dual-mode** — per-session логи + persistent master log.
4. **Async** — запись не блокирует основной поток.
5. **Rotatable** — автоматическая ротация по размеру и возрасту.

---

## 2. Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Dispatcher │  │  Security   │  │     Tool Handlers    │  │
│  │   Router    │──│   Engine    │──│  (fs_*, cli_*, ...)  │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
│         │                │                                   │
│         └────────────────┼───────────────────────────────────┘
│                          │ async batch write
┌──────────────────────────▼───────────────────────────────────┐
│                    AuditLogger                                │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │  Per-Session     │  │      Persistent Master Log       │  │
│  │  (jsonl)         │  │      (jsonl / csv / md)          │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        sessions/    .mcp-cache/    (optional)
        mcp-audit-   audit.log      remote sink
        {id}.jsonl
```

---

## 3. Форматы логов

### 3.1. JSON Lines (default)

```jsonl
{"timestamp":"2026-05-27T12:00:00.000Z","event":"tool_call","tool":"fs_write_note","args":{"path":"concepts/neural-networks.md"},"level":3,"sessionId":"sess-abc123","result":"success","durationMs":45}
{"timestamp":"2026-05-27T12:01:00.000Z","event":"write","path":"concepts/neural-networks.md","size":2048,"sha256":"a1b2c3...","sessionId":"sess-abc123"}
{"timestamp":"2026-05-27T12:02:00.000Z","event":"fallback","tool":"cli_backlinks","reason":"CLI unavailable","fallbackLayer":"filesystem","sessionId":"sess-abc123"}
{"timestamp":"2026-05-27T12:03:00.000Z","event":"error","tool":"fs_delete_note","code":"E101","message":"File not found: old.md","sessionId":"sess-abc123"}
{"timestamp":"2026-05-27T12:04:00.000Z","event":"security","tool":"cli_eval","reason":"Forbidden pattern: require\\s*\\(","blocked":true,"sessionId":"sess-abc123"}
```

### 3.2. CSV (опционально)

```csv
timestamp,event,tool,path,result,sessionId
2026-05-27T12:00:00Z,tool_call,fs_write_note,concepts/nn.md,success,sess-abc123
2026-05-27T12:01:00Z,write,fs_write_note,concepts/nn.md,success,sess-abc123
```

### 3.3. Markdown (human-readable)

```markdown
## Audit Log — 2026-05-27

| Time | Event | Tool | Path | Result |
|------|-------|------|------|--------|
| 12:00 | tool_call | fs_write_note | concepts/nn.md | success |
| 12:01 | write | fs_write_note | concepts/nn.md | success |
| 12:02 | fallback | cli_backlinks | — | filesystem |
```

---

## 4. Event Types

| Event | Описание | Поля |
|-------|----------|------|
| `tool_call` | Вызов MCP tool | `tool`, `args`, `level`, `result`, `durationMs` |
| `write` | Файл записан/изменён | `path`, `size`, `sha256` (after) |
| `error` | Ошибка выполнения | `error`, `message`, `stack`, `recoverable` |
| `fallback` | Деградация слоя | `tool`, `reason`, `fallbackLayer` |
| `security` | Блокировка security | `tool`, `reason`, `blocked`, `policy` |
| `session_start` | Начало сессии | `sessionId`, `client`, `vaultPath` |
| `session_end` | Конец сессии | `sessionId`, `durationMs`, `opsCount` |
| `batch_preview` | Batch edit preview | `affectedFiles`, `changesCount`, `backupPath` |
| `batch_apply` | Batch edit applied | `affectedFiles`, `changesCount`, `backupPath` |
| `rollback` | Откат изменений | `backupPath`, `restoredFiles` |

---

## 5. Класс AuditLogger

```typescript
// src/audit/AuditLogger.ts

interface AuditEntry {
  timestamp: string;
  event: string;
  sessionId: string;
  [key: string]: any;
}

interface AuditLoggerConfig {
  vaultPath: string;
  format: 'jsonl' | 'csv' | 'markdown';
  maxAgeDays: number;
  maxEntries: number;
  batchSize: number;
  flushIntervalMs: number;
  remoteSink?: string; // optional HTTP endpoint
}

class AuditLogger {
  private buffer: AuditEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private config: AuditLoggerConfig;

  constructor(config: AuditLoggerConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
  }

  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async log(entry: Omit<AuditEntry, 'timestamp' | 'sessionId'>): Promise<void> {
    const fullEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...entry
    };
    this.buffer.push(fullEntry);

    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = this.buffer.splice(0, this.buffer.length);
    const sessionPath = path.join(
      this.config.vaultPath,
      'sessions',
      `mcp-audit-${this.sessionId}.jsonl`
    );
    const masterPath = path.join(
      this.config.vaultPath,
      '.mcp-cache',
      'audit.log'
    );

    // Ensure directories exist
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.mkdir(path.dirname(masterPath), { recursive: true });

    const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';

    // Write to per-session log
    await fs.appendFile(sessionPath, lines);

    // Write to master log
    await fs.appendFile(masterPath, lines);

    // Optional: remote sink
    if (this.config.remoteSink) {
      this.sendToRemote(entries).catch(() => {}); // fire-and-forget
    }
  }

  private async sendToRemote(entries: AuditEntry[]): Promise<void> {
    try {
      await fetch(this.config.remoteSink!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries)
      });
    } catch {
      // Silently fail — local log is source of truth
    }
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushIntervalMs);
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}
```

---

## 6. Search API

```typescript
// src/audit/AuditSearch.ts

interface AuditSearchQuery {
  startDate?: Date;
  endDate?: Date;
  event?: string;
  tool?: string;
  path?: string;
  result?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
}

class AuditSearch {
  constructor(private auditPath: string) {}

  async search(query: AuditSearchQuery): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];
    const stream = createReadStream(this.auditPath, { encoding: 'utf8' });
    const rl = createInterface(stream);

    for await (const line of rl) {
      if (!line.trim()) continue;
      const entry: AuditEntry = JSON.parse(line);

      if (query.startDate && new Date(entry.timestamp) < query.startDate) continue;
      if (query.endDate && new Date(entry.timestamp) > query.endDate) continue;
      if (query.event && entry.event !== query.event) continue;
      if (query.tool && entry.tool !== query.tool) continue;
      if (query.path && !entry.path?.includes(query.path)) continue;
      if (query.result && entry.result !== query.result) continue;
      if (query.sessionId && entry.sessionId !== query.sessionId) continue;

      results.push(entry);
      if (query.limit && results.length >= query.limit) break;
    }

    return results;
  }

  async getStats(): Promise<{
    totalEntries: number;
    eventsBreakdown: Record<string, number>;
    toolsBreakdown: Record<string, number>;
    dateRange: { min: Date; max: Date };
  }> {
    const stats = {
      totalEntries: 0,
      eventsBreakdown: {} as Record<string, number>,
      toolsBreakdown: {} as Record<string, number>,
      dateRange: { min: new Date(8640000000000000), max: new Date(0) }
    };

    const stream = createReadStream(this.auditPath, { encoding: 'utf8' });
    const rl = createInterface(stream);

    for await (const line of rl) {
      if (!line.trim()) continue;
      const entry: AuditEntry = JSON.parse(line);
      stats.totalEntries++;
      stats.eventsBreakdown[entry.event] = (stats.eventsBreakdown[entry.event] || 0) + 1;
      if (entry.tool) stats.toolsBreakdown[entry.tool] = (stats.toolsBreakdown[entry.tool] || 0) + 1;

      const ts = new Date(entry.timestamp);
      if (ts < stats.dateRange.min) stats.dateRange.min = ts;
      if (ts > stats.dateRange.max) stats.dateRange.max = ts;
    }

    return stats;
  }
}
```

---

## 7. Ротация и хранение

### Политики

| Параметр | Значение по умолчанию | Описание |
|----------|----------------------|----------|
| `maxAgeDays` | 90 | Удаление записей старше N дней |
| `maxEntries` | 10000 | Макс записей в master log |
| `maxSizeMB` | 100 | Макс размер master log |
| `sessionRetention` | 30 | Хранение per-session логов (дней) |

### Ротация master log

```typescript
async function rotateLog(masterPath: string, maxSizeMB: number): Promise<void> {
  const stats = await fs.stat(masterPath);
  const sizeMB = stats.size / (1024 * 1024);

  if (sizeMB > maxSizeMB) {
    const rotated = `${masterPath}.${Date.now()}.jsonl`;
    await fs.rename(masterPath, rotated);
    // Compress old rotated files
    const oldRotated = await glob(`${masterPath}.*.jsonl`);
    for (const file of oldRotated.slice(0, -3)) { // keep last 3
      await compress(file); // gzip
    }
  }
}
```

### Ротация per-session логов

```typescript
async function cleanupSessionLogs(sessionsDir: string, maxAgeDays: number): Promise<void> {
  const files = await fs.readdir(sessionsDir);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (!file.startsWith('mcp-audit-')) continue;
    const stat = await fs.stat(path.join(sessionsDir, file));
    if (stat.mtimeMs < cutoff) {
      await fs.unlink(path.join(sessionsDir, file));
    }
  }
}
```

---

## 8. GDPR-compliant purge

```typescript
// src/audit/GDPRPurge.ts

interface PurgeRequest {
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  path?: string; // purge all logs referencing this file
}

class GDPRPurge {
  constructor(private auditPath: string, private sessionsDir: string) {}

  async purge(request: PurgeRequest): Promise<{ removedEntries: number }> {
    // Read all entries
    const lines = (await fs.readFile(this.auditPath, 'utf8')).split('\n');
    const kept: string[] = [];
    let removed = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const entry: AuditEntry = JSON.parse(line);

      let match = false;
      if (request.sessionId && entry.sessionId === request.sessionId) match = true;
      if (request.startDate && request.endDate) {
        const ts = new Date(entry.timestamp);
        if (ts >= request.startDate && ts <= request.endDate) match = true;
      }
      if (request.path && entry.path === request.path) match = true;

      if (match) {
        removed++;
      } else {
        kept.push(line);
      }
    }

    // Rewrite master log
    const tmp = this.auditPath + '.tmp';
    await fs.writeFile(tmp, kept.join('\n') + '\n');
    await fs.rename(tmp, this.auditPath);

    // Remove matching session files
    if (request.sessionId) {
      const sessionFile = path.join(this.sessionsDir, `mcp-audit-${request.sessionId}.jsonl`);
      if (await fs.exists(sessionFile)) {
        await fs.unlink(sessionFile);
      }
    }

    return { removedEntries: removed };
  }
}
```

---

## 9. Performance

| Метрика | Целевое значение |
|---------|-----------------|
| Задержка записи (buffered) | < 1ms |
| Flush batch (1000 entries) | < 50ms |
| Search 10K entries | < 100ms |
| Память (buffer) | < 1MB |
| Ротация | Async, не блокирующая |

### Оптимизации

1. **Buffered writes** — batch до 1000 записей или 5s interval
2. **Lazy rotation** — проверка размера при flush, не при каждой записи
3. **Indexed search** (future) — SQLite FTS5 для audit log

---

## 10. Конфигурация

```yaml
# mcp-config.yaml
audit:
  enabled: true
  format: jsonl          # jsonl | csv | markdown
  maxAgeDays: 90
  maxEntries: 10000
  maxSizeMB: 100
  batchSize: 1000
  flushIntervalMs: 5000
  sessionRetention: 30
  remoteSink: null       # "https://logs.example.com/mcp"
```

### Environment Variables

| Переменная | Описание | Default |
|------------|----------|---------|
| `MCP_AUDIT_ENABLED` | Включить audit logging | `true` |
| `MCP_AUDIT_FORMAT` | Формат логов | `jsonl` |
| `MCP_AUDIT_MAX_AGE` | Макс возраст (дней) | `90` |
| `MCP_AUDIT_MAX_ENTRIES` | Макс записей | `10000` |
| `MCP_AUDIT_REMOTE_SINK` | URL для remote логов | — |

---

*Спецификация составлена в соответствии с Design Principle #5 из `SPECIFICATION.ru.md` и требованиями воспроизводимости операций.*
