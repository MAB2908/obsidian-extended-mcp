// v0.1b:
export interface FolderRules {
  requiredTags: string[];
  forbiddenTags: string[];
}

export interface Ontology {
  allowedTags: string[];
  folderRules: Record<string, FolderRules>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TagEngine {
  private ontology: Ontology;

  constructor(ontology?: Ontology) {
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

  validateNote(filePath: string, frontmatterTags: string[], inlineTags: string[]): ValidationResult {
    const errors: string[] = [];
    const tags = [...frontmatterTags, ...inlineTags];
    const folder = this.detectFolder(filePath);
    const rules = this.ontology.folderRules[folder] ?? { requiredTags: [], forbiddenTags: [] };

    for (const required of rules.requiredTags) {
      if (!tags.includes(required)) errors.push(`Missing required tag: ${required}`);
    }
    for (const forbidden of rules.forbiddenTags) {
      if (tags.includes(forbidden)) errors.push(`Forbidden tag: ${forbidden}`);
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

  private detectFolder(filePath: string): string {
    const first = filePath.split('/')[0];
    return first || '';
  }

  addTags(current: string[], toAdd: string[]): string[] {
    const set = new Set(current);
    for (const t of toAdd) set.add(t);
    return Array.from(set);
  }

  removeTags(current: string[], toRemove: string[]): string[] {
    const removeSet = new Set(toRemove);
    return current.filter((t) => !removeSet.has(t));
  }

  setTags(_current: string[], newTags: string[]): string[] {
    return Array.from(new Set(newTags));
  }

  getOntology(): Ontology {
    return this.ontology;
  }
}
