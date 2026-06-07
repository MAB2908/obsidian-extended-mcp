v0.2b: 
# Справочник Obsidian CLI — Extended MCP

> **Версия:** 0.1b  
> **Дата:** 2026-05-27  
> **Область:** Полный реестр команд официального CLI Obsidian, примеры вывода, парсинг, интеграция с MCP

---

## 1. Общие сведения

### 1.1. Что такое Obsidian CLI

Официальный интерфейс командной строки Obsidian (доступен с версии **Obsidian 1.12+**) позволяет взаимодействовать с запущенным приложением Obsidian через IPC (Inter-Process Communication). CLI исполняет JavaScript-код внутри контекста Electron-приложения, получая прямой доступ к внутренним API: `app`, `workspace`, `metadataCache`, `fileManager` и плагинам.

### 1.2. Установка и доступность

```bash
# Проверить наличие CLI
which obsidian

# Проверить версию
obsidian --version
# Вывод: 1.0.0

# Проверить доступность IPC (Obsidian запущен?)
obsidian vault
# Вывод: JSON с информацией об активном vault
```

**Пути по умолчанию:**
| Платформа | Путь к бинарнику |
|-----------|-----------------|
| macOS | `/Applications/Obsidian.app/Contents/MacOS/obsidian` |
| Windows | `%LOCALAPPDATA%\Obsidian\obsidian.exe` |
| Linux | `/usr/bin/obsidian` или `~/.local/bin/obsidian` |

### 1.3. Архитектура IPC

```
MCP Server → child_process.spawn('obsidian', [command, args])
                  ↓
            IPC сокет / stdout
                  ↓
         Obsidian (Electron)
                  ↓
         metadataCache, app.workspace, plugins
```

**Важно:** CLI работает только когда Obsidian **запущен**. Если Obsidian закрыт — все команды возвращают `ECONNREFUSED` или `ENOENT`.

---

## 2. Полный реестр команд

### 2.1. Команды vault и системные

#### `obsidian vault` — Информация об активном vault

**Назначение:** Проверка доступности CLI и получение метаданных vault.

**Пример вызова:**
```bash
obsidian vault
```

**Пример вывода (JSON):**
```json
{
  "path": "/Users/alice/Documents/MyVault",
  "name": "MyVault",
  "version": "1.12.0",
  "pluginCount": 15,
  "noteCount": 1247
}
```

#### `obsidian version` — Версия Obsidian и CLI

**Пример вывода:**
```
Obsidian: 1.12.0
CLI: 1.0.0
Electron: 28.0.0
```

---

### 2.2. Команды eval (выполнение JavaScript)

#### `obsidian eval "<code>"` — Выполнить JS в контексте Obsidian

**Назначение:** Универсальная команда для доступа к любому внутреннему API Obsidian.

**Примеры:**

```bash
# Получить путь к активной заметке
obsidian eval "app.workspace.getActiveFile()?.path"
# Вывод: "concepts/neural-networks.md"

# Получить список всех файлов
obsidian eval "JSON.stringify(app.vault.getMarkdownFiles().map(f => f.path))"
# Вывод: ["raw/1.md", "concepts/2.md", ...]

# Выполнить Dataview DQL
obsidian eval "JSON.stringify(DataviewAPI.query('TABLE tags FROM #concept'))"
# Вывод: { values: [...], headers: [...] }

# Получить resolvedLinks (полный граф)
obsidian eval "JSON.stringify(app.metadataCache.resolvedLinks)"
# Вывод: { "note1.md": { "note2.md": 1, "note3.md": 2 } }

# Получить backlinks
obsidian eval "JSON.stringify(app.metadataCache.getBacklinksForFile(app.vault.getAbstractFileByPath('concept.md'))?.data)"
# Вывод: { "source1.md": [{ "position": { "start": { "line": 5 } } }] }

# Получить список плагинов
obsidian eval "JSON.stringify(Object.keys(app.plugins.plugins))"
# Вывод: ["dataview", "templater", "periodic-notes"]

# Сделать скриншот
obsidian eval "app.commands.executeCommandById('workspace:export-pdf')"
```

**MCP Tool:** `cli_eval`

**JSON Schema input:**
```json
{ "code": "app.workspace.getActiveFile().path" }
```

**Парсинг:** JSON (primary), plain text (fallback)

**Таймаут:** 5000ms (простые запросы), 30000ms (сложные/batch)

---

### 2.3. Команды навигации и поиска

#### `obsidian search "query"` — Нативный поиск Obsidian

**Назначение:** Быстрый полнотекстовый поиск через движок Obsidian (быстрее regex по всем файлам).

**Пример вызова:**
```bash
obsidian search "neural network"
```

