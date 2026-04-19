import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { Task } from '../types.js';
import { Logger } from '../utils/logger.js';

const API_DIR = 'knowledge/api-instructions';

const TEMPLATE = `# {{name}} — Instructions for NightShift

## Base URL
<fill me in>

## Authentication
- Type: <api key | oauth | bearer>
- Header / mechanism: <how credentials are sent>
- Env var: <NAME> (stored in .env, read via process.env.<NAME>)
- NEVER hardcode the key. Always read from process.env.

## Key endpoints
- GET ...
- POST ...

## Rate limits
- <requests per minute / day>
- Backoff strategy on 429: exponential

## Response format
- <JSON schema highlights>

## Code pattern
\`\`\`ts
const res = await fetch(\`\${BASE_URL}/path\`, {
  headers: { Authorization: \`Bearer \${process.env.API_KEY}\` },
});
const data = await res.json();
\`\`\`

## Gotchas
- <known quirks, sandbox vs prod, unit conventions>
`;

export class ApiInstructions {
  private log = new Logger('api-instructions');

  constructor(private brainDir: string = config.brain.dir) {}

  private abs(...parts: string[]): string {
    return path.join(this.brainDir, API_DIR, ...parts);
  }

  async ensureStructure(): Promise<void> {
    await fs.mkdir(this.abs(), { recursive: true });
    const templatePath = this.abs('_template.md');
    try {
      await fs.access(templatePath);
    } catch {
      await fs.writeFile(templatePath, TEMPLATE);
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.abs());
      return files.filter((f) => f.endsWith('.md') && !f.startsWith('_'));
    } catch {
      return [];
    }
  }

  async load(name: string): Promise<string | null> {
    const file = name.endsWith('.md') ? name : `${name}.md`;
    try {
      return await fs.readFile(this.abs(file), 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Return the instruction snippets relevant to a task. Matches on tags and
   * on keyword hits in the title/description.
   */
  async loadRelevant(task: Task, limit = 3): Promise<string[]> {
    const files = await this.list();
    if (files.length === 0) return [];
    const needle = (task.title + ' ' + task.description + ' ' + task.tags.join(' '))
      .toLowerCase();
    const scored: Array<{ content: string; score: number }> = [];
    for (const f of files) {
      const content = (await this.load(f)) ?? '';
      const base = f.replace(/\.md$/, '').toLowerCase();
      let score = 0;
      if (needle.includes(base)) score += 5;
      for (const tag of task.tags) {
        if (f.toLowerCase().includes(tag.toLowerCase())) score += 2;
      }
      // Keyword overlap with the first 200 chars of the file.
      const head = content.slice(0, 400).toLowerCase();
      for (const word of needle.split(/\s+/)) {
        if (word.length > 4 && head.includes(word)) score += 1;
      }
      if (score > 0) scored.push({ content, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.content);
  }

  async save(name: string, content: string): Promise<void> {
    await this.ensureStructure();
    const file = this.abs(name.endsWith('.md') ? name : `${name}.md`);
    await fs.writeFile(file, content);
    this.log.info(`saved ${file}`);
  }
}

export const apiInstructions = new ApiInstructions();
