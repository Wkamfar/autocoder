import { config } from '../../config.js';
import type {
  ExecutionMode,
  PolicyEvaluation,
  SalesAction,
  SalesActionPolicyContext,
} from './types.js';

function normalizeEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Layer 1 — Policy: domains, banned phrases, size limits, claim hygiene.
 */
function checkPolicyLayer(
  body: string | undefined,
  recipientEmail: string | undefined
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  const ex = config.salesExecution;
  const maxChars = ex.maxMessageChars;
  if (body != null && body.length > maxChars) {
    violations.push(`message exceeds max length (${body.length} > ${maxChars})`);
  }

  const domains = ex.allowedEmailDomains;
  if (ex.requireDomainAllowlist && domains.length === 0) {
    violations.push(
      'domain allowlist is enforced but SALES_EXEC_ALLOWED_EMAIL_DOMAINS is empty'
    );
  }
  if (domains.length > 0 && ex.requireDomainAllowlist) {
    if (!recipientEmail) {
      violations.push('recipient email required when domain allowlist is enforced');
    } else {
      const dom = normalizeEmailDomain(recipientEmail);
      if (!dom || !domains.some((d) => dom === d.toLowerCase() || dom.endsWith(`.${d.toLowerCase()}`))) {
        violations.push(
          `recipient domain not in allowlist (allowed: ${domains.join(', ')})`
        );
      }
    }
  }

  for (const phrase of ex.bannedPhrases) {
    if (phrase && body?.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`banned phrase or claim: "${phrase}"`);
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Layer 2 — Suppression: opt-out, spam/legal risk heuristics.
 */
function checkSuppressionLayer(
  body: string | undefined,
  context: SalesActionPolicyContext
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (context.account_opted_out) {
    violations.push('account opted out of automated sales actions');
  }
  const combined = `${body ?? ''}`.toLowerCase();
  for (const pat of config.salesExecution.suppressionPatterns) {
    if (pat && combined.includes(pat.toLowerCase())) {
      violations.push(`suppression pattern matched: ${pat}`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Layer 3 — Approval: high value, enterprise, risky action types.
 */
function checkApprovalLayer(
  action: SalesAction,
  context: SalesActionPolicyContext
): {
  ok: boolean;
  violations: string[];
  requires_human_approval: boolean;
} {
  const violations: string[] = [];
  const ex = config.salesExecution;
  const dealVal = context.deal_value_usd ?? 0;
  let requires =
    !!action.approval_required ||
    (dealVal >= ex.approvalMinDealValueUsd && ex.approvalMinDealValueUsd > 0) ||
    !!(context.enterprise_deal && ex.enterpriseRequiresApproval);

  for (const t of ex.actionTypesRequiringApproval) {
    if (t && action.action_type === t) {
      requires = true;
      break;
    }
  }

  if (requires && !action.approved_at) {
    violations.push('human approval required before execution');
  }

  return {
    ok: violations.length === 0,
    violations,
    requires_human_approval: requires,
  };
}

/** Downgrade auto mode when global auto-send is off. */
function clampExecutionMode(requested: ExecutionMode): ExecutionMode {
  if (!config.salesExecution.autoSendEnabled && requested === 'auto') {
    return 'assisted';
  }
  return requested;
}

/**
 * Full policy pass — does not mutate `action`; returns evaluation for attaching + audit.
 */
export function evaluateSalesActionPolicy(
  action: SalesAction,
  context: SalesActionPolicyContext = {}
): PolicyEvaluation {
  const notes: string[] = [];
  const body = context.message_body ?? action.final_message;
  const recipientEmail = context.recipient_email ?? action.recipient?.email;

  const policy = checkPolicyLayer(body, recipientEmail);
  const suppression = checkSuppressionLayer(body, context);
  const approvalGate = checkApprovalLayer(action, context);

  const approval = {
    ok: approvalGate.ok,
    violations: approvalGate.violations,
    requires_human_approval: approvalGate.requires_human_approval,
  };

  const layersOk = policy.ok && suppression.ok;
  const allowed =
    layersOk &&
    (!approval.requires_human_approval || Boolean(action.approved_at && action.approved_by));

  if (!config.salesExecution.autoSendEnabled && action.execution_mode === 'auto') {
    notes.push('auto-send disabled globally — effective mode assisted');
  }

  const effective_execution_mode = clampExecutionMode(action.execution_mode);

  return {
    evaluated_at: new Date().toISOString(),
    allowed,
    layers: {
      policy,
      suppression,
      approval,
    },
    effective_execution_mode,
    notes,
  };
}
