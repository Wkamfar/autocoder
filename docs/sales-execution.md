# Sales — Phase 4 execution (`SalesAction` + policy)

Phase 4 introduces **executable units** with **guardrails**: the system can
represent “send this follow-up” as a structured `SalesAction`, run it through
policy, record approval, and append an **immutable audit** line — without hiding
what happened.

This repo **does not** ship a production email adapter or background auto-send.
Those belong behind explicit config and integration work. The hard part — **schema

- policy + audit** — is here.

## `SalesAction` schema (v1)


| Field                                                     | Purpose                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `action_id`                                               | Stable id for audit / CRM correlation                                      |
| `action_type`                                             | e.g. `send_followup`, `send_scheduling_nudge`, or custom                   |
| `status`                                                  | `draft` → `pending_`* → `approved` / `rejected` → `executed` / `failed`    |
| `execution_mode`                                          | `human` · `assisted` · `auto` (auto is downgraded unless globally enabled) |
| `approval_required`                                       | Forces human approval record before `allowed`                              |
| `origin`                                                  | `pair_debate`, `single_decision`, `manual`, …                              |
| `run_id`                                                  | Link back to debate / decision run                                         |
| `deal_id` / `account_id`                                  | Scope                                                                      |
| `decision_context`                                        | Why this action exists                                                     |
| `final_message`                                           | Body to send (or sent)                                                     |
| `recipient`                                               | `email`, `contact_id`                                                      |
| `created_at`, `approved_by`, `approved_at`, `executed_at` | Audit timeline                                                             |
| `outcome_notes`                                           | Hook for reply / CRM outcome                                               |
| `policy_evaluation`                                       | Optional last `PolicyEvaluation` snapshot                                  |


See `src/sales/execution/types.ts` and `examples/sales-action.sample.json`.

## Policy system (three layers)

`evaluateSalesActionPolicy(action, context?)` returns a `PolicyEvaluation`:

1. **Policy** — message size, optional **email domain allowlist**, banned phrases / claims.
2. **Suppression** — account opt-out flag, configurable substring patterns (e.g. legal risk).
3. **Approval** — deal size threshold, enterprise flag, `approval_required`, optional
  action types that always need a human sign-off.

`allowed === true` only if policy + suppression pass **and** approval obligations
are satisfied (e.g. `approved_at` / `approved_by` when required).

`effective_execution_mode` reflects global rules: if `SALES_EXEC_AUTO_SEND_ENABLED`
is off, requested `auto` becomes `assisted`.

## Audit log

Append-only JSONL (default `state/sales-actions.jsonl`, or `SALES_EXEC_AUDIT_PATH`):

```bash
nightshift sales sales-action audit-append ./my-action.json
```

Each line should be a full `SalesAction` (often with `policy_evaluation` filled
before append in your integration).

## CLI

```bash
# Evaluate policy; exit 0 if allowed, 1 if not
nightshift sales sales-action policy-eval <action.json> [context.json]
```

`context.json` (optional) can include:

- `deal_value_usd`, `enterprise_deal`
- `recipient_email`, `message_body` (override action fields for checks)
- `account_opted_out`

## Environment variables


| Variable                              | Meaning                                          |
| ------------------------------------- | ------------------------------------------------ |
| `SALES_EXEC_AUTO_SEND_ENABLED`        | `1` allows `auto` mode (default off)             |
| `SALES_EXEC_REQUIRE_DOMAIN_ALLOWLIST` | If `1`, recipient domain must match list         |
| `SALES_EXEC_ALLOWED_EMAIL_DOMAINS`    | Comma-separated allowed domains                  |
| `SALES_EXEC_BANNED_PHRASES`           | Substrings that fail policy                      |
| `SALES_EXEC_SUPPRESSION_PATTERNS`     | Substrings that fail suppression                 |
| `SALES_EXEC_MAX_MESSAGE_CHARS`        | Max body length                                  |
| `SALES_EXEC_APPROVAL_MIN_DEAL_USD`    | Always require approval at/above this deal value |
| `SALES_EXEC_ENTERPRISE_APPROVAL`      | If `1`, `enterprise_deal` forces approval path   |
| `SALES_EXEC_APPROVAL_ACTION_TYPES`    | Types that always require approval               |
| `SALES_EXEC_AUDIT_PATH`               | Override audit JSONL path                        |


## Drafting from Pair Debate

Use `draftSalesActionFromPairDebate()` (`src/sales/execution/draftFromSynthesis.ts`)
to turn synthesis into a **draft** `SalesAction` (`execution_mode: assisted`,
`approval_required: true`). Then run policy, collect approval, append audit, and
only then integrate a send adapter.

## Relationship to Phase 5

Outcome logs feed `**SalesStrategyProfile`** extraction (`nightshift sales strategy-extract`),
which in turn biases debates and decision ranking — still with explicit `n` and
warnings. See [sales-intelligence.md](./sales-intelligence.md).

## Rollout posture


| Level             | Behavior                                                     |
| ----------------- | ------------------------------------------------------------ |
| **Now (default)** | Assisted + explicit approval + policy + audit                |
| **Later**         | Email adapter, still gated                                   |
| **Future**        | Auto for low-risk actions only, with the same policy + audit |


This is **trustworthy automation**: visibility and policy first, velocity second.