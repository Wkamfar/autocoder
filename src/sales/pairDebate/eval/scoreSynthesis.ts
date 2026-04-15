import type { FinalDebateSynthesis } from '../types.js';

export interface RubricWeights {
  has_next_step: number;
  has_why_now: number;
  has_risks: number;
  has_draft: number;
  acknowledges_disagreement: number;
  not_empty_agreement: number;
}

const DEFAULT_WEIGHTS: RubricWeights = {
  has_next_step: 2,
  has_why_now: 1,
  has_risks: 1,
  has_draft: 2,
  acknowledges_disagreement: 2,
  not_empty_agreement: 1,
};

export function scoreSynthesisHeuristic(
  s: FinalDebateSynthesis,
  weights: Partial<RubricWeights> = {}
): { points: number; max: number; details: Record<string, boolean> } {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  let points = 0;
  let max = 0;
  const details: Record<string, boolean> = {};

  const add = (key: keyof RubricWeights, ok: boolean) => {
    max += w[key];
    if (ok) points += w[key];
    details[key] = ok;
  };

  add('has_next_step', Boolean(s.recommended_single_next_step?.trim()));
  add('has_why_now', Boolean(s.why_now?.trim()));
  add('has_risks', Array.isArray(s.what_could_go_wrong) && s.what_could_go_wrong.length > 0);
  add('has_draft', Boolean(s.draft_artifact?.content?.trim()));
  add(
    'acknowledges_disagreement',
    (s.remaining_disagreements?.length ?? 0) > 0 ||
      (s.what_would_change_the_recommendation?.length ?? 0) > 0
  );
  add('not_empty_agreement', Array.isArray(s.agreement) && s.agreement.length > 0);

  return { points, max, details };
}
