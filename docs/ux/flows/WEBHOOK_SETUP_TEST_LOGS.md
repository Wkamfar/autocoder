# Flow: Webhook Setup + Test + Delivery Logs

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Webhook setup/test/logs
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Admin, Developer, Auditor (view-only)
- **Entry points**:
  - `/v2/settings/webhooks`
- **Related docs**:
  - `SETTINGS_INTEGRATIONS.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles: admin-level (policy-defined)
- Required org/tenant state: org exists; webhooks feature enabled
- Required integrations:
  - Outbound URL safety / SSRF guardrails
  - Webhook signing secrets (show once)

## Happy path (setup)
1. Admin opens `/v2/settings/webhooks`.
2. Admin creates a webhook:
   - name
   - HTTPS destination URL
   - subscribed event types
3. UI validates URL safety (blocks private IPs, localhost, link-local, etc. per guardrails).
4. UI shows the signing secret **once** and instructs safe storage.
5. Webhook appears in list with status and last delivery timestamp.

## Happy path (test)
1. Admin clicks “Send test event”.
2. UI shows progress and then a success/failure result.
3. UI links to the specific delivery attempt in logs.

## Happy path (delivery logs)
1. Admin opens “Delivery logs” for a webhook.
2. UI shows recent attempts with:
   - timestamp
   - event type
   - HTTP status
   - retry count / next retry (if applicable)
   - correlation/request ID
3. Admin can view a redacted payload preview and headers (signature present, secret never shown).

## Success criteria (must be true)
- **Correctness**
  - URL validation rejects unsafe destinations and explains why.
  - Test events are clearly marked as tests and do not pollute production analytics.
  - Delivery log entries match actual delivery attempts.
- **UX clarity**
  - Setup explains signing + verification (how to validate signature).
  - Logs show actionable troubleshooting steps (e.g., “Your server returned 500”).
- **Performance**
  - Logs paginate and load quickly; UI remains responsive.
- **Accessibility**
  - Logs table is keyboard navigable; details modal manages focus.
- **Security + trust**
  - Signing secret shown once; never re-displayed.
  - Payload previews are redacted; no secrets/tokens exposed.
  - Hard failures show request ID.

## Failure modes (expected + handling)
- **Unsafe URL**
  - UI: inline validation + link to SSRF guidance; block creation.
- **Destination rejects (4xx/5xx)**
  - UI: show status + retry policy + guidance; link to attempt details.
- **Timeout**
  - UI: show timeout; indicate retry schedule; allow re-test.
- **Permission denied**
  - UI: hide create/test actions; show required role.

## Telemetry + audit expectations
- **Client events**: `webhook_create`, `webhook_test_send`, `webhook_log_view`, `webhook_delete`
- **Audit log**: webhook create/update/delete + secret rotation events recorded with actor + org + request ID

## Test checklist (manual + automated)
- [ ] Unsafe URL rejected with clear reason
- [ ] Secret shown once on create
- [ ] Test event sends and is visible in logs
- [ ] Logs show correlation/request IDs
- [ ] Payload preview is redacted
- [ ] Keyboard-only
- [ ] Screen reader pass

