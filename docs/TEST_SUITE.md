v0.2b: 
# Тестовый набор — Obsidian Extended MCP

> **Версия:** 2.11.0  
> **Дата:** 2026-05-27  
> **Область:** Test vault fixture, тестовые сценарии, ожидаемые результаты, checklists  
> **Язык:** Русский

---

## 1. Тестовый Vault Fixture

### 1.1. Структура

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
│   ├── system-prompt-obsidian.md
│   └── templates/
│       ├── source.md
│       ├── concept.md
│       └── session.md
└── attachments/
    └── images/
        └── diagram.png
```

### 1.2. Содержимое тестовых файлов

**`raw/2026-05-20-article-transformers.md`:**
```markdown
---
title: "Статья про Transformers"
date: 2026-05-20
tags: [source, ai, ml]
sources: ["https://arxiv.org/abs/1706.03762"]
---

# Attention Is All You Need

## Ключевые идеи
1. Архитектура transformer заменяет RNN и CNN
2. Механизм self-attention позволяет параллельную обработку
3. Модель BERT построена на transformers

## Открытые вопросы
- Как transformers работают с изображениями?
- Можно ли уменьшить размер модели без потери качества?

## Связанные концепции
- [[neural-networks]] — базовая архитектура
- [[attention-mechanism]] — ключевой компонент
```

**`concepts/neural-networks.md`:**
```markdown
---
title: "Neural Networks"
date: 2026-05-15
tags: [concept, ai, ml]
sources: [[raw/2026-05-15-intro-to-nn.md]]
status: evergreen
---

# Neural Networks

> Вычислительные системы, вдохновлённые биологическими нейронами.

## Суть
Нейронные сети состоят из слоёв нейронов, соединённых весами. Обучение происходит через корректировку весов на основе ошибки.

## Связи
- [[backpropagation|Backpropagation]] — алгоритм обучения
- [[gradient-descent|Gradient Descent]] — оптимизация
- [[transformers|Transformers]] — современная архитектура
```

**`index/MOC-ai.md`:**
```markdown
---
title: "MOC: Artificial Intelligence"
date: 2026-05-15
tags: [moc, ai]
---

# Map of Content: AI

## Основные концепции
- [[neural-networks]] — основа современного AI
- [[backpropagation]] — как учатся нейросети
- [[attention-mechanism]] — ключевой компонент transformers

## Источники
- [[raw/2026-05-20-article-transformers.md|Attention Is All You Need]]
```

### 1.3. Ожидаемые метрики графа

| Метрика | Значение |
|---------|----------|
| Nodes | 7 (3 raw + 3 concepts + 1 MOC) |
| Edges | 9 (forward links) |
| Backlinks для neural-networks | 3 (backpropagation, attention-mechanism, MOC-ai) |
| Orphans | 2 (meeting-notes, inbox-thought — нет входящих ссылок) |
| Deadends | 0 (все concepts имеют outbound links) |
| Unresolved | 1 (`[[gradient-descent]]` в neural-networks.md — файла нет) |

---

## 2. Тестовые сценарии

### SC-01: Ingest raw → structured source

**Вход:** `raw/2026-05-20-article-transformers.md`
**Действие:** `ai_ingest(raw_path="raw/2026-05-20-article-transformers.md")`

**Ожидаемый результат:**
- Файл остаётся на месте (или обновляется frontmatter)
- Создан `concepts/transformers.md` (если auto_compile=true)
- Теги: `[concept, ai, ml]`
- Минимум 3 wikilinks
- Ссылки на `[[neural-networks]]`, `[[attention-mechanism]]`

**Проверки:**
- [x] `read_note("concepts/transformers.md")` возвращает файл
- [x] Frontmatter содержит `tags: [concept, ai, ml]`
- [x] Содержимое включает «3 ключевые идеи»
- [x] Содержимое включает «Открытые вопросы»
- [x] Минимум 3 `[[wikilinks]]`

---

### SC-02: Compile → обновление MOC

**Вход:** 3 новых raw-файла
**Действие:** `ai_compile(since_days=7)`

**Ожидаемый результат:**
- Созданы/обновлены concepts для каждого raw
- Обновлён `index/MOC-ai.md` — добавлены новые концепции
- Orphans = 0 (все новые concepts связаны)

**Проверки:**
- [x] `index/MOC-ai.md` содержит ссылки на новые concepts
- [x] `graph_neighbors("MOC-ai", depth=1)` возвращает ≥5 nodes
- [x] `cli_orphans()` (если CLI доступен) возвращает пустой список

---

### SC-03: Backlinks через CLI и FS

**Вход:** `"concepts/neural-networks.md"`
**Действие:**
1. `cli_backlinks(path="concepts/neural-networks.md")` (если CLI доступен)
2. `cli_backlinks(path="concepts/neural-networks.md")` (filesystem fallback)

**Ожидаемый результат (CLI):**
- 3 backlinks: `concepts/backpropagation.md`, `concepts/attention-mechanism.md`, `index/MOC-ai.md`
- Точность: 100%

**Ожидаемый результат (FS fallback):**
- ≥2 backlinks (может пропустить alias)
- Точность: >90%

**Проверки:**
- [x] CLI результат содержит 3 sources
- [x] FS результат содержит `backpropagation.md` и `MOC-ai.md`
- [x] Dispatcher использует CLI layer, если доступен

---

### SC-04: Patch note — хирургическое редактирование

**Вход:** `concepts/neural-networks.md`
**Действие:** `patch_note(path="concepts/neural-networks.md", target="## Суть", operation="append", content="\n## Применения\nТрансформеры используются в NLP, CV и рекомендательных системах.")`

**Ожидаемый результат:**
- Добавлен раздел `## Применения` после `## Суть`
- Остальное содержимое неизменно
- Backup создан: `concepts/neural-networks.md.bak`

