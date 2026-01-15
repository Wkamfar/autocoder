import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { WireHelpLogContent } from "./help/WireHelpLogContent";

type HelpSection = 
  | "getting-started"
  | "accounts-org"
  | "teams-roles"
  | "no-code"
  | "domains-email"
  | "api-webhooks"
  | "log"
  | "overview"
  | "why-wire"
  | "intents"
  | "approvals"
  | "beneficiaries"
  | "requests"
  | "banks"
  | "ach-support"
  | "compliance"
  | "risk-management"
  | "security"
  | "policies"
  | "admin";

const HELP_SECTIONS: Array<{
  id: HelpSection;
  title: string;
  icon: React.ReactNode;
}> = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "accounts-org",
    title: "Accounts & Organization",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 12h18M3 17h18" />
      </svg>
    ),
  },
  {
    id: "teams-roles",
    title: "Teams & Roles",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "no-code",
    title: "Use WIRE without Code",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 9.243m-5.879 4.878L9.243 19m4.878-4.879L9.243 9.243M19 9.243L14.121 4.364M9.243 19L4.364 14.121M9.243 9.243L4.364 4.364" />
      </svg>
    ),
  },
  {
    id: "domains-email",
    title: "Domains & Email Domain",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21c4.418 0 8-4.03 8-9s-3.582-9-8-9-8 4.03-8 9 3.582 9 8 9zm0 0c2.21 0 4-4.03 4-9s-1.79-9-4-9-4 4.03-4 9 1.79 9 4 9zm-7-9h14" />
      </svg>
    ),
  },
  {
    id: "api-webhooks",
    title: "API & Webhooks",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 18l2-2-2-2M8 6L6 8l2 2m7-1a4 4 0 00-7 3v1a3 3 0 01-3 3m15-3a3 3 0 01-3 3v1a4 4 0 01-7 3" />
      </svg>
    ),
  },
  {
    id: "log",
    title: "Log",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5h6M9 9h6M9 13h6M9 17h6M5 5h.01M5 9h.01M5 13h.01M5 17h.01" />
      </svg>
    ),
  },
  {
    id: "overview",
    title: "Overview",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "why-wire",
    title: "Why WIRE?",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: "intents",
    title: "Transfer Intents",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    id: "approvals",
    title: "Approvals",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "beneficiaries",
    title: "Beneficiaries",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "requests",
    title: "Payment Requests",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "banks",
    title: "Multi-Bank Connectivity",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    id: "ach-support",
    title: "ACH Transfer Support",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "compliance",
    title: "Compliance & Reporting",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "risk-management",
    title: "Risk Management",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "security",
    title: "Security & Verification",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: "policies",
    title: "Policies & Rules",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "admin",
    title: "Admin & Management",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function WireSettingsHelpPage() {
  const [activeSection, setActiveSection] = useState<HelpSection>("getting-started");

  const renderContent = () => {
    switch (activeSection) {
      case "getting-started":
        return <GettingStartedContent />;
      case "accounts-org":
        return <AccountsOrgContent />;
      case "teams-roles":
        return <TeamsRolesContent />;
      case "no-code":
        return <NoCodeContent />;
      case "domains-email":
        return <DomainsEmailContent />;
      case "api-webhooks":
        return <ApiWebhooksContent />;
      case "log":
        return <WireHelpLogContent />;
      case "overview":
        return <OverviewContent />;
      case "why-wire":
        return <WhyWireContent />;
      case "intents":
        return <IntentsContent />;
      case "approvals":
        return <ApprovalsContent />;
      case "beneficiaries":
        return <BeneficiariesContent />;
      case "requests":
        return <RequestsContent />;
      case "banks":
        return <BanksContent />;
      case "ach-support":
        return <ACHSupportContent />;
      case "compliance":
        return <ComplianceContent />;
      case "risk-management":
        return <RiskManagementContent />;
      case "security":
        return <SecurityContent />;
      case "policies":
        return <PoliciesContent />;
      case "admin":
        return <AdminContent />;
      default:
        return <OverviewContent />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">WIRE Help Center</h2>
            <p className="text-sm text-gray-600">Complete guide to using WIRE for wire transfer management</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Table of Contents */}
        <div className="md:col-span-1">
          {/* Mobile: collapsible */}
          <div className="md:hidden border-2 border-black rounded-2xl bg-white p-4">
            <details>
              <summary className="cursor-pointer select-none flex items-center justify-between text-sm font-bold text-gray-900">
                <span>Table of Contents</span>
                <span className="text-xs text-gray-500">Tap to open</span>
              </summary>
              <nav className="mt-4 max-h-[60vh] overflow-auto space-y-1">
                {HELP_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeSection === section.id
                        ? "bg-black text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className={activeSection === section.id ? "text-white" : "text-gray-400"}>
                      {section.icon}
                    </span>
                    <span className="text-left">{section.title}</span>
                  </button>
                ))}
              </nav>
            </details>
          </div>

          {/* Desktop: sticky sidebar */}
          <div className="hidden md:block border-2 border-black rounded-2xl bg-white p-4 sticky top-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Table of Contents</h3>
            <nav className="space-y-1">
              {HELP_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className={activeSection === section.id ? "text-white" : "text-gray-400"}>
                    {section.icon}
                  </span>
                  <span>{section.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="border-2 border-black rounded-2xl bg-white p-4 sm:p-8"
          >
            {renderContent()}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function GettingStartedContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Getting Started</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE is a unified system for creating transfer intents, enforcing policy-driven controls, collecting
          voice-backed approvals, and generating tamper-proof evidence.
        </p>
      </div>

      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose how you want to start</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-2">1) Create an organization account</h3>
            <p className="text-sm text-gray-700 mb-3">
              Best for real teams. You’ll create an org, then add teammates and configure policy.
            </p>
            <ul className="text-sm text-gray-700 space-y-1 ml-4">
              <li className="list-disc">
                Go to <Link className="underline font-semibold" to="/signup">Sign up</Link>
              </li>
              <li className="list-disc">Create your organization and admin</li>
              <li className="list-disc">
                Then <Link className="underline font-semibold" to="/login">Sign in</Link>
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-2">2) Join an existing organization</h3>
            <p className="text-sm text-gray-700 mb-3">
              Ask an org admin to invite you, then accept the invitation and sign in.
            </p>
            <ul className="text-sm text-gray-700 space-y-1 ml-4">
              <li className="list-disc">Receive an invite link via email</li>
              <li className="list-disc">
                Accept the invite at <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">/invite/&lt;token&gt;</span>
              </li>
              <li className="list-disc">Complete voice enrollment</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">What’s available today</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="font-bold text-emerald-900 mb-2">Already in WIRE</h3>
            <ul className="text-sm text-emerald-800 space-y-1 ml-4">
              <li className="list-disc">Create an organization (public signup)</li>
              <li className="list-disc">Invite a team + assign roles</li>
              <li className="list-disc">Policy-driven approvals + step-up challenges</li>
              <li className="list-disc">Voice-based proof for approvals</li>
              <li className="list-disc">Evidence bundles + event-chain verification</li>
              <li className="list-disc">API keys + webhooks</li>
              <li className="list-disc">Idempotency for mutation endpoints</li>
              <li className="list-disc">Public/guest intent portal (no-login flow)</li>
              <li className="list-disc">Claim a public intent into an org later (upgrade path)</li>
              <li className="list-disc">Domains: custom domain + custom email domain (SPF/DKIM/DMARC) with DNS verification</li>
              <li className="list-disc">Security history UI (audit log viewer)</li>
              <li className="list-disc">Org groups / rollups</li>
              <li className="list-disc">SSO policy settings (OIDC enforcement)</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-bold text-amber-900 mb-2">What’s still evolving</h3>
            <ul className="text-sm text-amber-800 space-y-1 ml-4">
              <li className="list-disc">Production-grade hosted portal hardening (rate limits, abuse controls, analytics)</li>
              <li className="list-disc">Deeper domain automation (certificate issuance/renewal) and email deliverability tooling</li>
              <li className="list-disc">Full SSO login flow wiring (when running in OIDC mode)</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your first successful wire in WIRE</h2>
        <ol className="space-y-3 text-gray-700 ml-4 list-decimal">
          <li><strong>Create or verify a beneficiary</strong> (Beneficiaries)</li>
          <li><strong>Create a transfer intent</strong> (Intents)</li>
          <li><strong>Run voice challenge + submit proof</strong> (Approvals)</li>
          <li><strong>Approve / Deny / Step-up</strong> based on policy</li>
          <li><strong>Execute the intent</strong> when approvals are satisfied</li>
          <li><strong>Export evidence</strong> (audit bundle + event chain verification)</li>
        </ol>
      </div>

      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-amber-900 mb-2">Important: org + identity are first-class</h3>
        <p className="text-amber-800">
          Transfer intents are created inside an organization context. To create, approve, or execute an intent, you must
          be signed in and complete voice enrollment for your user. Public/guest flows (like receiving a link) are scoped
          to specific endpoints and do not grant org access.
        </p>
      </div>
    </div>
  );
}

function AccountsOrgContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Accounts & Organization</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          In WIRE, an <strong>Organization</strong> is the security and data boundary. Intents, beneficiaries,
          approvals, policies, API keys, and webhooks all belong to an org.
        </p>
      </div>

      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create an organization</h2>
        <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
          <li>Go to <Link className="underline font-semibold" to="/signup">/signup</Link></li>
          <li>Enter organization name, admin name, and admin email</li>
          <li>Submit to create the org and the first admin user</li>
          <li>Sign in at <Link className="underline font-semibold" to="/login">/login</Link></li>
        </ol>
      </div>

      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Where to manage org settings</h2>
        <ul className="space-y-2 text-gray-700 ml-4">
          <li className="list-disc">
            <strong>Profile</strong>: personal identity info for evidence trails (<Link className="underline font-semibold" to="/settings/profile">Settings → Profile</Link>)
          </li>
          <li className="list-disc">
            <strong>Accounts</strong>: org/account basics (<Link className="underline font-semibold" to="/settings/accounts">Settings → Accounts</Link>)
          </li>
          <li className="list-disc">
            <strong>Security</strong>: session and verification posture (<Link className="underline font-semibold" to="/settings/security">Settings → Security</Link>)
          </li>
          <li className="list-disc">
            <strong>Policies</strong>: approval + challenge thresholds (<Link className="underline font-semibold" to="/settings/policies">Settings → Policies</Link>)
          </li>
        </ul>
      </div>

      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Org rollups (multi-account)</h3>
        <p className="text-gray-700">
          WIRE supports <strong>Org groups</strong> for multi-org rollups and consolidated metrics. Use
          <Link className="underline font-semibold" to="/settings/org-groups"> Settings → Org groups</Link> to create groups
          and add member orgs.
        </p>
      </div>
    </div>
  );
}

function TeamsRolesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Teams & Roles</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE is designed for teams. Invite teammates, assign roles, and follow the principle of least privilege.
        </p>
      </div>

      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Invite a team member</h2>
        <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
          <li>Go to <Link className="underline font-semibold" to="/admin">Admin</Link></li>
          <li>Open <strong>User Management</strong></li>
          <li>Click <strong>Invite User</strong></li>
          <li>Enter their email and choose a role</li>
          <li>Send the invite link (or email it in production)</li>
        </ol>
        <p className="text-gray-700 mt-4">
          Invites have an expiration. The recipient accepts at <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">/invite/&lt;token&gt;</span>.
          If an invite is expired or revoked, create a new invite.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Core roles (recommended)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">ADMIN</h3>
            <p className="text-gray-700">Org management, user management, policies, and all intent actions.</p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">TREASURY_INITIATOR</h3>
            <p className="text-gray-700">Creates intents and sets up beneficiaries (no execution).</p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">APPROVER</h3>
            <p className="text-gray-700">Approves or denies intents and produces voice-backed proof.</p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">EXECUTOR / VIEWER</h3>
            <p className="text-gray-700">
              Executor can execute approved intents; Viewer is read-only for evidence and oversight.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-emerald-900 mb-2">Best practice: separate duties</h3>
        <ul className="space-y-2 text-emerald-800 ml-4">
          <li className="list-disc">Initiator ≠ Approver ≠ Executor for high-value wires</li>
          <li className="list-disc">Use dual approval for high risk thresholds</li>
          <li className="list-disc">Require voice challenges for approvals</li>
        </ul>
      </div>
    </div>
  );
}

function NoCodeContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Use WIRE without Code</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE is fully usable from the dashboard UI. You can create intents, run approvals, manage beneficiaries,
          configure policies, and export evidence without writing code.
        </p>
      </div>

      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">No-code workflow</h2>
        <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
          <li>Create a beneficiary (<a className="underline font-semibold" href="/beneficiaries">Beneficiaries</a>)</li>
          <li>Create a transfer intent (<a className="underline font-semibold" href="/intents">Intents</a>)</li>
          <li>Complete voice challenge(s) and approve (<a className="underline font-semibold" href="/approvals">Approvals</a>)</li>
          <li>Execute (if you have executor permission)</li>
          <li>Export evidence from the intent detail / evidence views</li>
        </ol>
      </div>

      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-amber-900 mb-2">Optional: public link flows</h3>
        <ul className="space-y-2 text-amber-800 ml-4">
          <li className="list-disc">
            <strong>Public intent portal</strong>: create a public intent without login at{" "}
            <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">/v2/public/intents/new</span>, then claim it into an org later.
          </li>
          <li className="list-disc">
            <strong>External request portal</strong>: share a link for vendors to submit payment requests (then approve/convert into a transfer intent).
          </li>
        </ul>
      </div>
    </div>
  );
}

function DomainsEmailContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Domains & Custom Email Domain</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          Configure domains for hosted flows and email deliverability. WIRE supports self-serve DNS verification for both
          a custom domain and an email domain (SPF/DKIM/DMARC).
        </p>
      </div>

      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Where to manage domains</h2>
        <ul className="space-y-2 text-gray-700 ml-4">
          <li className="list-disc">
            Go to <Link className="underline font-semibold" to="/settings/domains">Settings → Domains</Link>
          </li>
          <li className="list-disc"><strong>Custom domain</strong>: add + verify ownership via a TXT record</li>
          <li className="list-disc"><strong>Custom email domain</strong>: add SPF/DKIM/DMARC records, then verify</li>
        </ul>
      </div>

      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-amber-900 mb-2">Notes</h3>
        <ul className="space-y-2 text-amber-800 ml-4">
          <li className="list-disc">DNS verification status is shown per domain and can be re-checked anytime.</li>
          <li className="list-disc">Production-grade certificate automation depends on your deployment setup (e.g., Nginx/Certbot).</li>
        </ul>
      </div>
    </div>
  );
}

function ApiWebhooksContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">API & Webhooks</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          For developers, WIRE provides API keys, webhooks, and idempotent mutation endpoints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border-2 border-gray-200 rounded-xl p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-2">API Keys</h2>
          <p className="text-gray-700 mb-3">
            Create and manage keys in <Link className="underline font-semibold" to="/settings/api-keys">Settings → API Keys</Link>.
          </p>
          <ul className="space-y-2 text-gray-700 ml-4">
            <li className="list-disc">Use least privilege and rotate keys regularly</li>
            <li className="list-disc">Store keys in a secrets manager, not client code</li>
          </ul>
        </div>

        <div className="border-2 border-gray-200 rounded-xl p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Webhooks</h2>
          <p className="text-gray-700 mb-3">
            Configure endpoints in <Link className="underline font-semibold" to="/settings/webhooks">Settings → Webhooks</Link>.
          </p>
          <ul className="space-y-2 text-gray-700 ml-4">
            <li className="list-disc">Use a dedicated HTTPS endpoint</li>
            <li className="list-disc">Handle retries and verify payload integrity</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Idempotency</h3>
        <p className="text-gray-700">
          Mutating endpoints are idempotent. When integrating, always send a stable idempotency key for retries to avoid duplicate writes.
        </p>
      </div>
    </div>
  );
}

function OverviewContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">What is WIRE?</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE is a comprehensive wire transfer management platform designed for treasury operations. 
          It provides secure, auditable, and fraud-resistant wire transfer workflows with multi-factor 
          authentication, real-time risk assessment, and policy-based controls.
        </p>
      </div>

      <div className="border-l-4 border-black pl-6 py-2 bg-gray-50 rounded-r-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Key Features</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-black font-bold">•</span>
            <span><strong>Secure Transfer Intents:</strong> Create and manage outgoing wire transfers with real-time risk scoring</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-black font-bold">•</span>
            <span><strong>Multi-Factor Approval:</strong> Maker-checker workflows with voice verification</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-black font-bold">•</span>
            <span><strong>Beneficiary Management:</strong> Secure storage and verification of bank account details</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-black font-bold">•</span>
            <span><strong>Payment Requests:</strong> Receive and approve incoming payment requests from vendors</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-black font-bold">•</span>
            <span><strong>Fraud Prevention:</strong> Real-time voice verification, spoof detection, and coercion detection</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-black font-bold">•</span>
            <span><strong>Policy Engine:</strong> Configurable rules and thresholds for automated risk management</span>
          </li>
        </ul>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">How WIRE Works</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Create Transfer Intent</h3>
                <p className="text-gray-700">
                  Initiate a wire transfer by creating an intent. Select a beneficiary, enter the amount, 
                  and provide a purpose. WIRE automatically calculates risk scores based on amount, beneficiary 
                  history, and transfer type.
                </p>
              </div>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Risk Assessment</h3>
                <p className="text-gray-700">
                  WIRE evaluates the transfer against configured policies. Factors include transfer amount, 
                  beneficiary age, international transfers, and rail type (ACH vs WIRE). The system determines 
                  required approval levels and challenge requirements.
                </p>
              </div>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Approval Workflow</h3>
                <p className="text-gray-700">
                  Based on risk score, the transfer requires one or more approvers. Approvers receive notifications 
                  and must verify their identity using voice verification before approving. All approvals are 
                  cryptographically signed and logged.
                </p>
              </div>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Execution</h3>
                <p className="text-gray-700">
                  Once all required approvals are obtained, the transfer can be executed. WIRE generates a 
                  complete evidence bundle including all approvals, risk assessments, and verification records. 
                  The transfer is executed through your connected banking partner.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Security First</h3>
        <p className="text-blue-800">
          Every action in WIRE is cryptographically signed and logged. Voice verification prevents spoofing 
          and coercion attacks. All transfers are tamper-proof with complete audit trails. Your treasury 
          operations are protected by enterprise-grade security.
        </p>
      </div>
    </div>
  );
}

function WhyWireContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Why WIRE is Different</h1>
        <p className="text-lg text-gray-700 leading-relaxed mb-6">
          WIRE is fundamentally different from existing solutions because it <strong>prevents wire fraud at the source</strong> 
          using real-time voice verification that cannot be spoofed, rather than detecting fraud after it happens.
        </p>
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-red-900 mb-4">The Problem: Wire Fraud is Growing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <p className="text-xs uppercase tracking-wide text-red-600 mb-1">Average Loss</p>
            <p className="text-2xl font-bold font-mono text-red-600">$2.3M</p>
            <p className="text-xs text-red-500 mt-1">per year per company</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <p className="text-xs uppercase tracking-wide text-red-600 mb-1">PDF Spoofing</p>
            <p className="text-2xl font-bold font-mono text-red-600">78%</p>
            <p className="text-xs text-red-500 mt-1">of wire fraud cases</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <p className="text-xs uppercase tracking-wide text-red-600 mb-1">Still Vulnerable</p>
            <p className="text-2xl font-bold font-mono text-red-600">100%</p>
            <p className="text-xs text-red-500 mt-1">handwritten forms</p>
          </div>
        </div>
        <p className="text-red-800">
          Traditional methods rely on PDFs, emails, or handwritten forms that can be intercepted, modified, or forged. 
          Once money is sent via wire transfer, it's often impossible to recover.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">What Makes WIRE Unique</h2>
        <p className="text-gray-700 mb-6">
          WIRE is the <strong>only solution</strong> that combines all of these capabilities:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-emerald-200 rounded-xl p-5 bg-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-900">Real-Time Voice Biometrics</h3>
            </div>
            <p className="text-emerald-800">
              Every approval requires real-time voice verification. Not just 2FA codes that can be intercepted—actual 
              biometric voiceprint matching that cannot be stolen or replicated.
            </p>
          </div>

          <div className="border-2 border-emerald-200 rounded-xl p-5 bg-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-900">AI Clone Detection</h3>
            </div>
            <p className="text-emerald-800">
              Advanced ML models detect and block AI-generated voice clones (deepfakes). Even sophisticated 
              AI voice synthesis cannot bypass WIRE's detection.
            </p>
          </div>

          <div className="border-2 border-emerald-200 rounded-xl p-5 bg-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-900">Coercion Detection</h3>
            </div>
            <p className="text-emerald-800">
              Analyzes voice patterns for stress indicators that suggest physical coercion. If someone is forced 
              to approve a transfer, WIRE can detect it.
            </p>
          </div>

          <div className="border-2 border-emerald-200 rounded-xl p-5 bg-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-900">Cryptographic Signing</h3>
            </div>
            <p className="text-emerald-800">
              Every action is cryptographically signed, creating an immutable audit trail. Provides legal proof 
              for compliance and fraud investigations.
            </p>
          </div>

          <div className="border-2 border-emerald-200 rounded-xl p-5 bg-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-900">Policy-Based Risk Engine</h3>
            </div>
            <p className="text-emerald-800">
              Automatically calculates risk scores and determines approval requirements. Low-risk transfers need 
              fewer approvals; high-risk transfers get extra scrutiny.
            </p>
          </div>

          <div className="border-2 border-emerald-200 rounded-xl p-5 bg-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-900">Phone Call Support</h3>
            </div>
            <p className="text-emerald-800">
              Works via phone call, not just web interface. Approve transfers from anywhere using your phone. 
              Same biometric verification via phone.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">WIRE vs. Other Solutions</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Traditional Banks</h3>
            <p className="text-gray-700 mb-3">
              Banks use email/SMS for approvals, which can be intercepted or spoofed. WIRE uses biometric voice 
              that cannot be replicated.
            </p>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium">Banks: Email/SMS</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">WIRE: Voice Biometrics</span>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Treasury Management Systems</h3>
            <p className="text-gray-700 mb-3">
              TMS systems detect fraud after it happens. WIRE prevents it before execution with biometric verification.
            </p>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium">TMS: Fraud Detection</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">WIRE: Fraud Prevention</span>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Payment Platforms</h3>
            <p className="text-gray-700 mb-3">
              Payment platforms focus on processing. WIRE focuses on preventing fraud through biometric verification 
              before execution.
            </p>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium">Platforms: Processing</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">WIRE: Prevention</span>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Fraud Detection Systems</h3>
            <p className="text-gray-700 mb-3">
              Fraud detection identifies suspicious activity. WIRE prevents unauthorized activity by verifying identity 
              with voice biometrics.
            </p>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium">Detection: Identify Suspicious</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">WIRE: Verify Identity</span>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">MFA Platforms</h3>
            <p className="text-gray-700 mb-3">
              MFA platforms verify login. WIRE verifies each critical action (transfer approval) with voice biometrics 
              that cannot be spoofed.
            </p>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium">MFA: Login Security</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">WIRE: Transaction Security</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <h3 className="text-xl font-bold text-blue-900 mb-3">The Bottom Line</h3>
        <p className="text-blue-800 text-lg leading-relaxed">
          WIRE doesn't compete with existing solutions—it solves a problem they don't address: 
          <strong> preventing wire fraud through real-time voice verification that cannot be bypassed, spoofed, or coerced.</strong>
        </p>
        <p className="text-blue-800 mt-4">
          No existing solution combines voice biometrics, AI clone detection, coercion detection, cryptographic signing, 
          and phone call support. That's WIRE's unique position in the market.
        </p>
      </div>
    </div>
  );
}

function IntentsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Transfer Intents</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          Transfer Intents are outgoing wire transfers that you initiate. They represent your intention to 
          send money to a beneficiary and go through a complete approval workflow before execution.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Creating an Intent</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Step 1: Select Rail Type</h3>
            <p className="text-gray-700 mb-3">
              Choose between <strong>ACH</strong> (Automated Clearing House) or <strong>WIRE</strong> transfers:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>ACH:</strong> Lower cost, typically 1-3 business days, reversible</li>
              <li className="list-disc"><strong>WIRE:</strong> Higher cost, same-day settlement, irreversible</li>
            </ul>
            <p className="text-gray-700 mt-3 text-sm">
              <strong>Tip:</strong> Use the rail type filter buttons ("All Rails", "ACH", "WIRE") on the Intents page to view transfers by type.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Step 2: Enter Amount</h3>
            <p className="text-gray-700 mb-3">
              Enter the transfer amount with currency selection. The amount is automatically formatted with 
              commas for readability and displayed in words for verification.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Example:</p>
              <p className="font-mono text-lg">$100,000.00</p>
              <p className="text-sm text-gray-600 mt-2">Amount in words: one hundred thousand dollars</p>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Step 3: Select Beneficiary</h3>
            <p className="text-gray-700 mb-3">
              Choose from your saved beneficiaries. WIRE shows verification status and risk indicators for 
              each beneficiary to help you make informed decisions.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Step 4: Add Purpose</h3>
            <p className="text-gray-700">
              Provide a clear purpose for the transfer. This is required for compliance and audit purposes.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Risk Assessment</h2>
        <p className="text-gray-700 mb-4">
          WIRE automatically calculates a risk score for each intent based on multiple factors:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">Amount Thresholds</h4>
            <p className="text-sm text-gray-700">
              Transfers exceeding $5k or $10k thresholds increase risk scores
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">Beneficiary Age</h4>
            <p className="text-sm text-gray-700">
              New beneficiaries (less than 7 days old) carry higher risk
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">Rail Type</h4>
            <p className="text-sm text-gray-700">
              WIRE transfers are irreversible, increasing risk score
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">International</h4>
            <p className="text-sm text-gray-700">
              Transfers to non-US beneficiaries add risk
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Intent Status</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">PENDING_APPROVAL</span>
            <span className="text-gray-700">Waiting for required approvals</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium">APPROVED</span>
            <span className="text-gray-700">All approvals received, ready for execution</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium">DENIED</span>
            <span className="text-gray-700">Transfer was denied by an approver</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">EXECUTED</span>
            <span className="text-gray-700">Transfer has been executed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Approval Workflow</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE uses a maker-checker approval system with multi-factor authentication to ensure secure 
          and auditable wire transfers.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">How Approvals Work</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Required Approvals</h3>
            <p className="text-gray-700 mb-3">
              The number of required approvals depends on the risk score:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Low Risk (&lt;60):</strong> Requires 1 approver</li>
              <li className="list-disc"><strong>High Risk (≥60):</strong> Requires 2 approvers (dual approval)</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Maker-Checker Separation</h3>
            <p className="text-gray-700">
              You cannot approve your own intents. This separation ensures that no single person can 
              both create and approve a transfer, providing an essential security control.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Voice Verification</h3>
            <p className="text-gray-700 mb-3">
              Before approving, approvers must complete a voice verification challenge. This prevents:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Spoofing:</strong> AI voice clones are detected and blocked</li>
              <li className="list-disc"><strong>Coercion:</strong> Stress patterns in voice indicate coercion attempts</li>
              <li className="list-disc"><strong>Account Takeover:</strong> Only the enrolled voice can approve</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Approval Process</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Receive Notification</h3>
              <p className="text-gray-700">
                When an intent requires your approval, you'll receive a notification. Navigate to the 
                Approvals page to see pending transfers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Review Intent Details</h3>
              <p className="text-gray-700">
                Click on the intent to view complete details including amount, beneficiary, risk assessment, 
                and purpose. Review all information carefully before approving.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Complete Voice Challenge</h3>
              <p className="text-gray-700">
                Click "Approve" to start the voice verification challenge. You'll be prompted to speak 
                a randomly generated phrase. The system verifies your voiceprint matches your enrolled voice.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
              4
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Approve or Deny</h3>
              <p className="text-gray-700">
                After successful voice verification, confirm your approval. If something seems wrong, 
                you can deny the transfer with a reason. All decisions are logged and cannot be reversed.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-yellow-900 mb-2">Important Notes</h3>
        <ul className="space-y-2 text-yellow-800">
          <li className="list-disc">Approvals are cryptographically signed and tamper-proof</li>
          <li className="list-disc">All approval actions are logged in the event timeline</li>
          <li className="list-disc">You can view the approval history for any intent</li>
          <li className="list-disc">Denied transfers cannot be re-approved without creating a new intent</li>
        </ul>
      </div>
    </div>
  );
}

function BeneficiariesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Beneficiary Management & Intelligence</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          Beneficiaries are bank accounts that you can send money to. WIRE provides deep intelligence and 
          analytics on each vendor/beneficiary, going beyond basic management to deliver actionable insights 
          that help you understand relationships, predict behavior, and manage risk.
        </p>
      </div>

      {/* Deep Intelligence Section */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h2 className="text-2xl font-bold">Deep Vendor Intelligence System</h2>
        </div>
        <p className="text-gray-300 mb-6">
          Click any beneficiary in the table to access comprehensive intelligence reports. WIRE's intelligence 
          system provides insights that exceed enterprise-grade analytics platforms, with real-time pattern 
          detection, predictive analytics, and complete audit trails.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <h3 className="font-bold mb-2">9 Intelligence Tabs</h3>
            <p className="text-sm text-gray-300">
              Overview, Ledger, Intelligence, Risk Analysis, Patterns, Admin Controls, Documents, Compliance, and Audit Trail
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <h3 className="font-bold mb-2">AI-Powered Analytics</h3>
            <p className="text-sm text-gray-300">
              Predictive transfer forecasting, behavioral pattern detection, anomaly identification, and risk trend analysis
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Adding a Beneficiary</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Method 1: Manual Entry</h3>
            <p className="text-gray-700 mb-3">
              Enter beneficiary details manually including:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc">Account holder name</li>
              <li className="list-disc">Bank name and routing number</li>
              <li className="list-disc">Account number (last 4 digits shown)</li>
              <li className="list-disc">Account type (checking/savings)</li>
              <li className="list-disc">Allowed rail types (ACH, WIRE, or both)</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Method 2: Bank Connection</h3>
            <p className="text-gray-700">
              Connect your bank account using Plaid or similar service to automatically verify account 
              details and reduce manual entry errors.
            </p>
          </div>
        </div>
      </div>

      {/* Deep Intelligence Features */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Deep Intelligence Features</h2>
        <div className="space-y-4">
          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Overview Tab</h3>
            <p className="text-gray-700 mb-3">
              Get a comprehensive view of your relationship with each vendor:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Key Metrics:</strong> Total volume, trust score, on-time payment rate, current risk score</li>
              <li className="list-disc"><strong>Relationship Summary:</strong> Duration, average transfer amounts, transfer frequency, communication score</li>
              <li className="list-disc"><strong>AI-Powered Insights:</strong> Pattern detection, risk assessment, predictive analysis, relationship health</li>
              <li className="list-disc"><strong>Quick Notes:</strong> Recent admin notes and important information</li>
            </ul>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Ledger Tab</h3>
            <p className="text-gray-700 mb-3">
              Complete transaction history for the vendor:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Full Transaction List:</strong> Every transfer with date, amount, rail type, status, and risk score</li>
              <li className="list-disc"><strong>Chronological View:</strong> Sorted by date, newest first</li>
              <li className="list-disc"><strong>Detailed Information:</strong> Created by, approval status, execution status</li>
              <li className="list-disc"><strong>Click to View:</strong> Click any transaction to see full details</li>
            </ul>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Intelligence Tab</h3>
            <p className="text-gray-700 mb-3">
              Advanced analytics and predictions:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Predictive Analytics:</strong> Next transfer prediction with date, amount, and confidence level</li>
              <li className="list-disc"><strong>Volume Forecast:</strong> 3-month volume projection with confidence intervals</li>
              <li className="list-disc"><strong>Risk Forecast:</strong> Predicted risk trends over time</li>
              <li className="list-disc"><strong>Communication History:</strong> Complete log of emails, phone calls, meetings, and document exchanges</li>
            </ul>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Risk Analysis Tab</h3>
            <p className="text-gray-700 mb-3">
              Comprehensive risk assessment and monitoring:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Risk Score Trend:</strong> 7-month risk score visualization showing trends</li>
              <li className="list-disc"><strong>Active Risk Factors:</strong> Detailed breakdown of risk factors with severity levels (low, medium, high, critical)</li>
              <li className="list-disc"><strong>Anomaly Detection:</strong> AI-detected unusual patterns, transfer times, or behaviors</li>
              <li className="list-disc"><strong>Risk Factor Details:</strong> Description, last detection date, and resolution status</li>
            </ul>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Patterns Tab</h3>
            <p className="text-gray-700 mb-3">
              Behavioral pattern analysis:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Transfer Patterns:</strong> Preferred transfer days and times</li>
              <li className="list-disc"><strong>Seasonal Patterns:</strong> Monthly volume trends and seasonal variations</li>
              <li className="list-disc"><strong>Amount Distribution:</strong> Visual breakdown of transfer amounts by ranges</li>
              <li className="list-disc"><strong>Approval Patterns:</strong> Average approval time, approval rate, and denial reasons</li>
            </ul>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Admin Controls Tab (Admin Only)</h3>
            <p className="text-gray-700 mb-3">
              Advanced controls for managing vendor relationships:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Caps & Limits:</strong> Set daily, monthly, per-transfer, and annual limits (all modifications saved)</li>
              <li className="list-disc"><strong>Restrictions:</strong> Custom rules like &quot;Requires dual approval for transfers &gt; $500k&quot;</li>
              <li className="list-disc"><strong>Tags:</strong> Categorize vendors (e.g., "Primary Vendor", "Q1 Operations", "Trusted Partner")</li>
              <li className="list-disc"><strong>Admin Notes:</strong> Add notes with author tracking and timestamps (all edits saved)</li>
              <li className="list-disc"><strong>Flags:</strong> Mark vendors with special flags for attention</li>
              <li className="list-disc"><strong>Complete Audit Trail:</strong> Every admin action is logged with cryptographic proof</li>
            </ul>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-900">
                <strong>Important:</strong> All admin modifications are cryptographically signed and saved in the audit trail. 
                Even edits to notes are tracked with modification timestamps. This ensures complete accountability and compliance.
              </p>
            </div>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Documents Tab</h3>
            <p className="text-gray-700 mb-3">
              Centralized document repository:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Document Storage:</strong> Contracts, tax forms, certifications, and other vendor documents</li>
              <li className="list-disc"><strong>Metadata Tracking:</strong> Document type, size, uploader, and upload date</li>
              <li className="list-disc"><strong>Download Access:</strong> Secure download of all stored documents</li>
              <li className="list-disc"><strong>Admin Upload:</strong> Admins can upload new documents</li>
            </ul>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Compliance Tab</h3>
            <p className="text-gray-700 mb-3">
              Regulatory and compliance tracking:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>KYC Status:</strong> Know Your Customer verification status and expiry dates</li>
              <li className="list-disc"><strong>Sanctions Checks:</strong> Real-time sanctions screening status and last check date</li>
              <li className="list-disc"><strong>Regulatory Flags:</strong> Any regulatory warnings or flags</li>
              <li className="list-disc"><strong>Certifications:</strong> Industry certifications (ISO, SOC, etc.) with expiry tracking</li>
            </ul>
          </div>

          <div className="border-2 border-black rounded-xl p-5 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Audit Trail Tab</h3>
            <p className="text-gray-700 mb-3">
              Complete, cryptographically signed audit log:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>All Actions Logged:</strong> Every action, modification, and change is recorded</li>
              <li className="list-disc"><strong>Actor Tracking:</strong> Who performed each action</li>
              <li className="list-disc"><strong>Timestamp Precision:</strong> Exact time of each action</li>
              <li className="list-disc"><strong>Detailed Information:</strong> Full JSON details of what changed</li>
              <li className="list-disc"><strong>Security Metadata:</strong> IP address and user agent for each action</li>
              <li className="list-disc"><strong>Cryptographic Proof:</strong> All entries are cryptographically signed and tamper-proof</li>
            </ul>
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm text-emerald-900">
                <strong>Complete Accountability:</strong> The audit trail includes admin modifications to caps, notes, tags, 
                and restrictions. Every change is tracked, signed, and cannot be altered. This provides legal-grade 
                evidence for compliance and investigations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accessing Intelligence */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Accessing Vendor Intelligence</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">From Beneficiaries Page</h3>
            <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
              <li>Navigate to the Beneficiaries page</li>
              <li>Click on any beneficiary row in the table</li>
              <li>The intelligence dashboard opens with the Overview tab</li>
              <li>Use the tabs to navigate between different intelligence sections</li>
            </ol>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Quick Access</h3>
            <p className="text-gray-700 mb-3">
              You can also click the "Intelligence →" button in the Actions column for direct access to 
              the intelligence dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Accessing Intelligence */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Accessing Vendor Intelligence</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">From Beneficiaries Page</h3>
            <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
              <li>Navigate to the Beneficiaries page</li>
              <li>Click on any beneficiary row in the table</li>
              <li>The intelligence dashboard opens with the Overview tab</li>
              <li>Use the tabs to navigate between different intelligence sections</li>
            </ol>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Quick Access</h3>
            <p className="text-gray-700 mb-3">
              You can also click the "Intelligence →" button in the Actions column for direct access to 
              the intelligence dashboard.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Verification Status</h2>
        <p className="text-gray-700 mb-4">
          WIRE tracks verification status for each beneficiary:
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium">Email Verified</span>
            <span className="text-gray-700">Beneficiary email has been verified</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium">Voice Verified</span>
            <span className="text-gray-700">Beneficiary has completed voice enrollment</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium">Domain Verified</span>
            <span className="text-gray-700">Beneficiary domain has been verified</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Locking Beneficiaries</h2>
        <p className="text-gray-700 mb-4">
          You can lock beneficiaries to prevent new transfers. This is useful when:
        </p>
        <ul className="space-y-2 text-gray-700 ml-4">
          <li className="list-disc">A beneficiary account is compromised</li>
          <li className="list-disc">You need to temporarily stop payments</li>
          <li className="list-disc">Account details need verification</li>
        </ul>
        <p className="text-gray-700 mt-4">
          Locked beneficiaries cannot be used in new transfer intents until unlocked. Locking actions are 
          logged in the intelligence dashboard's Audit Trail tab.
        </p>
      </div>

      {/* Key Intelligence Capabilities */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Why WIRE's Intelligence System is Unique</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <h3 className="font-bold text-gray-900 mb-2">Complete Auditability</h3>
            <p className="text-sm text-gray-700">
              Every admin action—including edits to notes, changes to caps, and modifications to restrictions—is 
              cryptographically signed and saved. Even modifications to modifications are tracked.
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <h3 className="font-bold text-gray-900 mb-2">Predictive Intelligence</h3>
            <p className="text-sm text-gray-700">
              AI-powered predictions for next transfers, volume forecasting, and risk trends help you plan ahead 
              and identify potential issues before they occur.
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <h3 className="font-bold text-gray-900 mb-2">Pattern Detection</h3>
            <p className="text-sm text-gray-700">
              Advanced pattern recognition identifies preferred transfer days, times, seasonal variations, and 
              amount distributions to understand vendor behavior.
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <h3 className="font-bold text-gray-900 mb-2">Anomaly Detection</h3>
            <p className="text-sm text-gray-700">
              Real-time anomaly detection identifies unusual transfer times, amounts, or behaviors that may indicate 
              fraud or account compromise.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Security Best Practices</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="list-disc">Always verify beneficiary details before first use</li>
          <li className="list-disc">Use bank connection when possible for automatic verification</li>
          <li className="list-disc">Review beneficiary list regularly for unauthorized accounts</li>
          <li className="list-disc">Lock beneficiaries immediately if suspicious activity is detected</li>
          <li className="list-disc">Use intelligence dashboard to monitor vendor relationships and detect anomalies</li>
          <li className="list-disc">Set appropriate caps and restrictions based on vendor trust scores and risk levels</li>
          <li className="list-disc">Review audit trail regularly to ensure all actions are authorized</li>
        </ul>
      </div>
    </div>
  );
}

function RequestsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Requests</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          Payment Requests are incoming requests for payment from vendors, suppliers, or other parties. 
          They allow external parties to request money from your organization securely.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">How Payment Requests Work</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">1. Request Submission</h3>
            <p className="text-gray-700">
              External parties submit payment requests through WIRE's secure portal. They provide 
              amount, invoice number, due date, purpose, and supporting documents.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">2. Multi-Factor Verification</h3>
            <p className="text-gray-700 mb-3">
              Each request must be verified through multiple factors:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Email Verification:</strong> Requestor's email is verified</li>
              <li className="list-disc"><strong>Voice Verification:</strong> Requestor completes voice challenge</li>
              <li className="list-disc"><strong>Domain Verification:</strong> Requestor's domain is verified</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">3. Tamper-Proof Hash</h3>
            <p className="text-gray-700">
              Each request is cryptographically signed with a unique hash. Any modification to the 
              request invalidates the hash, making tampering immediately detectable.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">4. Review and Approval</h3>
            <p className="text-gray-700">
              You review the request, verify all information, and approve or deny it. Approved requests 
              can be converted directly into transfer intents.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Request Status</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">PENDING_APPROVAL</span>
            <span className="text-gray-700">Waiting for your review and approval</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium">APPROVED</span>
            <span className="text-gray-700">Request approved, ready to create transfer intent</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium">DENIED</span>
            <span className="text-gray-700">Request was denied</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Creating a Transfer from Request</h2>
        <p className="text-gray-700 mb-4">
          Once a payment request is approved, you can create a transfer intent directly from it:
        </p>
        <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
          <li>Open the approved payment request</li>
          <li>Click "Create Transfer Intent"</li>
          <li>Review pre-filled information (amount, purpose, etc.)</li>
          <li>Select or add beneficiary</li>
          <li>Submit the intent</li>
        </ol>
      </div>
    </div>
  );
}

function SecurityContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Security & Verification</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE uses multiple layers of security to protect your wire transfers from fraud, spoofing, 
          and unauthorized access.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Voice Verification</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">How It Works</h3>
            <p className="text-gray-700 mb-3">
              Voice verification uses biometric voiceprint technology to verify identity:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc">Each user enrolls their voiceprint during onboarding</li>
              <li className="list-disc">Voiceprints are stored securely and cannot be reverse-engineered</li>
              <li className="list-disc">Before critical actions, users complete a voice challenge</li>
              <li className="list-disc">The system matches the voice to the enrolled voiceprint</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Fraud Prevention</h3>
            <p className="text-gray-700 mb-3">
              Voice verification prevents several attack vectors:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2">Spoof Detection</h4>
                <p className="text-sm text-red-800">
                  AI voice clones and deepfakes are detected and blocked using advanced algorithms
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2">Coercion Detection</h4>
                <p className="text-sm text-red-800">
                  Stress patterns and unusual speech patterns indicate coercion attempts
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2">Account Takeover</h4>
                <p className="text-sm text-red-800">
                  Even with stolen credentials, attackers cannot complete voice verification
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2">Replay Attacks</h4>
                <p className="text-sm text-red-800">
                  Each challenge uses unique phrases, preventing replay of recorded audio
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Cryptographic Signing</h2>
        <p className="text-gray-700 mb-4">
          Every action in WIRE is cryptographically signed:
        </p>
        <ul className="space-y-2 text-gray-700 ml-4">
          <li className="list-disc"><strong>Transfer Intents:</strong> Signed by creator with timestamp</li>
          <li className="list-disc"><strong>Approvals:</strong> Signed by approver with voice verification proof</li>
          <li className="list-disc"><strong>Payment Requests:</strong> Signed by requestor with verification status</li>
          <li className="list-disc"><strong>Evidence Bundles:</strong> Complete cryptographic proof of all actions</li>
        </ul>
        <p className="text-gray-700 mt-4">
          All signatures are tamper-proof. Any modification invalidates the signature, making fraud 
          immediately detectable.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Audit Trail</h2>
        <p className="text-gray-700 mb-4">
          WIRE maintains a complete audit trail for every transfer:
        </p>
        <div className="border-2 border-gray-200 rounded-xl p-5">
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-black font-bold">•</span>
              <span>Who created the intent and when</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold">•</span>
              <span>All approval actions with timestamps</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold">•</span>
              <span>Voice verification records</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold">•</span>
              <span>Risk assessment calculations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold">•</span>
              <span>Execution records</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold">•</span>
              <span>Complete evidence bundle</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-emerald-900 mb-2">Security Best Practices</h3>
        <ul className="space-y-2 text-emerald-800">
          <li className="list-disc">Always complete voice enrollment during onboarding</li>
          <li className="list-disc">Never share your credentials or voice verification access</li>
          <li className="list-disc">Review all transfer details carefully before approval</li>
          <li className="list-disc">Report suspicious activity immediately</li>
          <li className="list-disc">Regularly review audit logs for unauthorized activity</li>
        </ul>
      </div>
    </div>
  );
}

function PoliciesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Policies & Rules</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE's policy engine allows you to configure rules and thresholds that automatically determine 
          risk levels, approval requirements, and challenge levels for transfers.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">How Policies Work</h2>
        <p className="text-gray-700 mb-4">
          When a transfer intent is created, WIRE evaluates it against configured policies:
        </p>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Risk Scoring</h3>
            <p className="text-gray-700">
              Policies define how risk scores are calculated based on transfer characteristics. Each 
              factor (amount, beneficiary age, rail type, etc.) contributes to the total risk score.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Approval Requirements</h3>
            <p className="text-gray-700 mb-3">
              Based on risk score, policies determine:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc">Number of required approvers (1 or 2)</li>
              <li className="list-disc">Required challenge level (L1, L2, or L3)</li>
              <li className="list-disc">Additional verification requirements</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Thresholds</h3>
            <p className="text-gray-700">
              Policies define amount thresholds that trigger different risk levels. For example, 
              transfers over $5k might require dual approval, while transfers over $10k require 
              the highest challenge level.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Policy Configuration</h2>
        <p className="text-gray-700 mb-4">
          Policies are configured by administrators and can include:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">Amount Thresholds</h4>
            <p className="text-sm text-gray-700">
              Define dollar amounts that trigger different risk levels
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">Beneficiary Rules</h4>
            <p className="text-sm text-gray-700">
              Rules based on beneficiary age, verification status, country
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">Rail Type Rules</h4>
            <p className="text-sm text-gray-700">
              Different rules for ACH vs WIRE transfers
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h4 className="font-bold text-gray-900 mb-2">Time-Based Rules</h4>
            <p className="text-sm text-gray-700">
              Rules based on time of day, day of week, holidays
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Policy Simulator</h2>
        <p className="text-gray-700 mb-4">
          Use the Policy Simulator to test how different transfer scenarios would be evaluated:
        </p>
        <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
          <li>Navigate to the Policies page</li>
          <li>Enter transfer details (amount, beneficiary, rail type)</li>
          <li>View calculated risk score</li>
          <li>See required approvals and challenge levels</li>
          <li>Test different scenarios to understand policy behavior</li>
        </ol>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Policy Versioning</h3>
        <p className="text-blue-800">
          All policy changes are versioned and logged. You can view policy history and see when 
          changes were made. This ensures complete auditability of policy configurations.
        </p>
      </div>
    </div>
  );
}

function BanksContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Multi-Bank Connectivity</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE works across multiple banks, allowing you to manage transfers from different financial institutions 
          through a single, unified interface. This is critical for scale and flexibility.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Connecting Banks</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Step 1: Navigate to Banks Page</h3>
            <p className="text-gray-700 mb-3">
              Click the "Banks" tab in the main navigation to view all connected banks.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Step 2: Connect a Bank</h3>
            <p className="text-gray-700 mb-3">
              Click "+ Connect Bank" and select your bank from the list. WIRE uses secure services like Plaid 
              to connect—your credentials are never stored.
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc">Select your bank from popular options</li>
              <li className="list-disc">Authenticate securely through your bank</li>
              <li className="list-disc">Grant WIRE read-only access to account information</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Step 3: Verify Connection</h3>
            <p className="text-gray-700">
              Once connected, you'll see account counts, balances, and last sync time. You can sync manually 
              or set up automatic syncing.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Benefits of Multi-Bank Connectivity</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-2">Works Across Banks</h3>
            <p className="text-sm text-gray-700">
              Not tied to a single institution. Connect Chase, Bank of America, Wells Fargo, and more—all from one interface.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-2">Unified Security</h3>
            <p className="text-sm text-gray-700">
              Same voice verification and fraud prevention across all banks. Consistent security model regardless of institution.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-2">Centralized Management</h3>
            <p className="text-sm text-gray-700">
              View all accounts, balances, and transfer activity in one place. Simplified operations and reporting.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Primary vs Secondary Banks</h3>
        <p className="text-blue-800">
          You can designate one bank as "Primary" for default operations, while maintaining multiple secondary 
          banks for different purposes or departments.
        </p>
      </div>
    </div>
  );
}

function ACHSupportContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">ACH Transfer Support</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE supports both ACH (Automated Clearing House) and WIRE transfers. ACH transfers are a natural 
          extension of wire transfers with the same fraud prevention needs, expanding your market without diluting focus.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">ACH vs WIRE: Key Differences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="border-2 border-blue-200 rounded-xl p-5 bg-blue-50">
            <h3 className="text-lg font-bold text-blue-900 mb-3">ACH Transfers</h3>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-start gap-2">
                <span className="font-bold">Cost:</span>
                <span>Lower cost per transaction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">Speed:</span>
                <span>1-3 business days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">Reversibility:</span>
                <span>Can be reversed (ACH returns)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">Use Cases:</span>
                <span>Payroll, vendor payments, recurring transfers</span>
              </li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900 mb-3">WIRE Transfers</h3>
            <ul className="space-y-2 text-gray-800">
              <li className="flex items-start gap-2">
                <span className="font-bold">Cost:</span>
                <span>Higher cost per transaction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">Speed:</span>
                <span>Same-day settlement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">Reversibility:</span>
                <span>Irreversible once executed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">Use Cases:</span>
                <span>High-value, time-sensitive transfers</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Using ACH in WIRE</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Creating ACH Transfers</h3>
            <p className="text-gray-700 mb-3">
              When creating a transfer intent, select "ACH" as the rail type. The same voice verification and 
              approval workflow applies—WIRE's fraud prevention works for both ACH and WIRE transfers.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Filtering by Rail Type</h3>
            <p className="text-gray-700 mb-3">
              On the Intents page, use the rail type filter buttons to view:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>All Rails:</strong> View both ACH and WIRE transfers</li>
              <li className="list-disc"><strong>ACH:</strong> View only ACH transfers</li>
              <li className="list-disc"><strong>WIRE:</strong> View only WIRE transfers</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Visual Differentiation</h3>
            <p className="text-gray-700 mb-3">
              ACH transfers are visually distinguished with blue badges, while WIRE transfers use neutral badges. 
              This helps you quickly identify transfer types at a glance.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-emerald-900 mb-2">Same Security, More Options</h3>
        <p className="text-emerald-800">
          ACH transfers receive the same level of security as WIRE transfers: voice verification, AI clone detection, 
          coercion detection, and cryptographic signing. The fraud prevention is identical—only the transfer method differs.
        </p>
      </div>
    </div>
  );
}

function ComplianceContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Compliance & Reporting</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE provides comprehensive compliance and reporting capabilities with cryptographically signed audit trails. 
          Every action is logged and signed, creating an immutable record that strengthens your existing audit trail advantage.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Reports</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Complete Audit Trail</h3>
            <p className="text-gray-700 mb-2">
              Cryptographically signed audit log of all actions in the system. Includes every intent creation, 
              approval, denial, and execution with timestamps and cryptographic proofs.
            </p>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">Format: PDF</span>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">SOX Compliance Report</h3>
            <p className="text-gray-700 mb-2">
              Sarbanes-Oxley compliance documentation showing internal controls, approval workflows, and audit trails 
              required for financial reporting.
            </p>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">Format: PDF</span>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Fraud Prevention Summary</h3>
            <p className="text-gray-700 mb-2">
              Summary of fraud prevention measures, blocked attempts, spoof detection, and coercion detection incidents.
            </p>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">Format: PDF</span>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Approval History</h3>
            <p className="text-gray-700 mb-2">
              Complete history of all approvals and denials with approver information, timestamps, and reasons.
            </p>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">Format: CSV</span>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Risk Assessment Report</h3>
            <p className="text-gray-700 mb-2">
              Risk scores and assessments for all transfers, including risk factor breakdowns and trend analysis.
            </p>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">Format: PDF</span>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Evidence Bundle</h3>
            <p className="text-gray-700 mb-2">
              Complete cryptographic evidence bundle for legal purposes. Includes all signatures, proofs, and audit 
              logs in a tamper-proof format.
            </p>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">Format: ZIP</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-2">Cryptographic Signing</h3>
            <p className="text-sm text-gray-700">
              Every action is cryptographically signed, creating an immutable audit trail that cannot be tampered with.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-2">Regulatory Reports</h3>
            <p className="text-sm text-gray-700">
              Generate SOX, audit trail, and other regulatory reports with cryptographic proof of authenticity.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-2">Export Capabilities</h3>
            <p className="text-sm text-gray-700">
              Export reports in PDF, CSV, or ZIP formats. Evidence bundles include all cryptographic proofs.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-2">Legal Evidence</h3>
            <p className="text-sm text-gray-700">
              Complete evidence bundles with cryptographic signatures provide legal proof for disputes and investigations.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Date Range Selection</h3>
        <p className="text-blue-800">
          Select date ranges (7 days, 30 days, 90 days, or custom) when generating reports. All reports include 
          cryptographic proofs for the selected period.
        </p>
      </div>
    </div>
  );
}

function RiskManagementContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Enhanced Risk Management</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          WIRE's enhanced risk management tools strengthen the existing risk engine and support the policy-based approach. 
          These tools help you understand, monitor, and configure risk factors for your organization.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Risk Factor Breakdown</h2>
        <p className="text-gray-700 mb-4">
          WIRE calculates risk scores based on multiple factors. The Risk Management Tools section in the Admin Dashboard 
          shows how each factor contributes to overall risk:
        </p>
        <div className="space-y-3">
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">Amount Threshold</span>
              <span className="text-sm font-bold">35%</span>
            </div>
            <p className="text-sm text-gray-600">
              Transfers exceeding policy thresholds ($5k, $10k, etc.) increase risk scores significantly.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">Beneficiary Age</span>
              <span className="text-sm font-bold">28%</span>
            </div>
            <p className="text-sm text-gray-600">
              New beneficiaries (within policy-defined days) increase risk. Older beneficiaries reduce risk.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">Rail Type</span>
              <span className="text-sm font-bold">15%</span>
            </div>
            <p className="text-sm text-gray-600">
              WIRE transfers are typically higher risk than ACH due to irreversibility.
            </p>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">International</span>
              <span className="text-sm font-bold">12%</span>
            </div>
            <p className="text-sm text-gray-600">
              International transfers carry additional risk due to cross-border regulations and recovery difficulty.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Risk Trends & Analytics</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">7-Day Risk Trends</h3>
            <p className="text-gray-700 mb-3">
              View average risk scores over the past 7 days to identify patterns and trends. This helps you understand 
              if risk is increasing or decreasing over time.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Risk Metrics</h3>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>High-Risk Intents:</strong> Count of transfers with risk score &gt;60</li>
              <li className="list-disc"><strong>Critical Risk:</strong> Count of transfers with risk score &gt;85</li>
              <li className="list-disc"><strong>Average Risk Score:</strong> Mean risk score across all transfers</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Policy Configuration</h2>
        <p className="text-gray-700 mb-4">
          Risk management is closely tied to policy configuration. Navigate to the Policies page to configure:
        </p>
        <ul className="space-y-2 text-gray-700 ml-4">
          <li className="list-disc">Amount thresholds that trigger higher risk scores</li>
          <li className="list-disc">Beneficiary age requirements (days before considered "trusted")</li>
          <li className="list-disc">Rail type risk multipliers</li>
          <li className="list-disc">International transfer risk adjustments</li>
          <li className="list-disc">Dual approval requirements based on risk scores</li>
        </ul>
      </div>

      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-emerald-900 mb-2">Policy-Based Risk Engine</h3>
        <p className="text-emerald-800">
          WIRE's risk engine is policy-based, meaning you configure the rules and thresholds. The system automatically 
          calculates risk scores and determines approval requirements based on your policies. This gives you control 
          while maintaining consistency.
        </p>
      </div>
    </div>
  );
}

function AdminContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin & Management</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          The Admin Dashboard provides comprehensive oversight of your WIRE operations, including 
          metrics, user management, and system health.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Metrics</h2>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Financial Overview</h3>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Total Volume:</strong> Total transfer volume over selected period</li>
              <li className="list-disc"><strong>Fraud Prevented:</strong> Estimated fraud prevented by WIRE</li>
              <li className="list-disc"><strong>Active Users:</strong> Number of active users in the system</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Risk Metrics</h3>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Average Risk Score:</strong> Average risk across all transfers</li>
              <li className="list-disc"><strong>High-Risk Intents:</strong> Count of transfers with risk &gt;60</li>
              <li className="list-disc"><strong>Critical Risk:</strong> Count of transfers with risk &gt;85</li>
            </ul>
            <p className="text-gray-700 mt-3 text-sm">
              <strong>Enhanced Risk Management:</strong> See the "Risk Management" section in Help for detailed information 
              on risk factor breakdown, trends, and policy configuration.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Transfer Distribution</h3>
            <p className="text-gray-700 mb-3">
              View ACH vs WIRE transfer distribution with counts and percentages. See key differences between 
              ACH and WIRE transfers at a glance.
            </p>
            <p className="text-gray-700 text-sm">
              <strong>ACH Support:</strong> See the "ACH Transfer Support" section in Help for detailed information 
              on using ACH transfers in WIRE.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Compliance & Reporting</h3>
            <p className="text-gray-700 mb-3">
              Quick access to compliance metrics and reporting. Click "View Reports →" to navigate to the full 
              Compliance & Reporting page.
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Total Actions:</strong> All signed actions in the system</li>
              <li className="list-disc"><strong>Cryptographic Proof:</strong> 100% of actions are cryptographically signed</li>
              <li className="list-disc"><strong>Reports Generated:</strong> Count of reports generated this month</li>
            </ul>
            <p className="text-gray-700 mt-3 text-sm">
              <strong>Full Documentation:</strong> See the "Compliance & Reporting" section in Help for all available 
              report types and export capabilities.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Approval Analytics</h3>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Approval Rate:</strong> Percentage of transfers approved</li>
              <li className="list-disc"><strong>Average Approval Time:</strong> Time from creation to approval</li>
              <li className="list-disc"><strong>Dual-Approval Rate:</strong> Percentage requiring dual approval</li>
              <li className="list-disc"><strong>Pending Approvals:</strong> Current count of pending approvals</li>
            </ul>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Fraud Prevention</h3>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li className="list-disc"><strong>Attempts Blocked:</strong> Total fraud attempts prevented</li>
              <li className="list-disc"><strong>Spoof Detection:</strong> AI voice clone attempts detected</li>
              <li className="list-disc"><strong>Coercion Detection:</strong> Coercion attempts identified</li>
              <li className="list-disc"><strong>Challenge Success Rate:</strong> Percentage of successful verifications</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">User Management</h2>
        <p className="text-gray-700 mb-4">
          Manage users, roles, and permissions:
        </p>
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">User Roles</h3>
            <div className="space-y-3">
              <div>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium">ADMIN</span>
                <p className="text-sm text-gray-700 mt-2">Full system access, can manage users and policies</p>
              </div>
              <div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">TREASURY_INITIATOR</span>
                <p className="text-sm text-gray-700 mt-2">Can create transfer intents</p>
              </div>
              <div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium">APPROVER</span>
                <p className="text-sm text-gray-700 mt-2">Can approve transfer intents</p>
              </div>
              <div>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-medium">AUDITOR</span>
                <p className="text-sm text-gray-700 mt-2">Read-only access for audit purposes</p>
              </div>
              <div>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium">READ_ONLY</span>
                <p className="text-sm text-gray-700 mt-2">View-only access</p>
              </div>
            </div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Voice Enrollment</h3>
            <p className="text-gray-700">
              Track which users have completed voice enrollment. Users must enroll their voiceprint 
              before they can approve transfers. Enrollment status is shown for each user.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Real-Time Transaction Feed</h2>
        <p className="text-gray-700 mb-4">
          Monitor recent transfer activity in real-time:
        </p>
        <ul className="space-y-2 text-gray-700 ml-4">
          <li className="list-disc">See all recent transfers as they're created</li>
          <li className="list-disc">View status, amount, and risk scores</li>
          <li className="list-disc">Click any transfer to view full details</li>
          <li className="list-disc">Filter by status or risk level</li>
        </ul>
      </div>
    </div>
  );
}
