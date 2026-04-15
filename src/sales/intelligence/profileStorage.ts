import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import type { SalesStrategyProfile } from './types.js';

export function defaultStrategyProfilePath(): string {
  const env = process.env.SALES_STRATEGY_PROFILE_PATH;
  return env?.trim() ? path.resolve(env) : path.join(config.runtime.stateDir, 'sales-strategy-profile.json');
}

export function loadStrategyProfileSync(): SalesStrategyProfile | null {
  const p = defaultStrategyProfilePath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as SalesStrategyProfile;
  } catch {
    return null;
  }
}

export function saveStrategyProfile(profile: SalesStrategyProfile): string {
  const p = defaultStrategyProfilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(profile, null, 2), 'utf8');
  return p;
}