**Проверки:**
- [x] `read_note` показывает новый раздел
- [x] Раздел `## Связи` остался на месте
- [ ] `.bak` файл существует (не реализовано в VaultManager)

---

### SC-05: Lint vault

**Действие:** `dream_scan(kinds=['prune'])`

**Ожидаемый результат:**
- 1 unresolved: `[[gradient-descent]]` в `neural-networks.md`
- 2 orphans: `meeting-notes.md`, `inbox-thought.md`
- 0 deadends

**Проверки:**
- [x] Lint report содержит `gradient-descent` как unresolved
- [x] Lint report содержит 2 orphans
- [ ] Если `fix=true` — предложены правки для orphans (найти связи)

---

### SC-06: Query & Enhance

**Вход:** Вопрос: "Объясни трансформеры"
**Действие:** `ai_query(user_query="Объясни трансформеры")`

**Ожидаемый результат:**
- Ответ основан на `concepts/attention-mechanism.md`, `raw/2026-05-20-article-transformers.md`
- Цитаты в формате `[[...]]`
- Suggested edits содержат ≥1 правку

**Проверки:**
- [x] Ответ содержит `[[attention-mechanism]]` или `[[raw/2026-05-20-article-transformers.md]]`
- [x] `suggestedEdits` не пустой
- [ ] Создан `sessions/2026-05-27-...md` (file-back)

---

### SC-07: Move note + обновление ссылок

**Вход:** `concepts/neural-networks.md` → `concepts/neural-nets.md`
**Действие:** `fs_move_note(from="concepts/neural-networks.md", to="concepts/neural-nets.md")`

**Ожидаемый результат (CLI):**
- Файл перемещён
- Все `[[neural-networks]]` обновлены до `[[neural-nets]]`
- metadataCache обновлён

**Ожидаемый результат (FS fallback):**
- Файл перемещён
- ripgrep нашёл и заменил `[[neural-networks]]` во всех файлах
- Graph Engine обновлён

**Проверки:**
- [x] `read_note("concepts/neural-nets.md")` работает
- [x] `read_note("concepts/neural-networks.md")` возвращает E101
- [ ] `backpropagation.md` содержит `[[neural-nets]]` (а не `[[neural-networks]]`)

---

### SC-08: Semantic search

**Предусловие:** `build_index()` выполнен
**Вход:** "machine learning"
**Действие:** `semantic_search(query="machine learning", top_k=5)`

**Ожидаемый результат:**
- Top-3 включают `concepts/neural-networks.md`
- Релевантность > 0.5

**Проверки:**
- [x] Результат содержит `neural-networks.md`
- [x] BM25 + Semantic RRF fusion работает (если гибридный поиск включён)

---

## 3. Автоматизированные тесты

### 3.1. Unit Tests

```typescript
// tests/unit/GraphEngine.test.ts
describe('GraphEngine', () => {
  test('getNeighbors BFS depth=1', async () => {
    const graph = await engine.getNeighbors('concepts/neural-networks.md', 1, 'both');
    expect(Object.keys(graph.nodes)).toHaveLength(4); // self + 3 neighbors
  });

  test('findPath exists', () => {
    const path = engine.findPath('index/MOC-ai.md', 'concepts/backpropagation.md');
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(2);
  });

  test('PageRank ranks MOC highest', () => {
    const ranks = engine.computePageRank();
    expect(ranks['index/MOC-ai.md']).toBeGreaterThan(ranks['raw/2026-05-20-article-transformers.md']);
  });
});

// tests/unit/Dispatcher.test.ts
describe('Dispatcher', () => {
  test('cli_backlinks uses CLI when available', async () => {
    const result = await dispatcher.dispatch('cli_backlinks', { path: 'concept.md' });
    expect(result.meta.layer).toBe('cli');
  });

  test('cli_backlinks falls back to filesystem', async () => {
    cliBridge.available = false;
    const result = await dispatcher.dispatch('cli_backlinks', { path: 'concept.md' });
    expect(result.meta.layer).toBe('filesystem');
    expect(result.meta.fallbackUsed).toBe(true);
  });
});

// tests/unit/SecurityEngine.test.ts
describe('SecurityEngine', () => {
  test('cli_eval requires level 5', () => {
    expect(engine.getRequiredLevel('cli_eval', {})).toBe(5);
  });

  test('read-only blocks write', () => {
    const roEngine = new SecurityEngine({ readOnly: true, enableCommands: false, allowedPaths: [], blockedPaths: [] });
    expect(() => roEngine.getRequiredLevel('fs_write_note', {})).toThrow('read-only');
  });
});
```

