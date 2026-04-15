import { randomUUID } from 'node:crypto';
import type { DisagreementEntry, PairDebateBlackboard } from './types.js';

export function emptyBlackboard(seedFacts: string[] = []): PairDebateBlackboard {
  return {
    facts_locked: [...seedFacts],
    hypotheses: [],
    open_questions: [],
    missing_evidence: [],
    risks: [],
    buyer_state_hypothesis: 'interested_but_busy',
    disagreement_register: [],
    recommended_next_move: null,
    draft_email_v_next: null,
  };
}

/** Best-effort parse of model output: find last ```json ... ``` fence. */
export function extractBlackboardJson(text: string): unknown | null {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  if (fences.length === 0) return null;
  const raw = fences[fences.length - 1]?.[1]?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isDisagreementEntry(x: unknown): x is DisagreementEntry {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.topic === 'string' &&
    typeof o.closer_view === 'string' &&
    typeof o.buyer_mind_view === 'string' &&
    (o.status === 'open' || o.status === 'resolved') &&
    (o.id === undefined || typeof o.id === 'string')
  );
}

function normalizeBlackboardPatch(raw: unknown): Partial<PairDebateBlackboard> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<PairDebateBlackboard> = {};
  if (Array.isArray(o.facts_locked)) out.facts_locked = o.facts_locked.map(String);
  if (Array.isArray(o.hypotheses)) out.hypotheses = o.hypotheses.map(String);
  if (Array.isArray(o.open_questions)) out.open_questions = o.open_questions.map(String);
  if (Array.isArray(o.missing_evidence)) out.missing_evidence = o.missing_evidence.map(String);
  if (Array.isArray(o.risks)) out.risks = o.risks.map(String);
  if (typeof o.buyer_state_hypothesis === 'string') {
    out.buyer_state_hypothesis = o.buyer_state_hypothesis;
  }
  if (o.recommended_next_move === null || typeof o.recommended_next_move === 'string') {
    out.recommended_next_move = o.recommended_next_move as string | null;
  }
  if (o.draft_email_v_next === null || typeof o.draft_email_v_next === 'string') {
    out.draft_email_v_next = o.draft_email_v_next as string | null;
  }
  if (Array.isArray(o.disagreement_register)) {
    const reg: DisagreementEntry[] = [];
    for (const e of o.disagreement_register) {
      if (!isDisagreementEntry(e)) continue;
      const id =
        typeof (e as { id?: string }).id === 'string' && (e as { id: string }).id.trim()
          ? (e as { id: string }).id
          : randomUUID();
      reg.push({
        id,
        topic: e.topic,
        closer_view: e.closer_view,
        buyer_mind_view: e.buyer_mind_view,
        status: e.status,
        resolution_reason:
          typeof (e as { resolution_reason?: string }).resolution_reason === 'string'
            ? (e as { resolution_reason?: string }).resolution_reason
            : undefined,
      });
    }
    out.disagreement_register = reg;
  }
  return out;
}

function mergeStringLists(base: string[], patch?: string[]): string[] {
  if (!patch || patch.length === 0) return [...base];
  const set = new Set(base);
  for (const s of patch) {
    if (s.trim()) set.add(s.trim());
  }
  return [...set];
}

/**
 * Merge proposed blackboard onto previous per plan rules:
 * - list fields: union (preserve prior)
 * - disagreement_register: never drop open rows without resolved+reason in incoming
 */
export function mergeBlackboard(
  previous: PairDebateBlackboard,
  proposedPatch: unknown,
  _role: 'closer' | 'buyer_mind'
): PairDebateBlackboard {
  const patch = normalizeBlackboardPatch(proposedPatch);
  if (!patch) return { ...previous, disagreement_register: [...previous.disagreement_register] };

  const merged: PairDebateBlackboard = {
    facts_locked: mergeStringLists(previous.facts_locked, patch.facts_locked),
    hypotheses: mergeStringLists(previous.hypotheses, patch.hypotheses),
    open_questions: mergeStringLists(previous.open_questions, patch.open_questions),
    missing_evidence: mergeStringLists(previous.missing_evidence, patch.missing_evidence),
    risks: mergeStringLists(previous.risks, patch.risks),
    buyer_state_hypothesis: patch.buyer_state_hypothesis ?? previous.buyer_state_hypothesis,
    recommended_next_move:
      patch.recommended_next_move !== undefined ? patch.recommended_next_move : previous.recommended_next_move,
    draft_email_v_next:
      patch.draft_email_v_next !== undefined ? patch.draft_email_v_next : previous.draft_email_v_next,
    disagreement_register: mergeDisagreementRegister(previous.disagreement_register, patch.disagreement_register),
  };
  return merged;
}

function mergeDisagreementRegister(
  prev: DisagreementEntry[],
  incoming?: DisagreementEntry[]
): DisagreementEntry[] {
  if (!incoming || incoming.length === 0) return prev.map((x) => ({ ...x }));

  const byId = new Map<string, DisagreementEntry>();
  for (const e of prev) {
    byId.set(e.id, { ...e });
  }
  for (const e of incoming) {
    const existing = byId.get(e.id);
    if (existing && existing.status === 'open' && e.status === 'resolved') {
      if (!e.resolution_reason || !e.resolution_reason.trim()) {
        // Reject silent resolution — keep open
        continue;
      }
    }
    if (existing && existing.status === 'open' && e.status === 'open') {
      byId.set(e.id, {
        ...existing,
        ...e,
        id: existing.id,
        status: 'open',
      });
      continue;
    }
    byId.set(e.id, { ...e });
  }

  // Restore any open from prev that incoming omitted (models cannot delete opens)
  for (const e of prev) {
    if (e.status !== 'open') continue;
    const now = byId.get(e.id);
    if (!now) {
      byId.set(e.id, { ...e });
      continue;
    }
    if (now.status === 'open') continue;
    if (now.status === 'resolved' && now.resolution_reason) continue;
    byId.set(e.id, { ...e });
  }

  return [...byId.values()];
}
