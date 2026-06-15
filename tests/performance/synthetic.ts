// v0.2b:
import { promises as fs } from 'fs';
import path from 'path';

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

export interface VaultConfig {
  noteCount: number;
  linksPerNote: number;
  wordsPerNote: number;
}

export async function generateSyntheticVault(basePath: string, config: VaultConfig): Promise<string[]> {
  await fs.mkdir(basePath, { recursive: true });
  const paths: string[] = [];

  for (let i = 0; i < config.noteCount; i++) {
    const folder = `folder${(i % 10).toString().padStart(2, '0')}`;
    const fileName = `note-${i.toString().padStart(5, '0')}.md`;
    const relPath = `${folder}/${fileName}`;
    paths.push(relPath);

    const links: string[] = [];
    for (let j = 0; j < config.linksPerNote; j++) {
      const targetIdx = Math.floor(Math.random() * config.noteCount);
      const target = `folder${(targetIdx % 10).toString().padStart(2, '0')}/note-${targetIdx.toString().padStart(5, '0')}`;
      links.push(`[[${target}]]`);
    }

    const paragraphs = Math.ceil(config.wordsPerNote / 50);
    const body = Array.from({ length: paragraphs }, () => LOREM).join('\n\n');
    const content = `---\ntitle: "Note ${i}"\ntags: [synthetic, test]\ncreated: ${new Date().toISOString()}\n---\n\n# Note ${i}\n\n${body}\n\n## Links\n${links.join('\n')}\n`;

    const fullPath = path.join(basePath, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  return paths;
}

export async function cleanupVault(basePath: string): Promise<void> {
  await fs.rm(basePath, { recursive: true, force: true });
}
