v0.2b: 
# Быстрый старт — Obsidian Extended MCP (AI-first)

> **Версия:** 0.2b  
> **Время:** 5 минут до первого запроса  
> **Требования:** Node.js 22+, LLM API key или Ollama (локально)  
> **Философия:** AI управляет всем циклом знаний — от сырых заметок до связанной базы знаний

---

## 1. Установка

```bash
npm install -g obsidian-extended-mcp
```

Или локально из исходников:
```bash
cd /path/to/obsidian-extended-mcp
node dist/index.js
```

### 1.1. Настройка LLM (обязательно)

Создайте `.env` в корне проекта (или рабочей директории):

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LLM_PROVIDER=openai
```

**Принцип:** Лёгкие задачи (tag, link) → Ollama (быстро, бесплатно, приватно). Сложные задачи (compile, query) → GPT-4/Claude (качественно).

### 1.2. Или через wizard (рекомендуется)

```bash
npx obsidian-extended-mcp init-llm
```

Wizard создаёт `.env` с дефолтными значениями:
1. Проверяет существующий `.env`
2. Добавляет `OPENAI_API_KEY=your-key-here`
3. Сохраняет в текущей директории

---

## 2. Конфигурация MCP-клиента

### Claude Desktop

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": [
        "/path/to/obsidian-extended-mcp/dist/index.js"
      ],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/Users/you/Documents/Obsidian Vault"
      }
    }
  }
}
```

### Kimi CLI

`~/.kimi/mcp.json`:
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/obsidian-extended-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/vault"
      }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/obsidian-extended-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/vault"
      }
    }
  }
}
```

---

## 3. Генерация meta-файлов (если их нет)

MCP ожидает структуру в `meta/` для контекста LLM. Создайте автоматически:

```bash
npx obsidian-extended-mcp init-meta --path /path/to/vault
```

Или вручную:
```bash
mkdir -p /path/to/vault/meta
cat > /path/to/vault/meta/ontology.md << 'EOF'
# Онтология хранилища

## Разрешённые теги
- concept — постоянные заметки (минимум 3 ссылки)
- source — сырые входные данные
- session — логи взаимодействия с LLM

## Правила папок
- raw/ — входные данные
- concepts/ — постоянные заметки
- index/ — MOC и индексы
- sessions/ — логи
EOF

cat > /path/to/vault/meta/protocol.md << 'EOF'
# Протокол работы

## Фазы конвейера
1. **Ingest** — преобразовать raw/ в структурированные source
2. **Compile** — синтезировать concepts/ из source (минимум 3 ссылки)
3. **Query** — отвечать с цитатами [[...]]
4. **Lint** — проверять сироты и мёртвые ссылки
EOF

cat > /path/to/vault/meta/link-rules.md << 'EOF'
# Правила ссылок

- Использовать викиссылки: [[Note Name]]
- Псевдонимы: [[Note Name|Display Text]]
- MOC-заметки начинать с #moc
EOF
```

---

## 4. Проверка

```bash
# Проверить, что MCP видит vault
npx obsidian-extended-mcp check --path /path/to/vault

# Ожидаемый вывод:
# ✓ Vault: 127 заметок, 42 тега, 3 MOC
# ✓ meta/ontology.md — найден
# ✓ meta/protocol.md — найден
# ✓ meta/link-rules.md — найден
# ✓ Obsidian CLI — доступен (опционально)
```

---

## 5. Первый запрос (AI в действии)

### 5.1. Автоматический pipeline (AI работает за вас)

Положите сырые заметки в `raw/` и скажите:

> «Переработай мои сырые заметки»

AI автоматически:
1. **IngestAgent** — прочитает `raw/`, извлечёт сущности, создаст структурированные источники в `source/`
2. **CompileAgent** — синтезирует концепции в `concepts/`, обновит MOC
3. **LinkAgent** — найдёт несвязанные упоминания, предложит wikilinks
4. **TagAgent** — классифицирует по онтологии
5. **LintAgent** — проверит здоровье хранилища

Всё это происходит **автоматически** по единым правилам, независимо от модели.

### 5.2. Запрос к знаниям

> «Найди заметки про нейронные сети и объясни, как они связаны с backpropagation»

MCP автоматически:
1. **QueryAgent** — поищет по смыслу через BM25 + эмбеддинги + граф
2. Найдёт 3-5 релевантных заметок
3. Построит контекст из ваших знаний
4. Ответит с цитатами `[[...]]`

### 5.3. Прозрачность (почему AI так решил?)

Каждое AI-действие логируется:
```
[IngestAgent] processed raw/article.md | model=ollama/llama3.1:8b | confidence=0.92 | tokens=1,247 | latency=340ms
[CompileAgent] created concepts/transformer.md | model=openai/gpt-4o | confidence=0.88 | tokens=4,102 | latency=2,100ms
```

Вы всегда можете спросить: *«Почему ты назвал это концепцией, а не источником?»* — и получить reasoning.

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| `meta/ontology.md not found` | Запустите `init-meta` или создайте вручную (шаг 3) |
| `LLM Adapter: no providers configured` | Проверьте `.env` — должны быть заданы `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` или `OLLAMA_BASE_URL` (шаг 1.1) |
| `Ollama connection refused` | Запустите Ollama: `ollama serve` или `ollama run llama3.1` |
| `OpenAI API key invalid` | Проверьте `OPENAI_API_KEY` в env или config |
| `AI returns low confidence` | Переключитесь на более сильную модель для сложных задач |
| `Search returns 0 results` | Убедитесь, что заметки в `.md` и содержат текст |
| `Permission denied` | Проверьте права на папку vault |

---

## Дальнейшее чтение

- [SPECIFICATION.ru.md](SPECIFICATION.ru.md) — полная архитектура
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) — руководство для разработчиков
- [SECURITY_MODEL.md](SECURITY_MODEL.md) — модель безопасности
