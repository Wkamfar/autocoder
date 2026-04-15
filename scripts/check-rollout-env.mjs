#!/usr/bin/env node
/**
 * Local readiness: required Discord + world file (values not printed).
 * Exit 1 = not ready; 0 = vars present and world exists.
 * CI: no .env → exits 0 (nothing to verify).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  console.log('Rollout readiness: no .env yet (copy .env.rollout.example → .env)');
  process.exit(0);
}

dotenv.config({ path: envPath });

const missing = [];
const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guild = process.env.DISCORD_GUILD_ID?.trim();
const channel = process.env.DISCORD_CHANNEL_ID?.trim();

if (!token || token === 'REPLACE_ME') missing.push('DISCORD_BOT_TOKEN');
if (!guild || guild === 'REPLACE_ME') missing.push('DISCORD_GUILD_ID');
if (!channel || channel === 'REPLACE_ME') missing.push('DISCORD_CHANNEL_ID');

const worldPath = process.env.SALES_WORLD_JSON
  ? path.resolve(process.env.SALES_WORLD_JSON)
  : path.join(root, 'state', 'sales-world.json');

const hasWorld = fs.existsSync(worldPath);

if (missing.length === 0 && hasWorld) {
  console.log('Rollout readiness: OK (Discord vars set; world file present). Secrets not shown.');
  process.exit(0);
}

console.error('Rollout readiness: incomplete');
for (const k of missing) console.error(`  - ${k} missing or placeholder`);
if (!hasWorld) {
  console.error(`  - sales world not found: ${worldPath}`);
  console.error('    Run: npm run rollout:seed-world');
}
process.exit(1);