**Пример вывода:**
```
- concepts/neural-networks.md:12
  Context: ...neural network architecture...
- raw/article-transformers.md:45
  Context: ...neural network based on attention...
```

**MCP Tool:** `cli_search`

---

#### `obsidian backlinks file="note-name"` — Обратные ссылки

**Назначение:** Получить реальные backlinks из `metadataCache` (O(1), 100% точность).

**Пример вызова:**
```bash
obsidian backlinks file="neural-networks"
```

**Пример вывода (JSON с флагом --json):**
```json
{
  "backlinks": [
    { "source": "concepts/backpropagation.md", "line": 12, "context": "See also [[neural-networks]]" },
    { "source": "index/MOC-ai.md", "line": 5, "context": "- [[neural-networks|Neural Networks]]" }
  ]
}
```

**Пример вывода (plain text):**
```
Backlinks for "neural-networks":
- from concepts/backpropagation.md:12
  Context: See also [[neural-networks]]
- from index/MOC-ai.md:5
  Context: - [[neural-networks|Neural Networks]]
```

**MCP Tool:** `cli_backlinks`

---

#### `obsidian orphans` — Заметки без входящих ссылок

**Назначение:** Найти все orphan-заметки (нет backlinks).

**Пример вывода:**
```
Orphan notes (no incoming links):
- raw/draft-idea.md
- concepts/lonely-concept.md
```

**MCP Tool:** `cli_orphans`

---

#### `obsidian unresolved` — Битые ссылки

**Назначение:** Найти все wikilinks, указывающие на несуществующие заметки.

**Пример вывода:**
```
Unresolved links:
- [[old-concept-name]] in raw/article.md:12
- [[todo-list]] in concepts/project.md:34
```

**MCP Tool:** `cli_unresolved`

---

#### `obsidian deadends` — Заметки без исходящих ссылок

**Назначение:** Найти заметки, которые никуда не ссылаются.

**Пример вывода:**
```
Dead-end notes (no outgoing links):
- concepts/island.md
- raw/unlinked.md
```

**MCP Tool:** `cli_deadends`

---

### 2.4. Команды свойств (frontmatter)

#### `obsidian property:read file="note" property="name"` — Чтение свойства

**Пример вызова:**
```bash
obsidian property:read file="neural-networks" property="tags"
```

**Пример вывода:**
```
- tags: ["concept", "ai", "ml"]
```

---

#### `obsidian property:set file="note" property="name" value="..."` — Запись свойства

**Пример вызова:**
```bash
obsidian property:set file="neural-networks" property="status" value="evergreen"
```

---

#### `obsidian property:remove file="note" property="name"` — Удаление свойства

**MCP Tool:** `cli_properties` (единый инструмент с action: read/set/remove/list)

---

#### `obsidian properties file="note"` — Список всех свойств

**Пример вывода:**
```
Properties for "neural-networks":
- title: "Neural Networks"
- date: "2026-05-15"
- tags: ["concept", "ai"]
```

---

### 2.5. Команды заметок

#### `obsidian daily` — Текущая ежедневная заметка

**Назначение:** Получить путь к daily note (требует плагин Daily Notes или Periodic Notes).

**Пример вывода:**
```
Daily note: /Users/alice/Documents/MyVault/daily/2026-05-27.md
```

---

#### `obsidian daily:append "content"` — Добавить в daily note

**Пример вызова:**
```bash
obsidian daily:append "## 14:30 Встреча с командой\n- Обсудили roadmap"
```

---

#### `obsidian daily:prepend "content"` — Вставить в начало daily note

**MCP Tool:** `cli_daily` (action: read/append/prepend)

---

### 2.6. Команды плагинов

#### `obsidian plugin:list` — Список всех плагинов

**Пример вывода:**
```
Installed plugins:
- dataview (enabled)
- templater (enabled)
- periodic-notes (disabled)
- excalidraw (enabled)
```

---

#### `obsidian plugin:enabled` — Список активных плагинов

**Пример вывода (JSON):**
```json
["dataview", "templater", "excalidraw"]
```

---

#### `obsidian plugin:enable "plugin-id"` — Включить плагин

---

#### `obsidian plugin:disable "plugin-id"` — Отключить плагин

---

#### `obsidian plugin:reload "plugin-id"` — Перезагрузить плагин

**Назначение:** Применить изменения без перезапуска Obsidian (критично для разработки).

**MCP Tool:** `cli_plugin` (action: enable/disable/list)

---

### 2.7. Команды workspace

#### `obsidian workspace:save "name"` — Сохранить layout

---

#### `obsidian workspace:load "name"` — Загрузить layout

---

#### `obsidian workspace:delete "name"` — Удалить layout

---

