import { BrainPersistence } from './persistence.js';
import { Task } from '../types.js';

/**
 * Assembles the markdown context block that is prepended to every task
 * prompt. The content is assembled from the brain's `knowledge/*.md` files
 * so the agent sees the latest architecture notes, accepted patterns, and
 * antipatterns the project has accumulated across runs.
 */
export class ContextBuilder {
  constructor(private readonly brain: BrainPersistence) {}

  async build(task: Task): Promise<string> {
    const architecture = await this.brain.readKnowledge('architecture.md');
    const patternsAll = await this.brain.readKnowledge('patterns.md');
    const antipatternsAll = await this.brain.readKnowledge('antipatterns.md');

    const patterns = takeLastLines(patternsAll, 60);
    const antipatterns = filterAntipatternsByTags(antipatternsAll, task.tags);

    const sections: string[] = [];

    sections.push(
      [
        '## Task',
        `- id: ${task.id}`,
        `- title: ${task.title}`,
        `- type: ${task.type}`,
        `- complexity: ${task.complexity}`,
        `- risk: ${task.risk}`,
        task.tags.length ? `- tags: ${task.tags.join(', ')}` : '',
        '',
        task.description || '',
      ]
        .filter(Boolean)
        .join('\n')
    );

    if (task.acceptance_criteria?.length) {
      sections.push(
        '## Acceptance criteria\n' +
          task.acceptance_criteria.map((c) => `- ${c}`).join('\n')
      );
    }

    if (task.relevant_files?.length) {
      sections.push(
        '## Relevant files\n' +
          task.relevant_files.map((f) => `- ${f}`).join('\n')
      );
    }

    if (architecture.trim()) {
      sections.push('## Architecture\n' + truncate(architecture, 4000));
    }

    if (patterns.trim()) {
      sections.push('## Known patterns\n' + patterns);
    }

    if (antipatterns.trim()) {
      sections.push('## Antipatterns to avoid\n' + antipatterns);
    }

    if (task.error_history?.length) {
      const lines = task.error_history
        .slice(-3)
        .map((e) => `- attempt ${e.attempt} @ ${e.at}: ${e.error}`)
        .join('\n');
      sections.push('## Prior attempts on this task\n' + lines);
    }

    return sections.join('\n\n');
  }
}

function takeLastLines(text: string, n: number): string {
  const lines = text.split('\n');
  if (lines.length <= n) return text.trim();
  return lines.slice(-n).join('\n').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n\n…(truncated)…';
}

/**
 * The antipatterns file grows unboundedly across runs. Instead of dumping
 * every entry into every task's prompt (expensive + noisy), include only
 * the blocks whose header mentions at least one of the task's tags. If
 * there are no tags, fall back to the last 40 lines so we still give the
 * planner something useful to see.
 */
function filterAntipatternsByTags(text: string, tags: string[]): string {
  if (!text.trim()) return '';
  if (!tags.length) return takeLastLines(text, 40);

  const blocks = text.split(/^## /m).filter(Boolean);
  const matched = blocks.filter((b) => {
    const lower = b.toLowerCase();
    return tags.some((t) => lower.includes(t.toLowerCase()));
  });
  if (matched.length === 0) return takeLastLines(text, 40);
  return matched.map((b) => '## ' + b).join('\n');
}
