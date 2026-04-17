import { ReplyClass } from '../types/enums.js';
import type { ReplyClassification } from '../types/entities.js';

/** Heuristic v1 — replace with model-based classifier later. */
export function classifyReply(text: string): ReplyClassification {
  const t = text.toLowerCase();
  if (/\b(unsubscribe|remove me|stop emailing)\b/.test(t)) {
    return { reply_class: ReplyClass.unsubscribe, confidence: 0.9, rationale: 'opt-out phrases' };
  }
  if (/\b(spam|scam|phishing)\b/.test(t)) {
    return { reply_class: ReplyClass.spam_risk, confidence: 0.75, rationale: 'spam signals' };
  }
  if (/\b(not interested|no thanks|pass)\b/.test(t)) {
    return { reply_class: ReplyClass.objection, confidence: 0.7, rationale: 'negative interest' };
  }
  if (/\b(next quarter|not now|later|ping me in)\b/.test(t)) {
    return { reply_class: ReplyClass.not_now, confidence: 0.65, rationale: 'timing deferral' };
  }
  if (/\b(yes|sounds good|let's|schedule|book|interested)\b/.test(t)) {
    return { reply_class: ReplyClass.positive_intent, confidence: 0.72, rationale: 'positive markers' };
  }
  return { reply_class: ReplyClass.neutral, confidence: 0.5, rationale: 'default' };
}