### 3.2. Integration Tests

```typescript
// tests/integration/Pipeline.test.ts
describe('Karpathy Pipeline', () => {
  test('full cycle: ingest → compile → lint', async () => {
    const conceptPath = await pipeline.ingest('raw/2026-05-20-article-transformers.md');
    expect(conceptPath).toMatch(/concepts\/.*\.md/);

    const compileResult = await pipeline.compile(7);
    expect(compileResult.newConcepts.length).toBeGreaterThanOrEqual(1);

    const lintReport = await pipeline.lint(false);
    expect(lintReport.critical).toHaveLength(0);
  });
});
```

### 3.3. E2E Tests

#### 3.3.1. Cross-Reference Integrity: `(SPEC tools) ⊆ (interfaces.keys)`

```typescript
// test/e2e/cross-reference.spec.ts
import { SPEC_TOOLS } from './spec-tools'; // 44 tool names from SPEC §6.1
import { TOOL_METHOD_MAP } from '../src/Dispatcher';

describe('Cross-Reference Integrity', () => {
  it('every SPEC tool has a mapped interface method', () => {
    for (const toolName of SPEC_TOOLS) {
      const method = TOOL_METHOD_MAP[toolName];
      expect(method).toBeDefined();
      expect(typeof method).toBe('string');
    }
  });

  it('every mapped method exists on at least one layer interface', () => {
    const allMethods = new Set([
      ...Object.getOwnPropertyNames(ILayer1Filesystem.prototype),
      ...Object.getOwnPropertyNames(ILayer2CliBridge.prototype),
      ...Object.getOwnPropertyNames(ILayer2bRestBridge.prototype),
      ...Object.getOwnPropertyNames(ILayer3Pipeline.prototype),
      ...Object.getOwnPropertyNames(ILayer4Semantic.prototype),
    ]);
    for (const toolName of SPEC_TOOLS) {
      const method = TOOL_METHOD_MAP[toolName];
      // Fallback: toCamelCase stripping prefix
      const fallback = toolName
        .replace(/^(fs_|cli_|rest_|pipeline_|semantic_)/, '')
        .replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      expect(
        allMethods.has(method) || allMethods.has(fallback)
      ).toBe(true);
    }
  });
});
```

#### 3.3.2. Full CLI Cycle

```bash
# E2E: полный цикл через CLI
node dist/index.js << 'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ai_ingest","arguments":{"raw_path":"raw/2026-05-20-article-transformers.md"}}}
EOF
```

---

## 4. Performance Tests

| Метрика | Минимум | Цель | Как измерить |
|---------|---------|------|--------------|
| Graph build (1K notes) | < 1s | < 500ms | `time fs_get_graph()` |
| Graph build (10K notes) | < 5s | < 2s | `time fs_get_graph()` |
| BM25 search (10K) | < 500ms | < 100ms | `time search_notes("transformer")` |
| Backlinks CLI | < 50ms | < 20ms | `time cli_backlinks()` |
| Backlinks FS fallback (10K) | < 2s | < 1s | `time cli_backlinks()` |
| Ingest | < 5s | < 1s | `time ai_ingest()` |
| Compile (100 raw) | < 30s | < 10s | `time ai_compile(7)` |

---

## 5. Чеклист перед релизом

### MVP (Layer 1 + 2)
- [ ] SC-01 (Ingest) проходит
- [ ] SC-03 (Backlinks) проходит для CLI и FS
- [ ] SC-04 (Patch) проходит
- [ ] SC-05 (Lint) проходит
- [ ] Unit tests для GraphEngine, Dispatcher, SecurityEngine проходят
- [ ] Все P0 требования из SPECIFICATION реализованы

### v1.0 (Все слои)
- [ ] SC-02 (Compile + MOC) проходит
- [ ] SC-06 (Query) проходит
- [ ] SC-07 (Move) проходит
- [ ] SC-08 (Semantic) проходит
- [ ] Integration tests для Pipeline проходят
- [ ] Performance tests достигают целевых метрик
- [ ] npm install -g проходит без ошибок
- [ ] CI/CD pipeline (GitHub Actions) проходит

---

*Тестовый набор составлен на основе test-fixture-and-roadmap-v1.6.md и архитектурных спецификаций.*
