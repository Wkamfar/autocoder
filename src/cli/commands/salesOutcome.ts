import { appendOutcome } from '../../sales/pairDebate/outcomes.js';
import type { PairDebateOutcomeRecord } from '../../sales/pairDebate/types.js';

function parse(argv: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        o[key] = val;
        i++;
      } else {
        o[key] = 'true';
      }
    }
  }
  return o;
}

function parseBool(s: string | undefined): boolean | undefined {
  if (s === undefined) return undefined;
  if (/^(1|true|yes|on)$/i.test(s)) return true;
  if (/^(0|false|no|off)$/i.test(s)) return false;
  return undefined;
}

function parseHelpfulness(s: string | undefined): 1 | 2 | 3 | 4 | 5 | undefined {
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
  return n as 1 | 2 | 3 | 4 | 5;
}

function parseHumanModified(s: string | undefined): 'none' | 'light' | 'heavy' | undefined {
  if (s === undefined) return undefined;
  const v = s.toLowerCase();
  if (v === 'none' || v === 'light' || v === 'heavy') return v;
  return undefined;
}

export async function runPairDebateOutcomeCli(argv: string[]): Promise<void> {
  const o = parse(argv);
  const runId = o.run || o['run-id'];
  if (!runId) {
    console.error('usage: nightshift sales pair-debate-outcome --run <run_id> [options]');
    console.error(
      [
        'Core: --account --deal --contact --action sent_email|waited|skipped|other',
        '--email-type --outcome replied_positive|... --hours --stage-change',
        '--helpful true|false --tags tag1,tag2 --notes <text>',
        'Adoption: --recommended-used true|false --draft-as-is true|false',
        '--human-modified none|light|heavy --helpfulness 1-5',
        '--override-reason <text|token> (e.g. timing_changed, output_not_sharp_enough, other)',
      ].join('\n')
    );
    process.exit(2);
  }

  const tags = o.tags ? o.tags.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  const row: PairDebateOutcomeRecord = {
    ts: new Date().toISOString(),
    run_id: runId,
    account_id: o.account,
    deal_id: o.deal,
    contact_id: o.contact,
    debate_decision: o['debate-decision'],
    email_type: o['email-type'],
    action_taken: o.action as PairDebateOutcomeRecord['action_taken'],
    outcome: o.outcome as PairDebateOutcomeRecord['outcome'],
    time_to_reply_hours: o.hours ? Number(o.hours) : undefined,
    stage_change: o['stage-change'],
    debate_helpful: parseBool(o.helpful),
    scenario_tags: tags,
    notes: o.notes,
    recommended_action_used: parseBool(o['recommended-used']),
    draft_used_as_is: parseBool(o['draft-as-is']),
    human_modified: parseHumanModified(o['human-modified']),
    human_helpfulness_score: parseHelpfulness(o.helpfulness),
    human_override_reason: o['override-reason'],
  };

  const path = await appendOutcome(row);
  console.log(`logged outcome → ${path}`);
}
