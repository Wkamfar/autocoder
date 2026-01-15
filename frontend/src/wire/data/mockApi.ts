// Mock API responses that simulate backend behavior
// Can be swapped out for real API calls later

import {
  MOCK_INTENTS,
  MOCK_CHALLENGES,
  MOCK_PROOFS,
  MOCK_DECISIONS,
  MOCK_AUDIT_BUNDLE,
  MOCK_BENEFICIARIES,
  MOCK_APPROVAL_STATUS,
  MOCK_EVENT_LOGS,
  MOCK_POLICY,
  MOCK_SERVICE_HEALTH,
  MOCK_ADMIN_METRICS,
  MOCK_ALL_USERS,
} from "./mockData";
import type {
  TransferIntent,
  VoiceChallenge,
  VoiceProof,
  Decision,
  Beneficiary,
  ApprovalStatus,
  EventLog,
  AuditBundle,
  PolicyVersion,
  ServiceHealth,
  AdminDashboardMetrics,
  OrgUser,
} from "../types/wire";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockApi = {
  // Intents
  getIntents: async (): Promise<TransferIntent[]> => {
    await delay(300);
    return MOCK_INTENTS;
  },
  
  getIntent: async (id: string): Promise<TransferIntent | undefined> => {
    await delay(200);
    return MOCK_INTENTS.find((i) => i.id === id);
  },
  
  createIntent: async (data: Partial<TransferIntent>): Promise<TransferIntent> => {
    await delay(500);
    const newIntent: TransferIntent = {
      id: `intent_${Date.now()}`,
      orgId: "org_acme_corp",
      createdByUserId: "user_alice_smith",
      railsType: data.railsType || "ACH",
      amountMinor: data.amountMinor || "0",
      currency: data.currency || "USD",
      beneficiaryId: data.beneficiaryId || "",
      beneficiaryVersion: data.beneficiaryVersion || 1,
      purpose: data.purpose || "",
      status: "DRAFT",
      riskScore: 0,
      riskRationaleJson: {
        factors: [],
        details: {},
        scoreBreakdown: { base: 0, total: 0 },
      },
      requiredApprovals: 1,
      requiredChallengeLevel: "L1",
      bindingHash: `sha256_hash_${Date.now()}`,
      cooldownUntil: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return newIntent;
  },
  
  updateIntent: async (id: string, data: Partial<TransferIntent>): Promise<TransferIntent> => {
    await delay(300);
    const intent = MOCK_INTENTS.find((i) => i.id === id);
    if (!intent) throw new Error("Intent not found");
    return {
      ...intent,
      ...data,
      bindingHash: `sha256_hash_${Date.now()}`, // New binding hash on edit
      updatedAt: new Date().toISOString(),
    };
  },
  
  // Challenges
  generateChallenge: async (intentId: string, language: string): Promise<VoiceChallenge | undefined> => {
    await delay(400);
    return MOCK_CHALLENGES[intentId as keyof typeof MOCK_CHALLENGES];
  },
  
  // Proofs
  submitProof: async (challengeId: string, audioBlob: Blob): Promise<VoiceProof> => {
    await delay(2000); // Simulate verification time
    return MOCK_PROOFS.intent_standard_ach;
  },
  
  // Decisions
  createDecision: async (
    intentId: string,
    action: "APPROVE" | "DENY" | "STEP_UP",
    proofId: string
  ): Promise<Decision & { approvalToken?: string }> => {
    await delay(300);
    const decision = MOCK_DECISIONS[intentId as keyof typeof MOCK_DECISIONS];
    if (!decision) {
      throw new Error("Decision not found");
    }
    return {
      ...decision,
      approvalToken: "mock_token_" + Date.now(), // Only returned once
    };
  },
  
  // Execution
  mintExecutionToken: async (
    intentId: string
  ): Promise<{ approvalToken: string; expiresAt: string }> => {
    await delay(150);
    return {
      approvalToken: `mock_exec_token_${intentId}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  },

  executeIntent: async (intentId: string, approvalToken: string): Promise<{ status: string; executionRef: string }> => {
    await delay(1000);
    return {
      status: "EXECUTED",
      executionRef: "mock-exec-ref-" + Date.now(),
    };
  },
  
  // Audit
  generateBundle: async (intentId: string, mode: "full" | "redacted" = "full"): Promise<AuditBundle> => {
    await delay(2000);
    return { ...MOCK_AUDIT_BUNDLE, intentId, mode };
  },

  verifyBundle: async (_bundleId: string): Promise<{ valid: boolean; signerKeyId: string }> => {
    await delay(150);
    return { valid: true, signerKeyId: "dev_key_1" };
  },

  getBundleDownloadUrl: async (bundleId: string): Promise<{ url: string; expiresIn: number; bundleId: string; intentId: string }> => {
    await delay(150);
    return { url: `mock://download/${bundleId}`, expiresIn: 3600, bundleId, intentId: "mock_intent" };
  },
  
  verifyEventChain: async (intentId: string): Promise<{ valid: boolean; errors: Array<{ seq: number; error: string }>; chainHash: string | null; eventCount: number }> => {
    await delay(150);
    const events = MOCK_EVENT_LOGS[intentId] || [];
    return { valid: true, errors: [], chainHash: events.length ? "mock_chain_hash" : null, eventCount: events.length };
  },
  
  getEventLogs: async (intentId: string): Promise<EventLog[]> => {
    await delay(200);
    return MOCK_EVENT_LOGS[intentId] || [];
  },
  
  // Beneficiaries
  getBeneficiaries: async (): Promise<Beneficiary[]> => {
    await delay(200);
    return MOCK_BENEFICIARIES;
  },
  
  createBeneficiary: async (data: Partial<Beneficiary>): Promise<Beneficiary> => {
    await delay(300);
    return {
      id: `benef_${Date.now()}`,
      orgId: "org_acme_corp",
      displayName: data.displayName || "",
      country: data.country || "US",
      railsAllowed: data.railsAllowed || ["ACH"],
      bankLast4: data.bankLast4 || "",
      bankTokenHash: `sha256_hash_${Date.now()}`,
      version: 1,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastChangedAt: new Date().toISOString(),
      lastChangedBy: "user_admin",
    };
  },
  
  lockBeneficiary: async (id: string): Promise<Beneficiary> => {
    await delay(200);
    const beneficiary = MOCK_BENEFICIARIES.find((b) => b.id === id);
    if (!beneficiary) throw new Error("Beneficiary not found");
    return { ...beneficiary, status: "LOCKED" };
  },
  
  // Approval Status
  getApprovalStatus: async (intentId: string): Promise<ApprovalStatus | undefined> => {
    await delay(200);
    return MOCK_APPROVAL_STATUS[intentId];
  },
  
  // Policy
  getPolicy: async (): Promise<PolicyVersion> => {
    await delay(200);
    return MOCK_POLICY;
  },
  
  // Service Health
  getServiceHealth: async (): Promise<ServiceHealth> => {
    await delay(100);
    return MOCK_SERVICE_HEALTH;
  },

  // Admin Dashboard
  getAdminMetrics: async (): Promise<AdminDashboardMetrics> => {
    await delay(300);
    return MOCK_ADMIN_METRICS;
  },

  getAllUsers: async (): Promise<OrgUser[]> => {
    await delay(200);
    return MOCK_ALL_USERS;
  },

  createUser: async (data: { name: string; email: string; role: string }): Promise<OrgUser> => {
    await delay(500);
    const newUser: OrgUser = {
      id: `user_${Date.now()}`,
      email: data.email,
      name: data.name,
      role: data.role as any,
      permissions: [],
      voiceEnrolled: false,
      createdAt: new Date().toISOString(),
    };
    MOCK_ALL_USERS.push(newUser);
    return newUser;
  },

  updateUserRole: async (userId: string, role: string): Promise<OrgUser> => {
    await delay(300);
    const user = MOCK_ALL_USERS.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.role = role as any;
    return user;
  },

  // Compliance & Reporting
  getComplianceData: async (dateRange: string): Promise<{
    totalActions: number;
    signedActions: number;
    unsignedActions: number;
    reportsGenerated: number;
  }> => {
    await delay(300);
    return {
      totalActions: 1247,
      signedActions: 1247,
      unsignedActions: 0,
      reportsGenerated: 23,
    };
  },

  downloadApprovalHistoryCsv: async (): Promise<void> => {
    await delay(200);
    // no-op in mock mode
  },

  downloadSecurityHistoryCsv: async (): Promise<void> => {
    await delay(200);
  },

  downloadAuditTrailPdf: async (): Promise<void> => {
    await delay(200);
  },

  getRetentionPolicy: async (): Promise<any> => {
    await delay(150);
    return { orgId: "org_acme_corp", authAuditRetentionDays: 180, evidenceBundleRetentionDays: 365, wormEnabled: false };
  },

  updateRetentionPolicy: async (): Promise<any> => {
    await delay(150);
    return { ok: true };
  },

  listLegalHolds: async (): Promise<any[]> => {
    await delay(150);
    return [];
  },

  createLegalHold: async (): Promise<any> => {
    await delay(150);
    return { ok: true };
  },

  releaseLegalHold: async (): Promise<any> => {
    await delay(150);
    return { ok: true };
  },

  purgePreview: async (): Promise<any> => {
    await delay(150);
    return { retentionDays: 365, candidates: 0, eligible: 0, sample: [] };
  },

  purgeRun: async (): Promise<any> => {
    await delay(150);
    return { deleted: 0 };
  },
};