#### `obsidian workspace:list` — Список сохранённых layouts

---

### 2.8. Команды синхронизации

#### `obsidian sync` — Запустить Obsidian Sync

**Назначение:** Форсировать синхронизацию (полезно после batch-операций).

**Пример вывода:**
```json
{ "status": "syncing", "filesRemaining": 12 }
```

---

#### `obsidian sync:status` — Статус синхронизации

**Пример вывода:**
```json
{ "status": "complete", "lastSync": "2026-05-27T01:00:00Z" }
```

---

### 2.9. DevTools

#### `obsidian dev:screenshot` — Скриншот окна Obsidian

**Назначение:** Получить base64-изображение текущего состояния UI.

**Пример вывода:**
```json
{ "format": "png", "data": "iVBORw0KGgoAAAANSUhEUgAA..." }
```

---

#### `obsidian dev:dom` — Инспекция DOM

**Пример вызова:**
```bash
obsidian dev:dom --selector=".markdown-preview-view"
```

---

#### `obsidian dev:errors` — Последние ошибки консоли

**Пример вывода:**
```
- [14:30:12] TypeError: Cannot read property 'path' of null
  at eval (plugin:dataview:1234)
```

---

#### `obsidian dev:css` — Инспекция CSS

---

#### `obsidian dev:cdp` — Chrome DevTools Protocol

**Назначение:** Низкоуровневый доступ к CDP для продвинутой автоматизации.

---

### 2.10. Команды командной палитры

#### `obsidian command "Command Name"` — Выполнить команду из палитры

**Примеры:**
```bash
obsidian command "Graph view: Open local graph"
obsidian command "Templater: Insert template"
obsidian command "Dataview: Force refresh all views"
```

**MCP Tool:** `cli_command`

---

### 2.11. Команды tags

#### `obsidian tags` — Список всех тегов

---

#### `obsidian tags:counts` — Частота тегов

**Пример вывода (JSON):**
```json
{
  "ai": 45,
  "ml": 23,
  "concept": 120,
  "source": 89
}
```

---

## 3. Матрица команд → MCP Tools

| MCP Tool | CLI Command | Парсер | Таймаут | Fallback |
|----------|-------------|--------|---------|----------|
| `cli_eval` | `eval "..."` | JSON | 5000ms | — |
| `cli_backlinks` | `backlinks file="X"` | JSON/Plain | 2000ms | `graph_neighbors` |
| `cli_orphans` | `orphans` | Plain | 5000ms | `fs_get_graph` + filter |
| `cli_unresolved` | `unresolved` | Plain | 5000ms | `fs_get_graph` + validate |
| `cli_deadends` | `deadends` | Plain | 5000ms | `fs_get_graph` + filter |
| `cli_properties` | `property:read/set/remove` | Table/Plain | 2000ms | `read_note` + YAML |
| `cli_search` | `search "..."` | Plain | 10000ms | `search_notes` |
| `cli_daily` | `daily` / `daily:append` | Plain | 2000ms | — |
| `cli_command` | `command "..."` | JSON | 5000ms | — |
| `cli_plugin` | `plugin:list/enable/disable` | Table/JSON | 3000ms | — |

---

## 4. Парсинг вывода CLI

### 4.1. JSON Parser (Primary)

```javascript
class JsonParser {
  parse(stdout, command) {
    try {
      const data = JSON.parse(stdout);
      return this._normalize(data, command);
    } catch (e) {
      throw new ParseError(`Invalid JSON from ${command}: ${e.message}`);
    }
  }

  _normalize(data, command) {
    switch (command) {
      case 'eval':
        return { result: data, type: 'any' };
      case 'backlinks':
        return {
          backlinks: (data.backlinks || []).map(b => ({
            source: b.source,
            line: b.line || null,
            context: b.context || null,
          }))
        };
      case 'tags counts':
        return {
          tags: Object.entries(data).map(([tag, count]) => ({ tag, count }))
        };
      default:
        return data;
    }
  }
}
```

### 4.2. Plain Text Parser (Fallback)

