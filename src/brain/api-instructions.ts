import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { Task } from '../types.js';
import { Logger } from '../utils/logger.js';

/**
 * Loads per-API markdown instruction files from
 * `$BRAIN_DIR/knowledge/api-instructions/` and returns the ones relevant to
 * a given task based on tag + keyword matching against an optional YAML
 * frontmatter block.
 *
 * File format:
 *
 *     ---
 *     tags: [polymarket, markets]
 *     keywords: [polymarket, slug, clob]
 *     ---
 *     # Polymarket API notes
 *     ...
 *
 * Matching is a simple case-insensitive set intersection. If a file has no
 * frontmatter, the filename (without extension) is treated as its sole tag
 * and keyword.
 */
export class ApiInstructions {
  private log = new Logger('api-instructions');

  get dir(): string {
    return path.join(config.brain.dir, 'knowledge', 'api-instructions');
  }

  async ensureStructure(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async loadRelevant(task: Task): Promise<string[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.dir);
    } catch {
      return [];
    }

    const haystack = [
      task.title,
      task.description,
      ...task.tags,
      ...(task.relevant_files || []),
    ]
      .join(' ')
      .toLowerCase();
    const taskTags = new Set(task.tags.map((t) => t.toLowerCase()));

    const relevant: string[] = [];
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      let content: string;
      try {
        content = await fs.readFile(path.join(this.dir, f), 'utf8');
      } catch {
        continue;
      }
      const meta = parseFrontmatter(content);
      const fallbackKey = f.replace(/\.md$/, '').toLowerCase();
      const tags = meta?.tags?.map((t) => t.toLowerCase()) ?? [fallbackKey];
      const keywords = meta?.keywords?.map((k) => k.toLowerCase()) ?? [fallbackKey];

      const tagMatch = tags.some((t) => taskTags.has(t));
      const keywordMatch = keywords.some((k) => haystack.includes(k));
      if (tagMatch || keywordMatch) {
        relevant.push(stripFrontmatter(content));
      }
    }
    if (relevant.length) {
      this.log.debug(`loaded ${relevant.length} api instruction file(s) for ${task.id}`);
    }
    return relevant;
  }
}

export const apiInstructions = new ApiInstructions();

interface Frontmatter {
  tags?: string[];
  keywords?: string[];
}

function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = content.slice(3, end);
  const meta: Frontmatter = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^(\w+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const arr = parseYamlList(rawValue.trim());
    if (key === 'tags') meta.tags = arr;
    else if (key === 'keywords') meta.keywords = arr;
  }
  return meta;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return content;
  // Skip past the closing `\n---\n` (or trailing EOF).
  const after = content.slice(end + 4).replace(/^\s*\n/, '');
  return after;
}

function parseYamlList(value: string): string[] {
  // Very small subset: supports `[a, b, c]` inline form. No block form.
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  if (!value) return [];
  return [value.replace(/^["']|["']$/g, '')];
}
