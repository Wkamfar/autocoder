#!/usr/bin/env node
/**
 * Local readiness: required Discord + world file (values not printed).
 * Validates snowflake-shaped IDs and sales world JSON shape when present.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { validateSalesWorldShape } from './validate-sales-world-shape.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

/** Discord snowflake id (guild / channel / user) — numeric 17–20 digits */
function isSnowflake(s) {
  return typeof s === 'string' && /^\d{17,20}$/.test(s);
}

if (!fs.existsSync(envPath)) {
  console.log('Rollout readiness: no .env yet (copy .env.rollout.example → .env)');
  process.exit(0);
}

dotenv.config({ path: envPath });

const missing = [];
const badShape = [];
const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guild = process.env.DISCORD_GUILD_ID?.trim();
const channel = process.env.DISCORD_CHANNEL_ID?.trim();

if (!token || token === 'REPLACE_ME') missing.push('DISCORD_BOT_TOKEN');
if (!guild || guild === 'REPLACE_ME') missing.push('DISCORD_GUILD_ID');
if (!channel || channel === 'REPLACE_ME') missing.push('DISCORD_CHANNEL_ID');

if (guild && guild !== 'REPLACE_ME' && !isSnowflake(guild)) {
  badShape.push('DISCORD_GUILD_ID should be a numeric snowflake (Developer Mode → Copy Server ID)');
}
if (channel && channel !== 'REPLACE_ME' && !isSnowflake(channel)) {
  badShape.push('DISCORD_CHANNEL_ID should be a numeric snowflake (right-click channel → Copy ID)');
}
if (guild && channel && isSnowflake(guild) && isSnowflake(channel) && guild === channel) {
  badShape.push('DISCORD_GUILD_ID and DISCORD_CHANNEL_ID are identical — channel id is usually different from server id');
}

const worldPath = process.env.SALES_WORLD_JSON
  ? path.resolve(process.env.SALES_WORLD_JSON)
  : path.join(root, 'state', 'sales-world.json');

const hasWorld = fs.existsSync(worldPath);

let worldShapeOk = true;
if (hasWorld) {
  try {
    const raw = fs.readFileSync(worldPath, 'utf8');
    const data = JSON.parse(raw);
    const r = validateSalesWorldShape(data);
    if (!r.ok) {
      worldShapeOk = false;
      badShape.push(`sales world JSON invalid: ${r.errors.slice(0, 3).join('; ')}${r.errors.length > 3 ? '…' : ''}`);
    }
  } catch (e) {
    worldShapeOk = false;
    badShape.push(`sales world not readable JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (missing.length === 0 && badShape.length === 0 && hasWorld && worldShapeOk) {
  console.log('Rollout readiness: OK (Discord vars set; world file present and valid). Secrets not shown.');
  process.exit(0);
}

if (missing.length === 0 && badShape.length === 0 && !hasWorld) {
  console.error('Rollout readiness: incomplete');
  console.error(`  - sales world not found: ${worldPath}`);
  console.error('    Run: npm run rollout:seed-world');
  process.exit(1);
}

console.error('Rollout readiness: incomplete');
for (const k of missing) console.error(`  - ${k} missing or placeholder`);
for (const b of badShape) console.error(`  - ${b}`);
if (!hasWorld) {
  console.error(`  - sales world not found: ${worldPath}`);
  console.error('    Run: npm run rollout:seed-world');
}
process.exit(1);
