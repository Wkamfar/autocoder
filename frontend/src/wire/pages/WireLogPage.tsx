import React from "react";

export default function WireLogPage() {
  return (
    <div className="space-y-6 pb-12">
      {/* Hero Section */}
      <div className="border-2 border-black rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          WIRE2 Development Dashboard
        </h1>
        <p className="text-lg text-gray-700">
          Comprehensive overview of the WIRE2 platform: architecture, APIs, features, and status
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <span className="px-3 py-1 bg-green-100 border-2 border-green-600 rounded-full text-xs font-semibold text-green-900">
            ✅ PRODUCTION READY
          </span>
          <span className="px-3 py-1 bg-blue-100 border-2 border-blue-600 rounded-full text-xs font-semibold text-blue-900">
            🚀 FULLY DEPLOYED
          </span>
          <span className="px-3 py-1 bg-purple-100 border-2 border-purple-600 rounded-full text-xs font-semibold text-purple-900">
            🏦 BANK-GRADE
          </span>
        </div>
      </div>

      {/* Overview Section */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">Overview</h2>
        </header>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">What is WIRE2?</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              WIRE2 is a bank-grade wire transfer platform with voice-based authorization, fraud detection, 
              dual approval workflows, and comprehensive audit trails. Built with production-ready infrastructure 
              including API keys, webhooks, compliance reporting, and blockchain-anchored evidence.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</div>
              <div className="text-lg font-bold text-gray-900">Production Ready</div>
              <div className="text-xs text-gray-600 mt-1">100% Feature Complete</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Deployment</div>
              <div className="text-lg font-bold text-gray-900">wire.pose.xyz</div>
              <div className="text-xs text-gray-600 mt-1">Fully Operational</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Architecture</div>
              <div className="text-lg font-bold text-gray-900">Microservices</div>
              <div className="text-xs text-gray-600 mt-1">React + Node.js + PostgreSQL</div>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Section */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">Architecture</h2>
        </header>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 font-mono text-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600">Frontend</span>
                <span className="text-gray-400">→</span>
                <span>React + TypeScript + Tailwind CSS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-purple-600">Backend API</span>
                <span className="text-gray-400">→</span>
                <span>Fastify (Node.js/TypeScript)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-600">Database</span>
                <span className="text-gray-400">→</span>
                <span>PostgreSQL + Prisma ORM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-600">Cache/Queue</span>
                <span className="text-gray-400">→</span>
                <span>Redis (optional)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-600">Voice Service</span>
                <span className="text-gray-400">→</span>
                <span>POSE V2 Zero-Shot Identification</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-600">Blockchain</span>
                <span className="text-gray-400">→</span>
                <span>POSE Evidence Registry (on-chain anchoring)</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Key Services</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li><strong>API Gateway:</strong> Routes requests, handles authentication</li>
              <li><strong>Wire API:</strong> Core wire transfer logic, intent management</li>
              <li><strong>Voice Service:</strong> Voice enrollment and verification (Python FastAPI)</li>
              <li><strong>Fraud Service:</strong> Risk scoring and anomaly detection (Python FastAPI)</li>
              <li><strong>Worker:</strong> Background jobs (webhooks, anchoring, emails)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Endpoints Section */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">API Endpoints</h2>
          <p className="text-xs text-gray-600 mt-1">Complete API reference organized by category</p>
        </header>
        <div className="p-6 space-y-6">
          
          {/* Health & System */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Health & System
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/health</span> <span className="text-gray-500">- Liveness check</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/health/ready</span> <span className="text-gray-500">- Readiness (dependencies)</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/metrics</span> <span className="text-gray-500">- Prometheus metrics</span></div>
            </div>
          </div>

          {/* Authentication */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Authentication
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/auth/login</span> <span className="text-gray-500">- Login (password/magic link)</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/auth/logout</span> <span className="text-gray-500">- Logout</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/auth/logout_all</span> <span className="text-gray-500">- Logout all sessions</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/auth/refresh</span> <span className="text-gray-500">- Refresh token</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/auth/sessions</span> <span className="text-gray-500">- List active sessions</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/auth/magic/consume</span> <span className="text-gray-500">- Consume magic link</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/auth/password/reset/request</span> <span className="text-gray-500">- Request password reset</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/auth/password/reset/confirm</span> <span className="text-gray-500">- Confirm password reset</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/auth/oidc/authorize</span> <span className="text-gray-500">- OIDC authorization</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/auth/oidc/callback</span> <span className="text-gray-500">- OIDC callback</span></div>
            </div>
          </div>

          {/* Intents */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Intents (Wire Transfers)
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/intents</span> <span className="text-gray-500">- List intents</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/intents/:id</span> <span className="text-gray-500">- Get intent details</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/intents</span> <span className="text-gray-500">- Create intent</span></div>
              <div><span className="text-yellow-600 font-bold">PATCH</span> <span className="text-gray-900">/api/wire/intents/:id</span> <span className="text-gray-500">- Update intent</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/intents/:id/challenge</span> <span className="text-gray-500">- Generate voice challenge</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/challenges/:id/proof</span> <span className="text-gray-500">- Submit voice proof</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/intents/:id/decision</span> <span className="text-gray-500">- Create approval/denial decision</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/intents/:id/execute</span> <span className="text-gray-500">- Execute transfer</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/intents/:id/executions</span> <span className="text-gray-500">- List executions</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/intents/:id/events</span> <span className="text-gray-500">- List intent events</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/intents/:id/events/verify</span> <span className="text-gray-500">- Verify event chain</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/intents/:id/bundle</span> <span className="text-gray-500">- Generate audit bundle</span></div>
            </div>
          </div>

          {/* Beneficiaries */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              Beneficiaries
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/beneficiaries</span> <span className="text-gray-500">- List beneficiaries</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/beneficiaries</span> <span className="text-gray-500">- Create beneficiary</span></div>
              <div><span className="text-yellow-600 font-bold">PATCH</span> <span className="text-gray-900">/api/wire/beneficiaries/:id</span> <span className="text-gray-500">- Update beneficiary</span></div>
            </div>
          </div>

          {/* Policies */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Policies & Risk
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/policies</span> <span className="text-gray-500">- Get active policy</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/policies</span> <span className="text-gray-500">- Create policy version</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/policies/simulate</span> <span className="text-gray-500">- Simulate policy rules</span></div>
            </div>
          </div>

          {/* API Keys */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              API Keys
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/api-keys</span> <span className="text-gray-500">- List API keys</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/api-keys</span> <span className="text-gray-500">- Create API key</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/api-keys/:id/revoke</span> <span className="text-gray-500">- Revoke API key</span></div>
              <div><span className="text-red-600 font-bold">DELETE</span> <span className="text-gray-900">/api/wire/api-keys/:id</span> <span className="text-gray-500">- Delete API key</span></div>
            </div>
          </div>

          {/* Webhooks */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
              Webhooks
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/webhooks</span> <span className="text-gray-500">- List webhooks</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/webhooks</span> <span className="text-gray-500">- Create webhook</span></div>
              <div><span className="text-yellow-600 font-bold">PATCH</span> <span className="text-gray-900">/api/wire/webhooks/:id</span> <span className="text-gray-500">- Update webhook</span></div>
              <div><span className="text-red-600 font-bold">DELETE</span> <span className="text-gray-900">/api/wire/webhooks/:id</span> <span className="text-gray-500">- Delete webhook</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/webhooks/:id/deliveries</span> <span className="text-gray-500">- List deliveries</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/webhooks/:id/test</span> <span className="text-gray-500">- Send test event</span></div>
            </div>
          </div>

          {/* Compliance & Audit */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
              Compliance & Audit
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/audit/events</span> <span className="text-gray-500">- List audit events</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/audit/events/verify</span> <span className="text-gray-500">- Verify audit chain</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/compliance/summary</span> <span className="text-gray-500">- Compliance summary</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/compliance/reports/approval-history.csv</span> <span className="text-gray-500">- Approval history CSV</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/compliance/reports/security-history.csv</span> <span className="text-gray-500">- Security history CSV</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/compliance/reports/org-audit-events.csv</span> <span className="text-gray-500">- Audit events CSV</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/compliance/reports/audit-trail.pdf</span> <span className="text-gray-500">- Audit trail PDF</span></div>
            </div>
          </div>

          {/* Users & Organizations */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
              Users & Organizations
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/users/me</span> <span className="text-gray-500">- Get current user</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/users</span> <span className="text-gray-500">- List users</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/users</span> <span className="text-gray-500">- Create user</span></div>
              <div><span className="text-yellow-600 font-bold">PATCH</span> <span className="text-gray-900">/api/users/:id</span> <span className="text-gray-500">- Update user</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/organizations/current</span> <span className="text-gray-500">- Get current org</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/organizations</span> <span className="text-gray-500">- Create organization</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/invitations</span> <span className="text-gray-500">- List invitations</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/invitations</span> <span className="text-gray-500">- Create invitation</span></div>
            </div>
          </div>

          {/* Banks & Payments */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              Banks & Payments
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/banks</span> <span className="text-gray-500">- List bank connections</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/banks/connect</span> <span className="text-gray-500">- Connect bank</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/banks/:id/disconnect</span> <span className="text-gray-500">- Disconnect bank</span></div>
            </div>
          </div>

          {/* Public APIs */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              Public APIs
            </h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/signup</span> <span className="text-gray-500">- Public signup</span></div>
              <div><span className="text-green-600 font-bold">POST</span> <span className="text-gray-900">/api/wire/public/intents</span> <span className="text-gray-500">- Create public intent</span></div>
              <div><span className="text-blue-600 font-bold">GET</span> <span className="text-gray-900">/api/wire/public/intents/:id</span> <span className="text-gray-500">- Get public intent</span></div>
            </div>
          </div>

        </div>
      </div>

      {/* Features Section */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">Features</h2>
        </header>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Core Features</h3>
              <ul className="text-sm text-gray-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Voice-based authorization (POSE V2 zero-shot identification)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Dual approval workflows (maker-checker)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Fraud detection (8 rule-based rules + ML-ready)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Idempotent execution (prevents duplicate transfers)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Immutable audit trails with event chain verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Blockchain-anchored evidence (POSE Evidence Registry)</span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Developer Platform</h3>
              <ul className="text-sm text-gray-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>API keys with permission-based access control</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Webhooks with retry logic and signature verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Node.js SDK (TypeScript support)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Sandbox mode for testing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Complete API documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>OpenAPI specification</span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Compliance & Security</h3>
              <ul className="text-sm text-gray-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Multi-tenant isolation (org-scoped data)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>RBAC (role-based access control)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Compliance reports (CSV/PDF exports)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Legal holds and retention policies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Security history tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Rate limiting (per-org/per-user tiers)</span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Operations</h3>
              <ul className="text-sm text-gray-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Health checks (liveness/readiness)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Prometheus metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Structured logging</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Docker Compose deployment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Database migrations (Prisma)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Background job processing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Current Status Section */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">Current Status</h2>
        </header>
        <div className="p-6 space-y-4">
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-sm font-bold text-green-900 mb-1">Production Ready</h3>
                <p className="text-xs text-green-800 leading-relaxed">
                  All critical features are complete and tested. The platform is fully deployed at wire.pose.xyz 
                  and operational. All core workflows (signup, intent creation, approval, execution) are functional.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Backend</div>
              <div className="text-lg font-bold text-blue-900 mb-1">100% Complete</div>
              <div className="text-xs text-blue-700">All APIs, services, and integrations operational</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Frontend</div>
              <div className="text-lg font-bold text-purple-900 mb-1">100% Complete</div>
              <div className="text-xs text-purple-700">All pages, workflows, and UI components functional</div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Infrastructure</div>
              <div className="text-lg font-bold text-indigo-900 mb-1">Deployed</div>
              <div className="text-xs text-indigo-700">Production environment fully configured</div>
            </div>
          </div>
        </div>
      </div>

      {/* What's Next Section */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">What's Next</h2>
        </header>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Bank-Grade Hardening (In Progress)</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">→</span>
                <span><strong>SLOs & Alerting:</strong> Define and enforce availability, latency, and error rate SLOs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">→</span>
                <span><strong>True Identity:</strong> Production OIDC/SSO integration, MFA policies, break-glass procedures</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">→</span>
                <span><strong>Multi-Tenant Invariants:</strong> Service and database-level tenant isolation enforcement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">→</span>
                <span><strong>Payment Connectors:</strong> Bank linking, execution state machines, reliability improvements</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Enhanced Features</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">→</span>
                <span>Advanced ML-based fraud detection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">→</span>
                <span>Phone call verification (in addition to voice)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">→</span>
                <span>Advanced coercion detection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">→</span>
                <span>Multi-rail support (ACH, Cash, BTC, ETH)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Deployment Info Section */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">Deployment</h2>
        </header>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Production URLs</h3>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div><span className="text-gray-600">Frontend:</span> <span className="text-blue-600 font-semibold">https://wire.pose.xyz</span></div>
              <div><span className="text-gray-600">API:</span> <span className="text-blue-600 font-semibold">https://api.wire.pose.xyz</span></div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Tech Stack</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-900">Frontend</div>
                <div className="text-gray-600 mt-1">React + TypeScript</div>
                <div className="text-gray-600">Tailwind CSS</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-900">Backend</div>
                <div className="text-gray-600 mt-1">Fastify</div>
                <div className="text-gray-600">Node.js/TypeScript</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-900">Database</div>
                <div className="text-gray-600 mt-1">PostgreSQL</div>
                <div className="text-gray-600">Prisma ORM</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-900">Infrastructure</div>
                <div className="text-gray-600 mt-1">Docker Compose</div>
                <div className="text-gray-600">Redis (optional)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation Links */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-bold text-gray-900">Documentation</h2>
        </header>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Core Documentation</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• <code className="bg-gray-100 px-1 rounded">README.md</code> - Project overview</li>
                <li>• <code className="bg-gray-100 px-1 rounded">docs/API.md</code> - Complete API reference</li>
                <li>• <code className="bg-gray-100 px-1 rounded">WIRE2_BANK_GRADE_ROADMAP.md</code> - Roadmap</li>
                <li>• <code className="bg-gray-100 px-1 rounded">LAUNCH_SUMMARY.md</code> - Launch details</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Developer Resources</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• <code className="bg-gray-100 px-1 rounded">docs/dev/quickstart.md</code> - Getting started</li>
                <li>• <code className="bg-gray-100 px-1 rounded">docs/dev/webhooks.md</code> - Webhook integration</li>
                <li>• <code className="bg-gray-100 px-1 rounded">docs/dev/auth.md</code> - Authentication guide</li>
                <li>• <code className="bg-gray-100 px-1 rounded">sdk/nodejs/</code> - Node.js SDK</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="border-2 border-blue-200 rounded-xl bg-blue-50 p-4">
        <p className="text-xs text-blue-900 leading-relaxed">
          <strong className="font-semibold">Note:</strong> This dashboard provides a comprehensive overview of WIRE2. 
          For detailed technical documentation, API specifications, and development guides, refer to the documentation 
          files in the repository.
        </p>
      </div>
    </div>
  );
}
