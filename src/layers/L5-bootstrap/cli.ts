#!/usr/bin/env node
// v0.1.0-beta.1:
// v0.1.0-beta.1:
import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { VaultManager } from '../L1-filesystem/VaultManager.js';

const program = new Command();

program.name('obsidian-mcp').description('Obsidian Extended MCP CLI').version('0.1.0-beta.1');

program
  .command('init-meta')
  .description('Initialize meta structure in vault')
  .option('-p, --path <path>', 'Vault path', process.env.OBSIDIAN_VAULT_PATH || './vault')
  .action(async (options) => {
    const vaultPath = path.resolve(options.path);
    await fs.mkdir(path.join(vaultPath, 'meta'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'raw'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'source'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'concepts'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'moc'), { recursive: true });

    const ontology = `---\nontology: true\n---\n# Vault Ontology\n\n## Folders\n- raw/ → unprocessed notes\n- source/ → structured sources\n- concepts/ → atomic concepts\n- moc/ → maps of content\n\n## Rules\n- Use #status/draft for unfinished notes\n- Use #status/final for reviewed notes\n`;
    const protocol = `---\nprotocol: true\n---\n# Context Bootstrap Protocol\n\n1. Ingest raw notes into source/\n2. Compile sources into concepts/\n3. Link concepts bidirectionally\n4. Tag with unified ontology\n5. Query with citations\n`;
    const linkRules = `---\nlink-rules: true\n---\n# Link Rules\n\n- Prefer [[Concept|Display]] format\n- Create MOC for every major topic\n- Backlinks are auto-generated\n`;

    await fs.writeFile(path.join(vaultPath, 'meta', 'ontology.md'), ontology, 'utf-8');
    await fs.writeFile(path.join(vaultPath, 'meta', 'protocol.md'), protocol, 'utf-8');
    await fs.writeFile(path.join(vaultPath, 'meta', 'link-rules.md'), linkRules, 'utf-8');

    console.log(`✅ Meta structure initialized in ${vaultPath}`);
  });

program
  .command('check')
  .description('Check vault health')
  .option('-p, --path <path>', 'Vault path', process.env.OBSIDIAN_VAULT_PATH || './vault')
  .action(async (options) => {
    const vaultPath = path.resolve(options.path);
    try {
      await fs.access(vaultPath);
    } catch {
      console.error(`❌ Vault not found: ${vaultPath}`);
      process.exit(1);
    }
    const vault = new VaultManager(vaultPath);
    const stats = await vault.getVaultStats();
    console.log('Vault check results:');
    console.log(`  Path: ${vaultPath}`);
    console.log(`  Notes: ${stats.totalNotes}`);
    console.log(`  Folders: ${stats.totalFolders}`);
    console.log(`  Tags: ${stats.totalTags}`);
    console.log(`  Links: ${stats.totalLinks}`);
    if (stats.totalNotes === 0) {
      console.warn('⚠️  Vault is empty');
    } else {
      console.log('✅ Vault looks healthy');
    }
  });

program
  .command('init-llm')
  .description('Initialize LLM configuration wizard')
  .action(async () => {
    const envPath = path.resolve('.env');
    let existing = '';
    try {
      existing = await fs.readFile(envPath, 'utf-8');
    } catch {
      // no existing .env
    }

    // Simple non-interactive defaults for automation
    const lines = existing.split('\n').filter((l) => !l.startsWith('OPENAI_') && !l.startsWith('ANTHROPIC_') && !l.startsWith('OLLAMA_') && !l.startsWith('DEFAULT_LLM_'));
    lines.push('OPENAI_API_KEY=your-key-here');
    lines.push('OPENAI_MODEL=gpt-4o-mini');
    lines.push('DEFAULT_LLM_PROVIDER=openai');
    await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf-8');
    console.log('✅ .env created/updated. Edit it to add your real API keys.');
  });

program
  .command('rollback')
  .description('Rollback a note to a previous backup')
  .option('-p, --path <path>', 'Vault path', process.env.OBSIDIAN_VAULT_PATH || './vault')
  .requiredOption('--file <file>', 'Relative path to the note')
  .option('--to <timestamp>', 'Backup timestamp or "last"', 'last')
  .action(async (options) => {
    const vaultPath = path.resolve(options.path);
    const vault = new VaultManager(vaultPath);
    await vault.rollback(options.file, options.to === 'last' ? undefined : options.to);
    console.log(`✅ Rolled back ${options.file}`);
  });

program.parse();
