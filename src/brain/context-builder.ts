import fs from 'node:fs/promises';
import path from 'node:path';
import { Task } from '../types.js';
import { BrainPersistence } from './persistence.js';
import { config } from '../config.js';

export class ContextBuilder {
  constructor(private brain: BrainPersistence) {}

  async build(task: Task): Promise<string> {
    const sections: string[] = [];

    const arch = await this.brain.readKnowledge('architecture.md');
    if (arch.trim()) {
      sections.push(`## Architecture\n${arch.trim().slice(0, 4000)}`);
    }

    const refs = await this.buildReferenceReposSummary();
    if (refs.trim()) {
      sections.push(`## Reference Repositories (read-only)\n${refs}`);
    }

    const patterns = await this.brain.readKnowledge('patterns.md');
    if (patterns.trim()) {
      sections.push(`## Relevant Patterns\n${patterns.trim().slice(0, 3000)}`);
    }

    const antipatterns = await this.brain.getRelevantAntipatterns(task);
    if (antipatterns.length) {
      sections.push(
        '## Known Pitfalls (avoid these)\n' + antipatterns.map((a) => `- ${a}`).join('\n')
      );
    }

    if (task.retry_count > 0 && task.error_history.length) {
      sections.push(
        '## Previous Attempts\n' +
          task.error_history
            .map((e) => `Attempt ${e.attempt}: ${e.error.slice(0, 800)}`)
            .join('\n')
      );
    }

    sections.push(
      `## Task\n` +
        `- id: ${task.id}\n` +
        `- title: ${task.title}\n` +
        `- type: ${task.type}\n` +
        `- complexity: ${task.complexity}\n` +
        `- risk: ${task.risk}\n\n` +
        task.description
    );

    return sections.join('\n\n---\n\n');
  }

  private async buildReferenceReposSummary(): Promise<string> {
    const repos = config.project.referenceRepos;
    if (!repos.length) return '';
    const maxTotalBytes = 8192;
    const blocks: string[] = [];
    let totalBytes = 0;

    for (const repoPath of repos) {
      if (totalBytes >= maxTotalBytes) break;
      // Verify the repo is actually readable before we waste tokens on it.
      try {
        await fs.access(repoPath);
      } catch {
        continue;
      }
      try {
        const name = path.basename(repoPath);
        const parts: string[] = [`### ${name}`, `_path: ${repoPath} (READ-ONLY — do not modify)_`];

        const readme = await this.tryReadFirst(repoPath, [
          'README.md',
          'README',
          'readme.md',
        ]);
        if (readme) parts.push(readme.slice(0, 1200));

        const pkg = await this.tryRead(path.join(repoPath, 'package.json'));
        if (pkg) {
          try {
            const parsed = JSON.parse(pkg) as Record<string, unknown>;
            const pkgName = (parsed.name as string) ?? '';
            const deps = Object.keys((parsed.dependencies as Record<string, string>) ?? {});
            parts.push(
              `package: ${pkgName}\ndeps: ${deps.slice(0, 20).join(', ') || '(none)'}`
            );
          } catch {}
        }

        const tree = await this.shallowTree(repoPath, 2);
        if (tree) parts.push('top-level tree:\n```\n' + tree + '\n```');

        const block = parts.join('\n\n');
        if (totalBytes + block.length > maxTotalBytes) {
          // Truncate the final block so we respect the budget exactly.
          blocks.push(block.slice(0, maxTotalBytes - totalBytes));
          totalBytes = maxTotalBytes;
        } else {
          blocks.push(block);
          totalBytes += block.length;
        }
      } catch {
        // Skip unreadable repos silently — the warning is already surfaced by doctor.
        continue;
      }
    }
    return blocks.join('\n\n');
  }

  private async tryRead(file: string): Promise<string | null> {
    try {
      return await fs.readFile(file, 'utf8');
    } catch {
      return null;
    }
  }

  private async tryReadFirst(dir: string, names: string[]): Promise<string | null> {
    for (const n of names) {
      const content = await this.tryRead(path.join(dir, n));
      if (content) return content;
    }
    return null;
  }

  private async shallowTree(dir: string, maxDepth: number): Promise<string> {
    const ignore = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.venv', 'venv']);
    const out: string[] = [];
    const walk = async (d: string, depth: number, prefix: string): Promise<void> => {
      if (depth > maxDepth) return;
      let entries;
      try {
        entries = await fs.readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      entries = entries.filter((e) => !ignore.has(e.name) && !e.name.startsWith('.')).slice(0, 40);
      for (const e of entries) {
        out.push(`${prefix}${e.isDirectory() ? e.name + '/' : e.name}`);
        if (e.isDirectory()) await walk(path.join(d, e.name), depth + 1, prefix + '  ');
        if (out.length > 120) return;
      }
    };
    await walk(dir, 0, '');
    return out.join('\n');
  }
}
