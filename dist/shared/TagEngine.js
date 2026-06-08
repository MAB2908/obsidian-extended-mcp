export class TagEngine {
    ontology;
    constructor(ontology) {
        this.ontology = ontology ?? {
            allowedTags: [],
            folderRules: {
                raw: { requiredTags: ['source'], forbiddenTags: ['evergreen', 'concept', 'moc'] },
                concepts: { requiredTags: ['concept'], forbiddenTags: ['source', 'draft'] },
                index: { requiredTags: ['moc'], forbiddenTags: [] },
                sessions: { requiredTags: ['session'], forbiddenTags: ['concept', 'moc'] },
            },
        };
    }
    validateNote(filePath, frontmatterTags, inlineTags) {
        const errors = [];
        const tags = [...frontmatterTags, ...inlineTags];
        const folder = this.detectFolder(filePath);
        const rules = this.ontology.folderRules[folder] ?? { requiredTags: [], forbiddenTags: [] };
        for (const required of rules.requiredTags) {
            if (!tags.includes(required))
                errors.push(`Missing required tag: ${required}`);
        }
        for (const forbidden of rules.forbiddenTags) {
            if (tags.includes(forbidden))
                errors.push(`Forbidden tag: ${forbidden}`);
        }
        if (this.ontology.allowedTags.length > 0) {
            for (const tag of tags) {
                if (!this.ontology.allowedTags.includes(tag)) {
                    errors.push(`Tag not in ontology: ${tag}`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
    detectFolder(filePath) {
        const first = filePath.split('/')[0];
        return first || '';
    }
    addTags(current, toAdd) {
        const set = new Set(current);
        for (const t of toAdd)
            set.add(t);
        return Array.from(set);
    }
    removeTags(current, toRemove) {
        const removeSet = new Set(toRemove);
        return current.filter((t) => !removeSet.has(t));
    }
    setTags(_current, newTags) {
        return Array.from(new Set(newTags));
    }
    getOntology() {
        return this.ontology;
    }
}
//# sourceMappingURL=TagEngine.js.map