```javascript
class PlainTextParser {
  parse(stdout, command) {
    const parsers = {
      orphans: this._parseList,
      unresolved: this._parseUnresolved,
      deadends: this._parseList,
      backlinks: this._parseBacklinks,
      properties: this._parseProperties,
    };

    const parser = parsers[command];
    if (!parser) {
      return { raw: stdout, lines: stdout.split('\n').filter(l => l.trim()) };
    }
    return parser(stdout);
  }

  _parseList(stdout) {
    const lines = stdout.split('\n');
    const items = lines.filter(l => l.startsWith('- ')).map(l => l.replace('- ', '').trim());
    return { items };
  }

  _parseUnresolved(stdout) {
    const lines = stdout.split('\n');
    const links = lines
      .filter(l => l.includes('[['))
      .map(l => {
        const match = l.match(/\[\[(.*?)\]\].*in\s+(.*?):(\d+)/);
        return match ? { link: match[1], source: match[2], line: parseInt(match[3]) } : null;
      })
      .filter(Boolean);
    return { unresolved: links };
  }

  _parseBacklinks(stdout) {
    const lines = stdout.split('\n');
    const backlinks = [];
    let current = null;

    for (const line of lines) {
      if (line.startsWith('- from ')) {
        if (current) backlinks.push(current);
        const match = line.match(/- from\s+(.*?):(\d+)/);
        current = { source: match[1], line: parseInt(match[2]), context: '' };
      } else if (line.startsWith('  Context:') && current) {
        current.context = line.replace('  Context:', '').trim();
      }
    }
    if (current) backlinks.push(current);
    return { backlinks };
  }

  _parseProperties(stdout) {
    const lines = stdout.split('\n');
    const props = {};
    for (const line of lines) {
      const match = line.match(/^-\s+(.*?):\s+(.*)$/);
      if (match) props[match[1]] = match[2];
    }
    return { properties: props };
  }
}
```

### 4.3. Auto-Detection

```javascript
class AutoParser {
  parse(stdout, command) {
    try {
      const data = JSON.parse(stdout);
      return { format: 'json', data };
    } catch (e) {
      if (stdout.includes('|') && stdout.includes('\n')) {
        return { format: 'table', data: tableParser.parse(stdout) };
      }
      return { format: 'plain', data: plainTextParser.parse(stdout, command) };
    }
  }
}
```

---

## 5. Обработка ошибок CLI

### 5.1. Коды выхода

| Код | Значение | Действие MCP |
|-----|----------|--------------|
| 0 | Success | Парсить результат |
| 1 | General error | Логировать, fallback на FS |
| 2 | Command not found | Логировать, проверить версию CLI |
| 3 | Vault not found | Остановить, запросить путь |
| 4 | Permission denied | Остановить, проверить права |
| 5 | Timeout | Retry с backoff |
| 130 | Interrupted (Ctrl+C) | Игнорировать, retry |

### 5.2. Таймауты

| Команда | Таймаут | Причина |
|---------|---------|---------|
| `eval` (simple) | 5000ms | Быстрые запросы |
| `eval` (complex) | 30000ms | Dataview, batch |
| `backlinks` | 2000ms | O(1) из metadataCache |
| `orphans` | 5000ms | Перестройка графа |
| `unresolved` | 5000ms | Перестройка графа |
| `search` | 10000ms | Поиск по vault |
| `sync` | 30000ms | Сетевая операция |
| `screenshot` | 10000ms | Рендеринг UI |

---

## 6. Совместимость версий

| Obsidian | CLI | MCP Compatibility |
|----------|-----|-------------------|
| 1.12+ | 1.0+ | Full (все команды) |
| 1.10–1.11 | 0.9+ | Partial (нет devtools) |
| < 1.10 | — | CLI unavailable → FS only |

```javascript
async function checkCompatibility() {
  try {
    const version = await cliBridge.eval('app.version');
    const [major, minor] = version.split('.').map(Number);
    if (major < 1 || (major === 1 && minor < 12)) {
      return { compatible: false, reason: 'version_too_old', recommended: '1.12.0' };
    }
    return { compatible: true, version };
  } catch (e) {
    return { compatible: false, reason: 'cli_unavailable', fallback: 'filesystem' };
  }
}
```

---

## 7. Примеры сложных сценариев

### 7.1. Pipeline: получить активную заметку → её backlinks → теги всех backlinks

```javascript
// Шаг 1: Активная заметка
const activePath = await cli_eval("app.workspace.getActiveFile().path");

// Шаг 2: Backlinks
const { backlinks } = await cli_backlinks({ path: activePath });

// Шаг 3: Для каждого backlink — прочитать теги (Layer 1 FS)
const enriched = await Promise.all(
  backlinks.map(async b => {
    const note = await read_note({ path: b.source });
    return { ...b, tags: note.frontmatter.tags };
  })
);
```

### 7.2. Pipeline: lint vault через CLI

```javascript
// Параллельно:
const [unresolved, orphans, deadends] = await Promise.all([
  cli_unresolved(),
  cli_orphans(),
  cli_deadends()
]);

// Формируем отчёт
const report = {
  critical: unresolved.unresolved,
  warnings: [...orphans.items, ...deadends.items],
  generatedAt: new Date().toISOString()
};
```

---

*Справочник составлен на основе аудита 52 MCP-реализаций и документации официального Obsidian CLI.*
