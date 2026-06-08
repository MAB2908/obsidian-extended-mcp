// v0.2b:
import { ContextBootstrapCache } from './ContextBootstrapCache.js';
export class ContextBootstrap {
    cache;
    constructor(vaultPath) {
        this.cache = new ContextBootstrapCache(vaultPath);
    }
    async generatePrompt(maxTokens = 4000) {
        const ontology = (await this.cache.get('ontology')) || '# Ontology\n(No ontology defined)';
        const protocol = (await this.cache.get('protocol')) || '# Protocol\n(No protocol defined)';
        const linkRules = (await this.cache.get('linkRules')) || '# Link Rules\n(No link rules defined)';
        const structure = (await this.cache.get('structure')) || '';
        const prompt = `# SYSTEM: Obsidian Knowledge Base Compiler

You are a knowledge base compiler working with an Obsidian vault through MCP server.

## Vault Context

### Folder Structure
\`\`\`
${structure}
\`\`\`

### Ontology
${ontology}

### Protocol
${protocol}

### Link Rules
${linkRules}

## Available MCP Tools
- read_note, write_note, append_note, patch_note, delete_note, move_note
- list_directory, search_notes, get_vault_stats, list_all_tags
- cli_backlinks, cli_orphans, cli_unresolved, cli_deadends
- bm25_search, semantic_search, graph_neighbors, build_index
- ai_ingest, ai_compile, ai_link, ai_tag, ai_query, ai_enrich
- rest_active_note, rest_dataview

## Rules
- Use ONLY tags from ontology
- One idea = one file in concepts/
- Minimum 3 [[wikilinks]] per concept
- Always suggest concrete file edits`;
        const tokenEstimate = Math.ceil(prompt.length / 4);
        const trimmed = tokenEstimate > maxTokens ? this.trimPrompt(prompt, maxTokens) : prompt;
        return { prompt: trimmed, tokenEstimate: Math.ceil(trimmed.length / 4) };
    }
    invalidate() {
        this.cache.invalidate();
    }
    trimPrompt(prompt, maxTokens) {
        const maxChars = maxTokens * 4;
        if (prompt.length <= maxChars)
            return prompt;
        return prompt.slice(0, maxChars) + '\n\n[Context truncated]';
    }
}
//# sourceMappingURL=ContextBootstrap.js.map