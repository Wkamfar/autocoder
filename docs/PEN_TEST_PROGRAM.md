# Pen Testing Program (Agent 10)

This defines how Wire2 runs recurring penetration tests and turns findings into enforceable gates.

## Cadence

- **Pre-launch**: full external penetration test within 30 days of launch
- **Recurring**: at least **quarterly**, and additionally after major trust-boundary changes:
  - new auth method / SSO rollout
  - new bank connector/provider
  - new public routes or webhook surface changes
  - new storage provider or evidence bundle format changes

## Scope (minimum)

- Auth/session flows and account recovery
- Tenant isolation boundaries (read/write)
- Webhook creation, signing verification, replay protections, SSRF guardrails
- Evidence export + verification flows
- Admin/support tooling (auditability + least privilege)

## Rules of engagement

- Provide staging environment access with safe seeded data
- Provide test tenant accounts with least privilege plus one admin
- Define allowed load/DoS testing windows

## Output requirements

- Severity ratings + proof of exploitability
- Reproduction steps and affected endpoints
- Recommendations and compensating controls
- Fix verification steps

## Tracking & closure

- Findings are tracked against `wire2/docs/VULNERABILITY_TRIAGE_SLAS.md`
- Critical/High findings require a regression test or a new CI gate before closure

