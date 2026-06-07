v0.2b: 
# Справочник Local REST API — Fallback Layer 2b

> **Версия:** 0.1b  
> **Дата:** 2026-05-27  
> **Область:** Endpoints, аутентификация, примеры, ограничения  
> **Plugin:** `obsidian-local-rest-api` by coddingtonbear  
> **Язык:** Русский

---

## 1. Установка и настройка

### 1.1. Установка плагина

1. Открыть Obsidian → Settings → Community Plugins
2. Выключить Safe Mode → Browse
3. Найти `Local REST API` (автор: coddingtonbear)
4. Install → Enable

### 1.2. Настройка HTTPS + API Key

1. Settings → Local REST API
2. Включить `Enable non-encrypted server` (для localhost) или использовать HTTPS с self-signed cert
3. Скопировать API Key

### 1.3. Проверка доступности

```bash
curl -k https://127.0.0.1:27124/ \
  -H "Authorization: Bearer $API_KEY"

# Ответ: информация о vault
```

---

## 2. Endpoints

### 2.1. Active Note

**GET** `/active/`

Возвращает содержимое и metadata текущей активной заметки.

**Заголовки:**
```
Authorization: Bearer <token>
```

**Пример ответа:**
```json
{
  "path": "concepts/neural-networks.md",
  "content": "# Neural Networks\n\n> Вычислительные системы...",
  "frontmatter": {
    "title": "Neural Networks",
    "date": "2026-05-15",
    "tags": ["concept", "ai", "ml"]
  }
}
```

**MCP Tool:** `rest_active_note`

---

### 2.2. Vault CRUD

#### GET `/vault/{path}`

Прочитать заметку по относительному пути.

**Пример:**
```bash
curl -k "https://127.0.0.1:27124/vault/concepts/neural-networks.md" \
  -H "Authorization: Bearer $API_KEY"
```

**Ответ:**
```json
{
  "path": "concepts/neural-networks.md",
  "content": "...",
  "frontmatter": { ... }
}
```

#### PUT `/vault/{path}`

Создать или обновить заметку.

**Тело запроса:**
```json
{
  "content": "# New Note\n\nHello"
}
```

**Заголовки:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

#### DELETE `/vault/{path}`

Удалить заметку.

---

### 2.3. Search

**GET** `/search/?query={query}`

Полнотекстовый поиск по vault.

**Пример:**
```bash
curl -k "https://127.0.0.1:27124/search/?query=transformer" \
  -H "Authorization: Bearer $API_KEY"
```

**Ответ:**
```json
{
  "results": [
    {
      "path": "raw/2026-05-20-article-transformers.md",
      "score": 0.95,
      "matches": ["transformer architecture"]
    }
  ]
}
```

**Ограничение:** Не поддерживает Obsidian-specific query syntax (tag:, path:). Только plain text.

---

### 2.4. Tags

**GET** `/tags/`

Список всех тегов.

**GET** `/tags/{tag}/`

Все заметки с указанным тегом.

---

### 2.5. Commands

**POST** `/commands/{command-id}/`

Выполнить команду из Command Palette.

**Пример:**
```bash
curl -k -X POST "https://127.0.0.1:27124/commands/workspace:export-pdf/" \
  -H "Authorization: Bearer $API_KEY"
```

---

## 3. Что НЕ поддерживает Local REST API

| Возможность | Статус | Альтернатива |
|-------------|--------|--------------|
| **Backlinks** | ❌ Нет endpoint | `cli_backlinks` или `graph_neighbors` |
| **Graph / resolvedLinks** | ❌ Нет endpoint | `cli_eval("app.metadataCache.resolvedLinks")` |
| **Orphans / Unresolved** | ❌ Нет endpoint | `cli_orphans`, `cli_unresolved` |
| **Dataview DQL** | ❌ Нет endpoint | `cli_eval("DataviewAPI.query(...)")` |
| **Canvas read/write** | ⚠️ Частично (как JSON файл) | `read_file("file.canvas")` |
| **Plugin management** | ❌ Нет endpoint | `cli_plugin` |
| **Workspace layouts** | ❌ Нет endpoint | Не реализовано |
| **DevTools** | ❌ Нет endpoint | Не реализовано |
| **Sync** | ❌ Нет endpoint | Не реализовано |
| **Daily notes** | ❌ Нет endpoint | `cli_daily` |

---

## 4. Интеграция с Extended MCP

```typescript
// src/layer2b/RestBridge.ts

class RestBridge implements ILayer2bRestBridge {
  private baseUrl: string;
  private token: string;

  constructor(config: { restApiUrl: string; restApiToken: string }) {
    this.baseUrl = config.restApiUrl.replace(/\/$/, '');
    this.token = config.restApiToken;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async activeNote(): Promise<Note | null> {
    const res = await fetch(`${this.baseUrl}/active/`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async executeDataview(query: string): Promise<any> {
    // Dataview НЕ поддерживается REST API напрямую
    // Fallback: используем CLI eval
    throw new Error('Dataview not supported via REST API. Use cli_eval.');
  }

  async triggerCommand(name: string): Promise<void> {
    // Команды имеют ID, а не display name
    // Нужна маппинг name → id
    const commandId = await this.resolveCommandId(name);
    const res = await fetch(`${this.baseUrl}/commands/${commandId}/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`Command failed: ${res.statusText}`);
  }

  private async resolveCommandId(name: string): Promise<string> {
    // CLI: app.commands.commands имеет маппинг id → name
    // Но REST API не даёт список команд
    // Решение: захардкодить часто используемые или использовать CLI для резолва
    const common: Record<string, string> = {
      'Export PDF': 'workspace:export-pdf',
      'Graph View': 'graph:open-local',
    };
    return common[name] || name; // fallback: предполагаем, что передан ID
  }
}
```

---

## 5. Troubleshooting

### 5.1. Self-signed certificate error

**Ошибка:** `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

**Решения:**
```bash
# Вариант A: отключить проверку (только для localhost)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Вариант B: использовать HTTP endpoint (если включён в настройках плагина)
REST_API_URL=http://127.0.0.1:27123

# Вариант C: добавить сертификат в trust store
```

### 5.2. Connection refused

**Причины:**
- Obsidian не запущен
- Плагин Local REST API не включён
- Порт занят другим процессом

**Проверка:**
```bash
lsof -i :27124  # macOS/Linux
netstat -ano | findstr 27124  # Windows
```

### 5.3. 401 Unauthorized

**Причина:** Неверный или отсутствующий API Key.

**Решение:** Проверить `Authorization: Bearer <token>` заголовок.

---

*Справочник составлен на основе документации Local REST API plugin и архитектурных спецификаций Extended MCP.*
