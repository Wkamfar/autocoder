import type { DossierScope } from '../../world/types.js';
import type { SalesWorldFile } from '../../world/types.js';

/** One eval fixture — no LLM required for `validate` mode. */
export interface PairDebateEvalScenario {
  id: string;
  title: string;
  world: SalesWorldFile;
  scope: DossierScope;
  /** Structural expectations on dossier / future synthesis scoring. */
  expect?: {
    dossier_substrings?: string[];
    min_dossier_length?: number;
    /** For scoring a saved synthesis JSON (human or CI). */
    synthesis_keys?: string[];
  };
}

export interface EvalScoreBreakdown {
  scenario_id: string;
  passed: boolean;
  points: number;
  max_points: number;
  notes: string[];
}
