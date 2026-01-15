import React from "react";

export function WireProblemStatement() {
  return (
    <div className="space-y-6">
      {/* Problem Statement Panel */}
      <div className="border-2 border-red-500 rounded-2xl bg-red-50 overflow-hidden">
        <header className="border-b border-red-200 px-6 py-4 bg-gradient-to-r from-red-100 to-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-900">PDF Spoofing Costs Millions</h2>
              <p className="text-sm text-red-700">Current wire fraud prevention methods are failing</p>
            </div>
          </div>
        </header>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-red-200 rounded-xl p-4 bg-white">
              <p className="text-[10px] uppercase tracking-wide text-red-600 mb-1">Average Loss</p>
              <p className="text-3xl font-bold font-mono text-red-600">$2.3M</p>
              <p className="text-xs text-red-500 mt-1">per year per company</p>
            </div>
            <div className="border border-red-200 rounded-xl p-4 bg-white">
              <p className="text-[10px] uppercase tracking-wide text-red-600 mb-1">PDF Spoofing</p>
              <p className="text-3xl font-bold font-mono text-red-600">78%</p>
              <p className="text-xs text-red-500 mt-1">of wire fraud cases</p>
            </div>
            <div className="border border-red-200 rounded-xl p-4 bg-white">
              <p className="text-[10px] uppercase tracking-wide text-red-600 mb-1">Still Vulnerable</p>
              <p className="text-3xl font-bold font-mono text-red-600">100%</p>
              <p className="text-xs text-red-500 mt-1">handwritten forms</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <div>
                <p className="font-semibold text-red-900 mb-1">PDFs Get Spoofed</p>
                <p className="text-sm text-red-700">Attackers intercept PDF approval emails, modify amounts/beneficiaries, and resend. Recipients approve without noticing changes.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <div>
                <p className="font-semibold text-red-900 mb-1">Handwritten Forms Still Fail</p>
                <p className="text-sm text-red-700">Companies resorted to handwritten scanned forms, but these can still be digitally altered or forged. Millions still lost annually.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <div>
                <p className="font-semibold text-red-900 mb-1">No Real-Time Verification</p>
                <p className="text-sm text-red-700">Current methods rely on static documents that can be modified. There's no way to verify the approver's identity in real-time.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Old Way vs New Way Comparison */}
      <div className="border-2 border-black rounded-2xl bg-white overflow-hidden">
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Old Way vs New Way</h2>
        </header>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Old Way */}
            <div className="border-2 border-red-300 rounded-xl p-5 bg-red-50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-red-900">Old Way (PDF/Handwritten)</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <p className="text-sm text-red-800">PDF approval email sent</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <p className="text-sm text-red-800">Attacker intercepts & modifies</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <p className="text-sm text-red-800">Approver signs without noticing</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <p className="text-sm text-red-800 font-semibold">Money sent to wrong account</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✗</span>
                  <p className="text-sm text-red-800 font-semibold">Millions lost</p>
                </div>
              </div>
            </div>

            {/* New Way */}
            <div className="border-2 border-emerald-300 rounded-xl p-5 bg-emerald-50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-emerald-900">New Way (WIRE Voice)</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <p className="text-sm text-emerald-800">Transfer intent created</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <p className="text-sm text-emerald-800">Real-time voice challenge</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <p className="text-sm text-emerald-800">Voice verified (cannot be spoofed)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <p className="text-sm text-emerald-800 font-semibold">Transfer protected</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <p className="text-sm text-emerald-800 font-semibold">Zero fraud</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Guarantees */}
      <div className="border-2 border-black rounded-2xl bg-white overflow-hidden">
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Security Guarantees</h2>
        </header>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3l7 4v6c0 5-3 9-7 11-4-2-7-6-7-11V7l7-4z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.5 12.5l1.8 1.8L14.8 10.6"
                  />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Voice Cannot Be Spoofed</h3>
              <p className="text-sm text-gray-600">AI voice clones are detected and blocked. Your unique voiceprint is verified in real-time.</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Every Transfer Protected</h3>
              <p className="text-sm text-gray-600">Every transfer requires your voice approval. No exceptions. No bypasses.</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Immutable Audit Trail</h3>
              <p className="text-sm text-gray-600">Every action is cryptographically signed and stored. Complete transparency and auditability.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
