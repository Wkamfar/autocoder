import React from "react";
import { Link } from "react-router-dom";

function InlineCode({ children }: { children: React.ReactNode }) {
  return <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{children}</span>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="text-xs sm:text-sm font-mono whitespace-pre overflow-x-auto bg-gray-950 text-gray-100 rounded-xl p-4 border border-gray-800">
      <code>{children}</code>
    </pre>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-gray-900">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-gray-900">{children}</h3>;
}

function Hr() {
  return <div className="h-px bg-gray-200 my-6" />;
}

/**
 * WIRE API Log (RFC-style, accuracy-first)
 *
 * IMPORTANT: This content is intentionally derived from the backend route definitions in `wire2/backend/src/routes/*`.
 * It is written for bank diligence: stable paths, headers, permissions, and common error shapes.
 */
export function WireHelpLogContent() {
  const openApiUrl = `${import.meta.env.BASE_URL}api/openapi.json`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Log</h1>
        <p className="text-gray-700">
          Engineering log for bank diligence. This is an RFC-style developer reference for the WIRE v2 HTTP API:
          authentication, headers, idempotency, and a complete endpoint catalog.
        </p>
        <div className="text-sm text-gray-600">
          <div>
            <strong>Base URL:</strong> <InlineCode>https://wire.pose.xyz</InlineCode>
          </div>
          <div>
            <strong>API prefixes:</strong> <InlineCode>/api</InlineCode> (platform) and <InlineCode>/api/wire</InlineCode> (WIRE product)
          </div>
        </div>
      </div>

      <Hr />

      <section className="space-y-3">
        <H2>1. Conventions</H2>
        <ul className="text-sm text-gray-700 space-y-2 ml-4 list-disc">
          <li>
            <strong>JSON everywhere</strong>: unless explicitly noted (voice proof upload uses multipart).
          </li>
          <li>
            <strong>Error shape</strong>: most endpoints return <InlineCode>{"{ error: string, code?: string }"}</InlineCode> on failures.
          </li>
          <li>
            <strong>Org boundary</strong>: authenticated routes operate inside the caller’s <InlineCode>orgId</InlineCode>.
          </li>
          <li>
            <strong>Evidence primitives</strong>: intents emit an event chain; bundles can be generated and verified.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2>2. Authentication</H2>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            WIRE uses session-token auth via Bearer tokens.
          </p>
          <ul className="space-y-2 ml-4 list-disc">
            <li>
              <strong>Bearer session token</strong>: <InlineCode>Authorization: Bearer &lt;token&gt;</InlineCode>
            </li>
          </ul>

          <H3>2.1 Login</H3>
          <CodeBlock
            children={[
              "curl -sS -X POST https://wire.pose.xyz/api/auth/login \\",
              "  -H 'Content-Type: application/json' \\",
              "  -d '{\"email\":\"mark.approver@acmebanking.com\"}'",
              "",
              "# Response:",
              "# { \"token\": \"...\", \"sessionId\": \"...\", \"user\": { \"id\": \"...\", \"email\": \"...\", \"name\": \"...\", \"role\": \"APPROVER\" } }",
            ].join("\n")}
          />

          <H3>2.2 Logout</H3>
          <CodeBlock
            children={[
              "curl -sS -X POST https://wire.pose.xyz/api/auth/logout \\",
              "  -H 'Authorization: Bearer <token>'",
              "",
              "# Response:",
              "# { \"success\": true }",
            ].join("\n")}
          />
        </div>
      </section>

      <section className="space-y-3">
        <H2>3. Idempotency (mutating endpoints)</H2>
        <p className="text-sm text-gray-700">
          For mutation endpoints under <InlineCode>/api/wire</InlineCode>, the backend supports idempotency via{" "}
          <InlineCode>X-Idempotency-Key</InlineCode>. When set, repeated requests with the same key should not
          produce duplicate side-effects.
        </p>
        <CodeBlock
          children={[
            "curl -sS -X POST https://wire.pose.xyz/api/wire/intents/<intentId>/execute \\",
            "  -H 'Authorization: Bearer <token>' \\",
            "  -H 'X-POSE-APPROVAL: <approvalToken>' \\",
            "  -H 'X-Idempotency-Key: exec-2026-01-13T21:00:00Z-001' \\",
            "  -H 'Content-Type: application/json' \\",
            "  -d '{}' ",
          ].join("\n")}
        />
      </section>

      <section className="space-y-3">
        <H2>4. Critical headers</H2>
        <div className="text-sm text-gray-700 space-y-2">
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong>Execution approval token</strong>: <InlineCode>X-POSE-APPROVAL</InlineCode> (required for{" "}
              <InlineCode>POST /api/wire/intents/:id/execute</InlineCode>)
            </li>
            <li>
              <strong>Idempotency</strong>: <InlineCode>X-Idempotency-Key</InlineCode> (optional, recommended for mutations)
            </li>
            <li>
              <strong>Session</strong>: <InlineCode>Authorization: Bearer ...</InlineCode>
            </li>
          </ul>
        </div>
      </section>

      <Hr />

      <section className="space-y-3">
        <H2>5. Endpoint catalog (complete)</H2>
        <p className="text-sm text-gray-700">
          This catalog is grouped by backend route module. Where a permission is listed, the route enforces it via RBAC.
        </p>

        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm text-gray-700">
          <div className="font-semibold text-gray-900 mb-1">Optional: machine-readable spec</div>
          <div>
            The UI serves an OpenAPI JSON at <a className="underline font-semibold" href={openApiUrl}>{openApiUrl}</a>. If it ever
            disagrees with the catalog below, treat the catalog below as authoritative (it is derived from server routes).
          </div>
        </div>

        <Hr />

        <H3>A) Platform health (root)</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /health</InlineCode> — liveness</li>
          <li><InlineCode>GET /ready</InlineCode> — readiness (503 if dependencies are not ready)</li>
        </ul>

        <Hr />

        <H3>B) Public onboarding (no auth)</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>POST /api/signup</InlineCode> — create org + admin user</li>
        </ul>

        <Hr />

        <H3>C) Public intents (no auth) + claim flow (auth)</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>POST /api/public/intents</InlineCode> — create a public intent (returns one-time claim token + claim URL)</li>
          <li><InlineCode>GET /api/public/intents/:id</InlineCode> — fetch a public intent (safe fields only)</li>
          <li><InlineCode>POST /api/wire/public-intents/:id/claim</InlineCode> — claim into org (permission: <InlineCode>intent:create</InlineCode>)</li>
        </ul>

        <Hr />

        <H3>D) Auth & sessions</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/auth/oidc/authorize</InlineCode> — OIDC: generate authorize URL (OIDC mode)</li>
          <li><InlineCode>GET /api/auth/oidc/callback</InlineCode> — OIDC callback (OIDC mode)</li>
          <li><InlineCode>POST /api/auth/login</InlineCode> — login (returns Bearer token)</li>
          <li><InlineCode>POST /api/auth/refresh</InlineCode> — refresh session token</li>
          <li><InlineCode>POST /api/auth/logout</InlineCode> — logout</li>
          <li><InlineCode>POST /api/auth/sessions/revoke-all</InlineCode> — revoke all sessions (permission: <InlineCode>session:revoke</InlineCode>)</li>
        </ul>

        <Hr />

        <H3>E) Organization</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/organizations/current</InlineCode> — current org</li>
          <li><InlineCode>PATCH /api/organizations/current</InlineCode> — update org (permission: <InlineCode>org:edit</InlineCode>)</li>
          <li><InlineCode>POST /api/organizations</InlineCode> — create org (onboarding)</li>
        </ul>

        <Hr />

        <H3>F) WIRE service health (under /api/wire)</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/health</InlineCode> — liveness</li>
          <li><InlineCode>GET /api/wire/health/ready</InlineCode> — readiness</li>
          <li><InlineCode>GET /api/wire/metrics</InlineCode> — Prometheus metrics</li>
        </ul>

        <Hr />

        <H3>G) Intents (core money movement object)</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/intents</InlineCode> — list intents</li>
          <li><InlineCode>GET /api/wire/intents/:id</InlineCode> — intent detail</li>
          <li><InlineCode>GET /api/wire/intents/:id/approval-status</InlineCode> — derived approval ladder (requires auth)</li>
          <li><InlineCode>POST /api/wire/intents</InlineCode> — create intent (permission: <InlineCode>intent:create</InlineCode>)</li>
          <li><InlineCode>PATCH /api/wire/intents/:id</InlineCode> — edit intent (permission: <InlineCode>intent:create</InlineCode>)</li>
        </ul>

        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="font-semibold text-gray-900">Voice challenge + proof</div>
          <ul className="ml-4 list-disc space-y-1">
            <li><InlineCode>POST /api/wire/intents/:id/challenge</InlineCode> — create challenge (transitions intent to CHALLENGING)</li>
            <li>
              <InlineCode>POST /api/wire/challenges/:challengeId/proof</InlineCode> — submit proof (multipart, form field{" "}
              <InlineCode>audio</InlineCode>)
            </li>
          </ul>
        </div>

        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="font-semibold text-gray-900">Decisions + execution</div>
          <ul className="ml-4 list-disc space-y-1">
            <li><InlineCode>POST /api/wire/intents/:id/decision</InlineCode> — APPROVE / DENY / STEP_UP (permission: <InlineCode>intent:approve</InlineCode>)</li>
            <li><InlineCode>POST /api/wire/intents/:id/execution-token</InlineCode> — mint execution token (permission: <InlineCode>intent:execute</InlineCode>)</li>
            <li><InlineCode>POST /api/wire/intents/:id/execute</InlineCode> — execute (permission: <InlineCode>intent:execute</InlineCode>, requires <InlineCode>X-POSE-APPROVAL</InlineCode>)</li>
          </ul>
        </div>

        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="font-semibold text-gray-900">Evidence</div>
          <ul className="ml-4 list-disc space-y-1">
            <li><InlineCode>GET /api/wire/intents/:id/events</InlineCode> — event log</li>
            <li><InlineCode>GET /api/wire/intents/:id/events/verify</InlineCode> — verify event-chain integrity</li>
            <li><InlineCode>POST /api/wire/intents/:id/bundle?mode=full|redacted</InlineCode> — generate audit bundle (permission: <InlineCode>evidence:view</InlineCode>)</li>
            <li><InlineCode>GET /api/wire/bundles/:id/verify</InlineCode> — verify bundle signature</li>
            <li><InlineCode>GET /api/wire/bundles/:id/download</InlineCode> — get presigned download URL</li>
          </ul>
        </div>

        <Hr />

        <H3>H) Beneficiaries</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/beneficiaries</InlineCode> — list</li>
          <li><InlineCode>POST /api/wire/beneficiaries</InlineCode> — create (permission: <InlineCode>beneficiary:create</InlineCode>)</li>
          <li><InlineCode>PATCH /api/wire/beneficiaries/:id</InlineCode> — update (permission: <InlineCode>beneficiary:create</InlineCode>)</li>
        </ul>

        <Hr />

        <H3>I) Policies</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/policies</InlineCode> — fetch active policy</li>
          <li><InlineCode>POST /api/wire/policies</InlineCode> — create policy version (permission: <InlineCode>policy:edit</InlineCode>)</li>
          <li><InlineCode>POST /api/wire/policies/simulate</InlineCode> — compute risk/controls for a hypothetical transfer</li>
        </ul>

        <Hr />

        <H3>J) Users</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/me</InlineCode> — current user + org</li>
          <li><InlineCode>GET /api/wire/users</InlineCode> — list users (permission: <InlineCode>user:view</InlineCode>)</li>
          <li><InlineCode>GET /api/wire/users/:id</InlineCode> — user detail (permission: <InlineCode>user:view</InlineCode>)</li>
          <li><InlineCode>POST /api/wire/users</InlineCode> — create user (permission: <InlineCode>user:create</InlineCode>)</li>
          <li><InlineCode>PATCH /api/wire/users/:id</InlineCode> — update user (permission: <InlineCode>user:edit</InlineCode>)</li>
          <li><InlineCode>DELETE /api/wire/users/:id</InlineCode> — soft-delete user (permission: <InlineCode>user:delete</InlineCode>)</li>
        </ul>

        <Hr />

        <H3>K) Admin analytics</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/admin/metrics</InlineCode> — dashboard metrics (permission: <InlineCode>admin:view</InlineCode>)</li>
        </ul>

        <Hr />

        <H3>L) API keys</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/api-keys</InlineCode> — list (permission: <InlineCode>api:view</InlineCode>)</li>
          <li><InlineCode>POST /api/wire/api-keys</InlineCode> — create (permission: <InlineCode>api:create</InlineCode>)</li>
          <li><InlineCode>POST /api/wire/api-keys/:id/revoke</InlineCode> — revoke (permission: <InlineCode>api:edit</InlineCode>)</li>
          <li><InlineCode>DELETE /api/wire/api-keys/:id</InlineCode> — delete (permission: <InlineCode>api:delete</InlineCode>)</li>
        </ul>

        <Hr />

        <H3>M) Webhooks</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/webhooks</InlineCode> — list (permission: <InlineCode>webhook:view</InlineCode>)</li>
          <li><InlineCode>POST /api/wire/webhooks</InlineCode> — create (permission: <InlineCode>webhook:create</InlineCode>)</li>
          <li><InlineCode>PATCH /api/wire/webhooks/:id</InlineCode> — update (permission: <InlineCode>webhook:edit</InlineCode>)</li>
          <li><InlineCode>DELETE /api/wire/webhooks/:id</InlineCode> — delete (permission: <InlineCode>webhook:delete</InlineCode>)</li>
        </ul>

        <Hr />

        <H3>N) Invitations</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>GET /api/wire/invitations</InlineCode> — list (permission: <InlineCode>user:view</InlineCode>)</li>
          <li><InlineCode>POST /api/wire/invitations</InlineCode> — create (permission: <InlineCode>user:create</InlineCode>)</li>
          <li><InlineCode>POST /api/wire/invitations/:id/revoke</InlineCode> — revoke (permission: <InlineCode>user:edit</InlineCode>)</li>
          <li><InlineCode>GET /api/wire/invitations/token/:token</InlineCode> — fetch invite (public)</li>
          <li><InlineCode>POST /api/wire/invitations/accept</InlineCode> — accept (public)</li>
        </ul>

        <Hr />

        <H3>O) Domains (org settings)</H3>
        <div className="text-sm text-gray-700">
          <p className="mb-2">
            These endpoints are restricted to <strong>ADMIN</strong> role.
            Manage via <Link className="underline font-semibold" to="/settings/domains">Settings → Domains</Link>.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><InlineCode>GET /api/wire/domains/custom</InlineCode></li>
            <li><InlineCode>POST /api/wire/domains/custom</InlineCode></li>
            <li><InlineCode>POST /api/wire/domains/custom/:id/verify</InlineCode></li>
            <li><InlineCode>DELETE /api/wire/domains/custom/:id</InlineCode></li>
            <li><InlineCode>GET /api/wire/domains/email</InlineCode></li>
            <li><InlineCode>POST /api/wire/domains/email</InlineCode></li>
            <li><InlineCode>POST /api/wire/domains/email/:id/verify</InlineCode></li>
            <li><InlineCode>DELETE /api/wire/domains/email/:id</InlineCode></li>
          </ul>
        </div>

        <Hr />

        <H3>P) Security history (audit log)</H3>
        <div className="text-sm text-gray-700">
          <p className="mb-2">
            Restricted to roles: <InlineCode>ADMIN</InlineCode>, <InlineCode>AUDITOR</InlineCode>.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><InlineCode>GET /api/wire/security-history?days=180&amp;limit=200</InlineCode></li>
          </ul>
        </div>

        <Hr />

        <H3>Q) Org groups (multi-account rollups)</H3>
        <div className="text-sm text-gray-700">
          <p className="mb-2">
            Restricted to role: <InlineCode>ADMIN</InlineCode>.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><InlineCode>GET /api/wire/org-groups</InlineCode></li>
            <li><InlineCode>POST /api/wire/org-groups</InlineCode></li>
            <li><InlineCode>POST /api/wire/org-groups/:groupId/members</InlineCode></li>
            <li><InlineCode>DELETE /api/wire/org-groups/:groupId/members/:orgId</InlineCode></li>
            <li><InlineCode>GET /api/wire/org-groups/:groupId/metrics</InlineCode></li>
          </ul>
        </div>

        <Hr />

        <H3>R) SSO policy (org-level)</H3>
        <div className="text-sm text-gray-700">
          <p className="mb-2">
            Restricted to role: <InlineCode>ADMIN</InlineCode>. Config UI:{" "}
            <Link className="underline font-semibold" to="/settings/sso">Settings → SSO</Link>.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><InlineCode>GET /api/wire/sso</InlineCode></li>
            <li><InlineCode>PUT /api/wire/sso</InlineCode></li>
          </ul>
        </div>

        <Hr />

        <H3>S) Sandbox (testing)</H3>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-1">
          <li><InlineCode>POST /api/sandbox/toggle</InlineCode></li>
          <li><InlineCode>GET /api/sandbox/status</InlineCode></li>
          <li><InlineCode>POST /api/sandbox/seed</InlineCode> — requires SANDBOX_MODE=true</li>
          <li><InlineCode>POST /api/sandbox/clear</InlineCode> — requires SANDBOX_MODE=true</li>
        </ul>
      </section>

      <Hr />

      <section className="space-y-3">
        <H2>6. Notes for diligence</H2>
        <ul className="text-sm text-gray-700 ml-4 list-disc space-y-2">
          <li>
            <strong>Voice proof upload</strong> uses multipart: <InlineCode>audio</InlineCode> file field +{" "}
            <InlineCode>transcript</InlineCode> + optional metadata.
          </li>
          <li>
            <strong>Execution safety</strong>: execution requires an approval token via <InlineCode>X-POSE-APPROVAL</InlineCode>.
            Executors can mint a token for an APPROVED intent via <InlineCode>/execution-token</InlineCode>.
          </li>
          <li>
            <strong>Auditability</strong>: event-chain verification and bundle signature verification are exposed via endpoints above.
          </li>
        </ul>
      </section>
    </div>
  );
}

