import fs from 'node:fs';
import type {
  FinalDebateSynthesis,
  PairDebateBlackboard,
  PairDebateTurnRecord,
} from '../types.js';

export interface FullRunJson {
  run_id?: string;
  turns?: PairDebateTurnRecord[];
  final_blackboard?: PairDebateBlackboard;
  synthesis?: FinalDebateSynthesis;
}

export interface ScoreRunResult {
  heuristic_signal_only: true;
  flags: {
    synthesis_has_disagreement_signal: boolean;
    final_blackboard_open_disagreement: boolean;
    closer_round3_substantive: boolean;
    has_three_turns: boolean;
  };
  notes: string[];
}

/**
 * Lightweight triage over a `pair-debate-*-full.json` export.
 * Always set `heuristic_signal_only: true` — not a substitute for human rubric.
 */
export function scoreRunHeuristics(full: FullRunJson): ScoreRunResult {
  const synthesis = full.synthesis;
  const bb = full.final_blackboard;
  const turns = full.turns ?? [];

  const synthesis_has_disagreement_signal =
    (synthesis?.remaining_disagreements?.length ?? 0) > 0 ||
    (synthesis?.what_would_change_the_recommendation?.length ?? 0) > 0;

  const final_blackboard_open_disagreement =
    bb?.disagreement_register?.some((d) => d.status === 'open') ?? false;

  const r1Closer = turns.find((t) => t.round === 1 && t.role === 'closer');
  const r3Closer = turns.find((t) => t.round === 3 && t.role === 'closer');
  const keywords = /concede|revise|instead|narrow|remove|drop|softer|without|fair point|adjust|conced/i;
  const closer_round3_substantive = Boolean(
    r3Closer &&
      r3Closer.raw_response.length > 80 &&
      (keywords.test(r3Closer.raw_response) ||
        (r1Closer &&
          r3Closer.raw_response !== r1Closer.raw_response &&
          r3Closer.raw_response.length > 120))
  );

  return {
    heuristic_signal_only: true,
    flags: {
      synthesis_has_disagreement_signal,
      final_blackboard_open_disagreement,
      closer_round3_substantive,
      has_three_turns: turns.length >= 3,
    },
    notes: [
      'Heuristic triage only — use human disagreement rubric (docs/pair-debate-eval-rubric.md) for authoritative scoring.',
    ],
  };
}

export function scoreRunFromFile(filePath: string): ScoreRunResult {
  const raw = fs.readFileSync(filePath, 'utf8');
  const full = JSON.parse(raw) as FullRunJson;
  return scoreRunHeuristics(full);
}
