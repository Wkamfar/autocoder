import { SessionManager } from '../../engines/session-manager.js';
import { config } from '../../config.js';
import type { EngineName } from '../../types.js';
import type { DossierPack, FinalDebateSynthesis, PairDebateBlackboard } from './types.js';
import { extractBlackboardJson } from './blackboard.js';

const SYNTH_SYSTEM = `You are the synthesis step for Pair Debate (sales). You receive the dossier, final blackboard, and full debate transcript.
Output ONLY valid JSON (no markdown fences) matching this shape:
{
  "agreement": string[],
  "remaining_disagreements": (string | { topic: string; closer_view?: string; buyer_mind_view?: string })[],
  "recommended_single_next_step": string,
  "why_now": string,
  "what_could_go_wrong": string[],
  "human_decision_required": boolean,
  "draft_artifact": { "type": string, "content": string },
  "confidence": string (optional),
  "what_would_change_the_recommendation": string[] (optional)
}
Preserve unresolved disagreement honestly. Do not fake consensus.`;

export function parseFinalSynthesisFromText(text: string): FinalDebateSynthesis {
  let parsed: unknown = extractBlackboardJson(text);
  if (parsed === null) {
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      parsed = {};
    }
  }
  return coerceSynthesis(parsed);
}

function coerceSynthesis(raw: unknown): FinalDebateSynthesis {
  if (!raw || typeof raw !== 'object') {
    return {
      agreement: [],
      remaining_disagreements: [],
      recommended_single_next_step: '(synthesis parse failed)',
      why_now: '',
      what_could_go_wrong: [],
      human_decision_required: true,
      draft_artifact: { type: 'email', content: '' },
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    agreement: Array.isArray(o.agreement) ? o.agreement.map(String) : [],
    remaining_disagreements: Array.isArray(o.remaining_disagreements)
      ? o.remaining_disagreements
      : [],
    recommended_single_next_step: String(o.recommended_single_next_step ?? ''),
    why_now: String(o.why_now ?? ''),
    what_could_go_wrong: Array.isArray(o.what_could_go_wrong)
      ? o.what_could_go_wrong.map(String)
      : [],
    human_decision_required: Boolean(o.human_decision_required ?? true),
    draft_artifact:
      o.draft_artifact && typeof o.draft_artifact === 'object'
        ? {
            type: String((o.draft_artifact as { type?: string }).type ?? 'email'),
            content: String((o.draft_artifact as { content?: string }).content ?? ''),
          }
        : { type: 'email', content: '' },
    confidence: o.confidence != null ? String(o.confidence) : undefined,
    what_would_change_the_recommendation: Array.isArray(o.what_would_change_the_recommendation)
      ? o.what_would_change_the_recommendation.map(String)
      : undefined,
  };
}

export async function runSynthesis(params: {
  sessions: SessionManager;
  dossier: DossierPack;
  finalBlackboard: PairDebateBlackboard;
  transcriptMarkdown: string;
  engine?: EngineName;
  model?: string;
}): Promise<{ synthesis: FinalDebateSynthesis; raw: string; tokens: number; cost_usd: number }> {
  const engine = params.engine ?? 'claude';
  const model =
    params.model ??
    (engine === 'claude'
      ? config.engines.claudeModel
      : engine === 'codex'
        ? config.engines.codexModel
        : config.engines.claudeModel);

  const prompt = [
    '# Dossier (truth layer)',
    params.dossier.body.slice(0, config.pairDebate.maxPromptChars),
    '',
    '# Final blackboard (JSON)',
    JSON.stringify(params.finalBlackboard, null, 2),
    '',
    '# Transcript',
    params.transcriptMarkdown.slice(0, config.pairDebate.maxPromptChars),
    '',
    'Produce the synthesis JSON now.',
  ].join('\n');

  const session = await params.sessions.create(
    engine,
    {
      projectDir: config.project.dir,
      model,
      maxTurns: 4,
      systemPrompt: SYNTH_SYSTEM,
      allowedTools: ['Read'],
    },
    `pair-debate-synth-${Date.now()}`
  );

  try {
    const result = await session.send(prompt);
    return {
      synthesis: parseFinalSynthesisFromText(result.text),
      raw: result.text,
      tokens: result.tokens,
      cost_usd: result.cost_usd,
    };
  } finally {
    await params.sessions.destroy(session.id);
  }
}
