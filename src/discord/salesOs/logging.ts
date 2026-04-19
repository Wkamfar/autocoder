import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';

export async function logDiscordSalesOs(event: Record<string, unknown>): Promise<void> {
  const p = path.join(config.runtime.stateDir, 'discord-sales-os.jsonl');
  await fs.mkdir(path.dirname(p), { recursive: true });
  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      ...event,
    }) + '\n';
  await fs.appendFile(p, line, 'utf8');
}
