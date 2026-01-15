// Real API client for WIRE backend
import { getApiBaseUrl, API_CONFIG } from './config';
import { parseWireErrorResponse, WireApiError } from "./errors";
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
} from '../types/wire';
import type {
  PoseVoiceEnrollStartResponse,
  PoseVoiceEnrollCompleteResponse,
  PoseVoiceStatusResponse,
  PoseVoiceVerifyResponse,
} from "../types/poseVoice";

// Helper to make API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  // Only set JSON Content-Type when we actually send a JSON body.
  // Fastify will reject empty bodies when Content-Type is application/json.
  if (!headers["Content-Type"] && typeof options.body === "string" && options.body.length > 0) {
    headers["Content-Type"] = "application/json";
  }

  // Auth strategy (production):
  // - Use Bearer token auth (session-based)
  const token = localStorage.getItem('wire_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw await parseWireErrorResponse(response);
  }

  return response.json();
}

function authHeadersForNonApiRequest(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("wire_auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const headers: HeadersInit = authHeadersForNonApiRequest();
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    throw await parseWireErrorResponse(res);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export const wireApi = {
  // Current session identity
  getMe: async (): Promise<{ user: OrgUser; organization: { id: string; name: string; createdAt: string } }> => {
    return apiRequest<{ user: OrgUser; organization: { id: string; name: string; createdAt: string } }>(
      '/api/wire/me'
    );
  },

  // Intents
  getIntents: async (): Promise<TransferIntent[]> => {
    return apiRequest<TransferIntent[]>('/api/wire/intents');
  },

  getIntent: async (id: string): Promise<TransferIntent | undefined> => {
    try {
      return await apiRequest<TransferIntent>(`/api/wire/intents/${id}`);
    } catch (error) {
      if (error instanceof WireApiError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  },

  createIntent: async (data: {
    railsType: 'ACH' | 'WIRE';
    amountMinor: string;
    currency: string;
    beneficiaryId: string;
    purpose: string;
  }): Promise<TransferIntent> => {
    return apiRequest<TransferIntent>('/api/wire/intents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateIntent: async (
    id: string,
    data: Partial<TransferIntent>
  ): Promise<TransferIntent> => {
    return apiRequest<TransferIntent>(`/api/wire/intents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Challenges
  generateChallenge: async (
    intentId: string,
    language: string = 'EN'
  ): Promise<VoiceChallenge | undefined> => {
    try {
      return await apiRequest<VoiceChallenge>(
        `/api/wire/intents/${intentId}/challenge`,
        {
          method: 'POST',
          body: JSON.stringify({ language }),
        }
      );
    } catch (error) {
      console.error('Failed to generate challenge:', error);
      return undefined;
    }
  },

  // Proofs
  submitProof: async (
    challengeId: string,
    audioBlob: Blob,
    transcript?: string
  ): Promise<VoiceProof> => {
    // Use FormData for multipart/form-data upload (better for binary data)
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('channel', 'BROWSER');
    formData.append('transcript', transcript || 'Authorize transfer');
    formData.append('deviceMetadataJson', JSON.stringify({
      userAgent: navigator.userAgent,
      browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other',
      os: navigator.platform,
    }));

    const url = `${getApiBaseUrl()}/api/wire/challenges/${challengeId}/proof`;
    const headers: HeadersInit = authHeadersForNonApiRequest();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData, // FormData sets Content-Type automatically with boundary
    });

    if (!response.ok) {
      throw await parseWireErrorResponse(response);
    }

    return response.json();
  },

  // Decisions
  createDecision: async (
    intentId: string,
    action: 'APPROVE' | 'DENY' | 'STEP_UP',
    proofId: string,
    reasonCodesJson?: string[]
  ): Promise<Decision & { approvalToken?: string }> => {
    return apiRequest<Decision & { approvalToken?: string }>(
      `/api/wire/intents/${intentId}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({
          action,
          proofId,
          reasonCodesJson,
        }),
      }
    );
  },

  // Execution
  mintExecutionToken: async (
    intentId: string
  ): Promise<{ approvalToken: string; expiresAt: string }> => {
    return apiRequest<{ approvalToken: string; expiresAt: string }>(
      `/api/wire/intents/${intentId}/execution-token`,
      { method: "POST" }
    );
  },

  executeIntent: async (
    intentId: string,
    approvalToken: string,
    idempotencyKey?: string
  ): Promise<{ status: string; executionRef: string; ledgerId?: string }> => {
    const headers: Record<string, string> = {
      'X-POSE-APPROVAL': approvalToken,
    };
    
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const url = `${getApiBaseUrl()}/api/wire/intents/${intentId}/execute`;
    const authHeaders = authHeadersForNonApiRequest();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      throw await parseWireErrorResponse(response);
    }

    return response.json();
  },

  // Audit
  generateBundle: async (
    intentId: string,
    mode: 'full' | 'redacted' = 'full'
  ): Promise<AuditBundle> => {
    return apiRequest<AuditBundle>(
      `/api/wire/intents/${intentId}/bundle?mode=${mode}`
    );
  },

  verifyBundle: async (bundleId: string): Promise<{ valid: boolean; error?: string; signerKeyId: string }> => {
    return apiRequest(`/api/wire/bundles/${bundleId}/verify`);
  },

  getBundleDownloadUrl: async (
    bundleId: string,
    expiresInSeconds: number = 3600
  ): Promise<{ url: string; expiresIn: number; bundleId: string; intentId: string }> => {
    return apiRequest(`/api/wire/bundles/${bundleId}/download?expiresIn=${expiresInSeconds}`);
  },

  verifyDecision: async (
    decisionId: string
  ): Promise<{ valid: boolean; signerKeyId: string; decisionHash: string; error?: string }> => {
    return apiRequest(`/api/wire/decisions/${decisionId}/verify`);
  },

  getEventLogs: async (intentId: string): Promise<EventLog[]> => {
    return apiRequest<EventLog[]>(`/api/wire/intents/${intentId}/events`);
  },

  verifyEventChain: async (intentId: string): Promise<{
    valid: boolean;
    errors: Array<{ seq: number; error: string }>;
    chainHash: string | null;
    eventCount: number;
  }> => {
    return apiRequest(`/api/wire/intents/${intentId}/events/verify`);
  },

  // Beneficiaries
  getBeneficiaries: async (): Promise<Beneficiary[]> => {
    return apiRequest<Beneficiary[]>('/api/wire/beneficiaries');
  },

  createBeneficiary: async (data: Partial<Beneficiary>): Promise<Beneficiary> => {
    return apiRequest<Beneficiary>('/api/wire/beneficiaries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateBeneficiary: async (
    id: string,
    data: Partial<Beneficiary>
  ): Promise<Beneficiary> => {
    return apiRequest<Beneficiary>(`/api/wire/beneficiaries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  lockBeneficiary: async (id: string): Promise<Beneficiary> => {
    return apiRequest<Beneficiary>(`/api/wire/beneficiaries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'LOCKED' }),
    });
  },

  // Approval Status (derived from intent)
  getApprovalStatus: async (intentId: string): Promise<ApprovalStatus | undefined> => {
    try {
      return await apiRequest<ApprovalStatus>(`/api/wire/intents/${intentId}/approval-status`);
    } catch (error) {
      console.error("Failed to load approval status:", error);
      return undefined;
    }
  },

  // Policy
  getPolicy: async (): Promise<PolicyVersion> => {
    // Backend returns a single active policy pack (not an array).
    return apiRequest<PolicyVersion>('/api/wire/policies');
  },

  createPolicy: async (data: {
    thresholds: PolicyVersion['thresholds'];
    rules: PolicyVersion['rules'];
  }): Promise<PolicyVersion> => {
    return apiRequest<PolicyVersion>('/api/wire/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Service Health
  getServiceHealth: async (): Promise<ServiceHealth> => {
    return apiRequest<ServiceHealth>('/api/wire/health');
  },

  // Admin Dashboard
  getAdminMetrics: async (): Promise<AdminDashboardMetrics> => {
    return apiRequest<AdminDashboardMetrics>('/api/wire/admin/metrics');
  },

  // User Management
  getAllUsers: async (): Promise<OrgUser[]> => {
    return apiRequest<OrgUser[]>('/api/wire/users');
  },

  getUser: async (id: string): Promise<OrgUser> => {
    return apiRequest<OrgUser>(`/api/wire/users/${id}`);
  },

  createUser: async (data: {
    name: string;
    email: string;
    role: string;
    permissions?: string[];
  }): Promise<OrgUser> => {
    return apiRequest<OrgUser>('/api/wire/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateUser: async (
    userId: string,
    data: {
      name?: string;
      role?: string;
      permissions?: string[];
      voiceEnrolled?: boolean;
    }
  ): Promise<OrgUser> => {
    return apiRequest<OrgUser>(`/api/wire/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Convenience alias (used by admin UI)
  updateUserRole: async (userId: string, role: string): Promise<OrgUser> => {
    return apiRequest<OrgUser>(`/api/wire/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  deleteUser: async (userId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/api/wire/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Organization Management
  getCurrentOrganization: async (): Promise<{
    id: string;
    name: string;
    createdAt: string;
  }> => {
    return apiRequest('/api/organizations/current');
  },

  updateOrganization: async (data: {
    name?: string;
  }): Promise<{
    id: string;
    name: string;
    createdAt: string;
  }> => {
    return apiRequest('/api/organizations/current', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  createOrganization: async (data: {
    name: string;
    adminEmail: string;
    adminName: string;
  }): Promise<{
    organization: {
      id: string;
      name: string;
      createdAt: string;
    };
    adminUser: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }> => {
    return apiRequest('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Auth
  login: async (data: { email: string; password?: string }): Promise<{ token: string }> => {
    return apiRequest<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  oidcAuthorize: async (params?: { orgId?: string; returnTo?: string }): Promise<{ authorizationUrl: string }> => {
    const qs = new URLSearchParams();
    if (params?.orgId) qs.set("orgId", params.orgId);
    if (params?.returnTo) qs.set("returnTo", params.returnTo);
    const url = qs.toString() ? `/api/auth/oidc/authorize?${qs.toString()}` : "/api/auth/oidc/authorize";
    return apiRequest(url);
  },

  consumeMagicLink: async (token: string): Promise<{ token: string; sessionId: string; user: OrgUser }> => {
    return apiRequest<{ token: string; sessionId: string; user: OrgUser }>('/api/auth/magic/consume', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  requestPasswordReset: async (email: string): Promise<{ success: true }> => {
    return apiRequest<{ success: true }>('/api/auth/password/reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  confirmPasswordReset: async (data: {
    token: string;
    newPassword: string;
  }): Promise<{ token: string; sessionId: string; user: OrgUser }> => {
    return apiRequest<{ token: string; sessionId: string; user: OrgUser }>('/api/auth/password/reset/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: async (): Promise<void> => {
    try {
      await apiRequest<void>('/api/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      // Ignore errors on logout
      console.error('Logout error:', err);
    }
  },

  // Sessions
  getSessions: async (): Promise<{
    currentSessionId: string | null;
    sessions: Array<{
      id: string;
      createdAt: string;
      lastActivityAt: string;
      expiresAt: string;
      revokedAt: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      deviceFingerprint: string | null;
    }>;
  }> => {
    return apiRequest("/api/auth/sessions");
  },

  /**
   * Revoke sessions for the current user.
   * - includeCurrent=false: revoke all other sessions (verifiable without logging the user out)
   * - includeCurrent=true: revoke all sessions including current (logs user out everywhere)
   */
  logoutAll: async (includeCurrent: boolean): Promise<{ success: true; revoked: number; includeCurrent: boolean }> => {
    const qs = includeCurrent ? "?includeCurrent=1" : "";
    return apiRequest(`/api/auth/logout_all${qs}`, { method: "POST" });
  },

  signup: async (data: {
    organizationName: string;
    adminEmail: string;
    adminName: string;
    password?: string;
  }): Promise<{
    organization: { id: string; name: string; createdAt: string };
    adminUser: { id: string; email: string; name: string };
    emailDelivery?: { provider: string; delivered: boolean; messageId?: string; error?: string };
    message?: string;
  }> => {
    return apiRequest<{
      organization: { id: string; name: string; createdAt: string };
      adminUser: { id: string; email: string; name: string };
      emailDelivery?: { provider: string; delivered: boolean; messageId?: string; error?: string };
      message?: string;
    }>('/api/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Invitations (Teams)
  createInvitation: async (data: {
    email: string;
    role: string;
    permissions?: string[];
    expiresInDays?: number;
  }): Promise<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    inviteUrl?: string;
    createdAt: string;
  }> => {
    return apiRequest('/api/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getInvitationByToken: async (token: string): Promise<{
    id: string;
    email: string;
    role: string;
    permissions: string[];
    orgName?: string;
    expiresAt: string;
  }> => {
    return apiRequest(`/api/invitations/token/${token}`);
  },

  acceptInvitation: async (data: { token: string; name: string }): Promise<{
    success: boolean;
    userId: string;
    orgId: string;
    message: string;
  }> => {
    return apiRequest('/api/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Public Intents (no-login)
  createPublicIntent: async (data: {
    railsType: "ACH" | "WIRE";
    amountMinor: string;
    currency: string;
    purpose: string;
    beneficiary: {
      displayName: string;
      country: string;
      bankLast4: string;
      bankToken: string;
    };
    requestor?: { email?: string; name?: string };
  }): Promise<{
    id: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    claimToken: string;
    claimUrl: string;
  }> => {
    return apiRequest('/api/public/intents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPublicIntent: async (id: string): Promise<any> => {
    return apiRequest(`/api/public/intents/${id}`);
  },

  claimPublicIntent: async (id: string, claimToken: string): Promise<{
    success: boolean;
    linkedIntentId: string;
    message: string;
  }> => {
    // Claim is protected (org context)
    return apiRequest(`/api/wire/public-intents/${id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ claimToken }),
    });
  },

  // Domains (org settings)
  getCustomDomains: async (): Promise<any[]> => {
    return apiRequest('/api/wire/domains/custom');
  },
  addCustomDomain: async (domain: string): Promise<any> => {
    return apiRequest('/api/wire/domains/custom', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
  },
  verifyCustomDomain: async (id: string): Promise<any> => {
    return apiRequest(`/api/wire/domains/custom/${id}/verify`, { method: 'POST' });
  },
  deleteCustomDomain: async (id: string): Promise<any> => {
    return apiRequest(`/api/wire/domains/custom/${id}`, { method: 'DELETE' });
  },

  getEmailDomains: async (): Promise<any[]> => {
    return apiRequest('/api/wire/domains/email');
  },
  addEmailDomain: async (domain: string): Promise<any> => {
    return apiRequest('/api/wire/domains/email', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
  },
  verifyEmailDomain: async (id: string): Promise<any> => {
    return apiRequest(`/api/wire/domains/email/${id}/verify`, { method: 'POST' });
  },
  deleteEmailDomain: async (id: string): Promise<any> => {
    return apiRequest(`/api/wire/domains/email/${id}`, { method: 'DELETE' });
  },

  // Security history
  getSecurityHistory: async (params?: { days?: number; limit?: number }): Promise<any[]> => {
    const q = new URLSearchParams();
    if (params?.days) q.set("days", String(params.days));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiRequest(`/api/wire/security-history${qs ? `?${qs}` : ""}`);
  },

  // Org groups (rollups)
  getOrgGroups: async (): Promise<any> => {
    return apiRequest("/api/wire/org-groups");
  },
  createOrgGroup: async (name: string): Promise<any> => {
    return apiRequest("/api/wire/org-groups", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  addOrgGroupMember: async (groupId: string, orgId: string, role: string): Promise<any> => {
    return apiRequest(`/api/wire/org-groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ orgId, role }),
    });
  },
  removeOrgGroupMember: async (groupId: string, orgId: string): Promise<any> => {
    return apiRequest(`/api/wire/org-groups/${groupId}/members/${orgId}`, { method: "DELETE" });
  },
  getOrgGroupMetrics: async (groupId: string): Promise<any> => {
    return apiRequest(`/api/wire/org-groups/${groupId}/metrics`);
  },

  // SSO config
  getSsoConfig: async (): Promise<any> => {
    return apiRequest("/api/wire/sso");
  },
  updateSsoConfig: async (data: { enforced: boolean; allowedEmailDomains: string[] }): Promise<any> => {
    return apiRequest("/api/wire/sso", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // API Keys
  getApiKeys: async (): Promise<any[]> => {
    return apiRequest<any[]>('/api/wire/api-keys');
  },

  createApiKey: async (data: { name: string; permissions?: string[]; expiresInDays?: number }): Promise<any> => {
    return apiRequest<any>('/api/wire/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  revokeApiKey: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/wire/api-keys/${id}/revoke`, {
      method: 'POST',
    });
  },

  deleteApiKey: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/wire/api-keys/${id}`, {
      method: 'DELETE',
    });
  },

  // Webhooks
  getWebhooks: async (): Promise<any[]> => {
    return apiRequest<any[]>('/api/wire/webhooks');
  },

  getWebhookDeliveries: async (id: string, limit: number = 25): Promise<any[]> => {
    const qs = new URLSearchParams({ limit: String(limit) });
    return apiRequest<any[]>(`/api/wire/webhooks/${id}/deliveries?${qs.toString()}`);
  },

  createWebhook: async (data: {
    name: string;
    url: string;
    events: string[];
  }): Promise<any> => {
    return apiRequest<any>('/api/wire/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateWebhook: async (
    id: string,
    data: Partial<{
      name: string;
      url: string;
      events: string[];
      active: boolean;
    }>
  ): Promise<any> => {
    return apiRequest<any>(`/api/wire/webhooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteWebhook: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/wire/webhooks/${id}`, {
      method: 'DELETE',
    });
  },

  testWebhook: async (id: string): Promise<{ success: boolean; deliveryId: string }> => {
    return apiRequest<{ success: boolean; deliveryId: string }>(`/api/wire/webhooks/${id}/test`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  rotateWebhookSecret: async (id: string): Promise<{ secret: string }> => {
    return apiRequest<{ secret: string }>(`/api/wire/webhooks/${id}/rotate-secret`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  // Compliance & Reporting (mock for now)
  getComplianceData: async (dateRange: string): Promise<{
    totalActions: number;
    signedActions: number;
    unsignedActions: number;
    reportsGenerated: number;
  }> => {
    // Map UI ranges → days
    const days =
      dateRange === "7d" ? 7 :
      dateRange === "90d" ? 90 :
      dateRange === "custom" ? 30 :
      30;
    const res = await apiRequest<{
      totalActions: number;
      signedActions: number;
      unsignedActions: number;
      reportsGenerated: number;
    }>(`/api/wire/compliance/summary?days=${days}`);
    return res;
  },

  getRetentionPolicy: async (): Promise<{
    orgId: string;
    authAuditRetentionDays: number;
    evidenceBundleRetentionDays: number;
    wormEnabled: boolean;
  }> => {
    return apiRequest(`/api/wire/compliance/retention`);
  },

  updateRetentionPolicy: async (data: {
    authAuditRetentionDays?: number;
    evidenceBundleRetentionDays?: number;
    wormEnabled?: boolean;
  }): Promise<any> => {
    return apiRequest(`/api/wire/compliance/retention`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  listLegalHolds: async (): Promise<any[]> => {
    return apiRequest(`/api/wire/compliance/legal-holds`);
  },

  createLegalHold: async (data: { intentId?: string; bundleId?: string; reason: string }): Promise<any> => {
    return apiRequest(`/api/wire/compliance/legal-holds`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  releaseLegalHold: async (id: string): Promise<any> => {
    return apiRequest(`/api/wire/compliance/legal-holds/${id}/release`, { method: "POST" });
  },

  purgePreview: async (): Promise<any> => {
    return apiRequest(`/api/wire/compliance/purge/preview`);
  },

  purgeRun: async (limit: number = 100): Promise<any> => {
    return apiRequest(`/api/wire/compliance/purge/run`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    });
  },

  downloadApprovalHistoryCsv: async (dateRange: string): Promise<void> => {
    const days =
      dateRange === "7d" ? 7 :
      dateRange === "90d" ? 90 :
      dateRange === "custom" ? 30 :
      30;
    const path = `/api/wire/compliance/reports/approval-history.csv?days=${days}&verify=1`;
    await downloadFile(path, `approval-history_${days}d.csv`);
  },

  downloadSecurityHistoryCsv: async (days: number = 180): Promise<void> => {
    const path = `/api/wire/compliance/reports/security-history.csv?days=${days}`;
    await downloadFile(path, `security-history_${days}d.csv`);
  },

  downloadAuditTrailPdf: async (dateRange: string): Promise<void> => {
    const days =
      dateRange === "7d" ? 7 :
      dateRange === "90d" ? 90 :
      dateRange === "custom" ? 30 :
      30;
    const path = `/api/wire/compliance/reports/audit-trail.pdf?days=${days}`;
    await downloadFile(path, `audit-trail_${days}d.pdf`);
  },

  // POSE identity: voice onboarding + verify
  poseVoiceStatus: async (): Promise<PoseVoiceStatusResponse> => {
    return apiRequest<PoseVoiceStatusResponse>("/api/pose/voice/status");
  },

  poseVoiceEnrollStart: async (): Promise<PoseVoiceEnrollStartResponse> => {
    // Send an explicit empty JSON object.
    // Some proxies / clients may attach Content-Type: application/json even when body is omitted,
    // and Fastify rejects empty bodies for application/json.
    return apiRequest<PoseVoiceEnrollStartResponse>("/api/pose/voice/enroll/start", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  poseVoiceEnrollComplete: async (params: {
    enrollmentId: string;
    poseId: string;
    poseChallengeId: string;
    takes: { ihc: Blob; phrase: Blob; name?: Blob | null };
    clientMetadata: Record<string, unknown>;
    consentFlags: Record<string, boolean>;
  }): Promise<PoseVoiceEnrollCompleteResponse> => {
    const formData = new FormData();
    formData.append("enrollment_id", params.enrollmentId);
    formData.append("pose_id", params.poseId);
    formData.append("pose_challenge_id", params.poseChallengeId);
    formData.append("client_metadata_json", JSON.stringify(params.clientMetadata ?? {}));
    formData.append("consent_flags_json", JSON.stringify(params.consentFlags ?? {}));
    formData.append("take_ihc", params.takes.ihc, "take_ihc.wav");
    formData.append("take_phrase", params.takes.phrase, "take_phrase.wav");
    if (params.takes.name) formData.append("take_name", params.takes.name, "take_name.wav");

    const url = `${getApiBaseUrl()}/api/pose/voice/enroll/complete`;
    const headers: HeadersInit = authHeadersForNonApiRequest();
    const res = await fetch(url, { method: "POST", headers, body: formData });
    if (!res.ok) {
      throw await parseWireErrorResponse(res);
    }
    return res.json();
  },

  poseVoiceVerify: async (params: {
    poseId: string;
    audio: Blob;
    toneDurationMs?: number;
  }): Promise<PoseVoiceVerifyResponse> => {
    const formData = new FormData();
    formData.append("pose_id", params.poseId);
    if (params.toneDurationMs) formData.append("tone_duration_ms", String(params.toneDurationMs));
    formData.append("audio", params.audio, "verify.wav");

    const url = `${getApiBaseUrl()}/api/pose/voice/verify`;
    const headers: HeadersInit = authHeadersForNonApiRequest();
    const res = await fetch(url, { method: "POST", headers, body: formData });
    if (!res.ok) {
      throw await parseWireErrorResponse(res);
    }
    return res.json();
  },

  // Fast Wire API methods
  getFastWire: async (token: string): Promise<{
    id: string;
    status: string;
    amountMinor: string;
    currency: string;
    purpose: string;
    requestorName: string;
    requestorEmail: string;
    beneficiaryEmail: string;
    requestorPoseTxHash: string | null;
    approverPoseTxHash: string | null;
    finalApprovalPoseTxHash: string | null;
    createdAt: string;
  }> => {
    return apiRequest(`/api/wire/fast-wire/${token}`);
  },

  submitFastWireVoiceProof: async (requestorEmail: string, audio: Blob): Promise<{ voiceProofId: string }> => {
    const formData = new FormData();
    formData.append("requestor_email", requestorEmail);
    formData.append("audio", audio, "voice-proof.wav");

    const url = `${getApiBaseUrl()}/api/wire/fast-wire/submit-voice-proof`;
    const headers: HeadersInit = authHeadersForNonApiRequest();
    const res = await fetch(url, { method: "POST", headers, body: formData });
    if (!res.ok) {
      throw await parseWireErrorResponse(res);
    }
    return res.json();
  },

  sendEmailVerificationCode: async (email: string): Promise<void> => {
    await apiRequest("/api/wire/fast-wire/verify-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  createFastWireRequest: async (data: {
    role: "REQUESTOR";
    amount: string;
    currency: string;
    purpose: string;
    beneficiaryEmail: string;
    requestorEmail: string;
    requestorName: string;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    voiceProofId?: string;
    emailVerificationCode?: string;
  }): Promise<{
    id: string;
    status: string;
    approvalUrl: string;
    shareableUrl: string;
    poseTxHash: string | null;
    createdAt: string;
  }> => {
    return apiRequest("/api/wire/fast-wire/request", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  approveFastWire: async (token: string, data: {
    approverEmail: string;
    approverName: string;
    accountNumber?: string;
    routingNumber?: string;
    bankName?: string;
  }): Promise<{
    id: string;
    status: string;
    poseTxHash: string | null;
  }> => {
    return apiRequest(`/api/wire/fast-wire/${token}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
