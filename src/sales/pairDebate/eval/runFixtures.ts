import fs from 'node:fs';
import path from 'node:path';
import { buildDossierPack } from '../dossierBuilder.js';
import type { PairDebateEvalScenario } from './scenarioTypes.js';
import type { FinalDebateSynthesis } from '../types.js';
import { scoreSynthesisHeuristic } from './scoreSynthesis.js';

export function loadScenarioFile(file: string): PairDebateEvalScenario {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as PairDebateEvalScenario;
}

export function discoverScenarioFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(root, f))
    .sort();
}

export function validateScenario(s: PairDebateEvalScenario): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const prev = process.env.PAIR_DEBATE_NO_PATTERNS;
  try {
    process.env.PAIR_DEBATE_NO_PATTERNS = '1';
    const pack = buildDossierPack(s.world, s.scope);
    if (s.expect?.min_dossier_length != null && pack.body.length < s.expect.min_dossier_length) {
      errors.push(`dossier too short: ${pack.body.length} < ${s.expect.min_dossier_length}`);
    }
    if (s.expect?.dossier_substrings) {
      const lower = pack.body.toLowerCase();
      for (const sub of s.expect.dossier_substrings) {
        if (!lower.includes(sub.toLowerCase())) {
          errors.push(`dossier missing substring: ${sub}`);
        }
      }
    }
  } catch (e) {
    errors.push((e as Error).message);
  } finally {
    if (prev === undefined) delete process.env.PAIR_DEBATE_NO_PATTERNS;
    else process.env.PAIR_DEBATE_NO_PATTERNS = prev;
  }
  return { ok: errors.length === 0, errors };
}

export function defaultEvalScenariosDir(): string {
  const env = process.env.PAIR_DEBATE_EVAL_DIR;
  if (env) return path.resolve(env);
  return path.join(process.cwd(), 'evals', 'pair-debate', 'scenarios');
}

/** Structural validation of all JSON scenarios (no API calls). */
export function runFixtureValidation(): {
  scenarios: { id: string; ok: boolean; errors: string[] }[];
  all_ok: boolean;
} {
  const dir = defaultEvalScenariosDir();
  const files = discoverScenarioFiles(dir);
  const scenarios: { id: string; ok: boolean; errors: string[] }[] = [];
  for (const file of files) {
    const s = loadScenarioFile(file);
    const v = validateScenario(s);
    scenarios.push({ id: s.id, ok: v.ok, errors: v.errors });
  }
  return { scenarios, all_ok: scenarios.every((x) => x.ok) };
}

export function scoreSynthesisFile(synthesisPath: string): {
  points: number;
  max: number;
  details: Record<string, boolean>;
} {
  const raw = fs.readFileSync(synthesisPath, 'utf8');
  const j = JSON.parse(raw) as { synthesis?: FinalDebateSynthesis } | FinalDebateSynthesis;
  const syn = 'synthesis' in j && j.synthesis ? j.synthesis : (j as FinalDebateSynthesis);
  return scoreSynthesisHeuristic(syn);
}

/** Default path to rubric doc (for CLI hint only). */
export function rubricDocPath(): string {
  return path.join(process.cwd(), 'docs', 'pair-debate-eval-rubric.md');
}
