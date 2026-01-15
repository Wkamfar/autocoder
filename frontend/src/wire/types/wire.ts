// ============================================================================
// PAYMENT REQUESTS (Fund Request Flow)
// Money you are ASKING FOR (incoming payment requests from vendors)
// ============================================================================

export type RequestStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "DENIED"
  | "PAID"
  | "EXPIRED";

export type PaymentRequest = {
  id: string;
  orgId: string; // Requestor's org
  approverOrgId: string; // Approver's org
  requestorUserId: string;
  requestorName: string;
  requestorEmail: string;
  amountMinor: string;
  currency: string;
  invoiceNumber?: string;
  dueDate?: string;
  purpose: string;
  status: RequestStatus;
  requestHash: string; // Cryptographic hash for tamper detection
  emailVerifiedAt?: string;
  voiceVerifiedAt?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  deniedAt?: string;
  deniedReason?: string;
  intentId?: string; // Linked intent if approved
  supportingDocuments?: Array<{
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
  }>;
  verificationStatus: {
    email: boolean;
    voice: boolean;
    domain: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// ROLES & PERMISSIONS
// ============================================================================

export type UserRole = 
  | "ADMIN" 
  | "TREASURY_INITIATOR" 
  | "APPROVER" 
  | "AUDITOR" 
  | "READ_ONLY";

export type Permission =
  | "intent:create"
  | "intent:approve"
  | "intent:execute"
  | "beneficiary:create"
  | "beneficiary:lock"
  | "policy:edit"
  | "evidence:view"
  | "evidence:export_full"
  | "evidence:export_redacted";

// ============================================================================
// POLICY
// ============================================================================

export type PolicyVersion = {
  policyId: string;
  version: number;
  effectiveAt: string;
  thresholds: {
    amountStepUpMinor: string;
    dualApprovalRiskScore: number;
    criticalRiskScore: number;
    newBeneficiaryDays: number;
    outOfHoursStartHourLocal: number;
    outOfHoursEndHourLocal: number;
  };
  rules: {
    requireDualApprovalForInternationalWire: boolean;
    requirePhoneForL3IfMicDenied: boolean;
    cooldownMinutesForHighRisk: number;
    lockoutAfterFailedAttempts: number;
  };
};

// ============================================================================
// INTENTS (Transfer Intents)
// Money you are SENDING (outgoing payments from treasury)
// ============================================================================

export type RailsType = "ACH" | "WIRE";
export type IntentStatus = 
  | "DRAFT"
  | "PENDING_PROOF"
  | "CHALLENGING"
  | "PENDING_APPROVALS"
  | "APPROVED"
  | "DENIED"
  | "EXECUTED"
  | "EXPIRED"
  | "CANCELED";

export type RiskRationale = {
  factors: string[];
  details: Record<string, string>;
  scoreBreakdown: {
    base: number;
    amount?: number;
    beneficiary?: number;
    rails?: number;
    international?: number;
    timing?: number;
    total: number;
  };
};

export type TransferIntent = {
  id: string;
  orgId: string;
  createdByUserId: string;
  railsType: RailsType;
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  beneficiaryVersion?: number;
  purpose: string;
  status: IntentStatus;
  riskScore: number;
  riskRationaleJson: RiskRationale;
  requiredApprovals: number;
  requiredChallengeLevel: "L1" | "L2" | "L3";
  bindingHash?: string;
  cooldownUntil?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// CHALLENGES & PROOFS
// ============================================================================

export type ChallengeLevel = "L1" | "L2" | "L3";
export type ChallengeLanguage = "EN" | "ES";
export type ProofChannel = "BROWSER" | "PHONE";

export type ExpectedSlots = {
  slots: Array<{
    name: string;
    type: "amount" | "digits" | "words";
    value: string;
    spoken: string[];
    position: number;
  }>;
  prosody_modifier?: {
    type: "speed" | "whisper";
    target: string;
    instruction: string;
  };
};

export type VoiceChallenge = {
  id: string;
  intentId: string;
  language: ChallengeLanguage;
  level: ChallengeLevel;
  grammarVersion: string;
  challengeNonce: string;
  challengeText: string;
  expectedSlotsJson: ExpectedSlots;
  expiresAt: string;
  createdAt: string;
};

export type VoiceScores = {
  identity_confidence: number;
  liveness_score: number;
  spoof_risk_score: number;
  drift_score: number;
  coercion_risk_score: number;
  challenge_match_score: number;
};

export type DeviceMetadata = {
  ip?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  callSessionId?: string;
  callStartedAt?: string;
  callDurationSeconds?: number;
  phoneNumber?: string;
};

export type VoiceProof = {
  id: string;
  intentId: string;
  challengeId: string;
  userId: string;
  channel: ProofChannel;
  transcript: string;
  transcriptLanguage: string | null;
  scoresJson: VoiceScores;
  deviceMetadataJson: DeviceMetadata;
  audioEncryptedRef?: string;
  audioHash?: string;
  modelVersion?: string;
  createdAt: string;
};

// ============================================================================
// DECISIONS & APPROVALS
// ============================================================================

export type DecisionType = "APPROVE" | "DENY" | "STEP_UP";

export type Decision = {
  id: string;
  intentId: string;
  decisionType: DecisionType;
  reasonCodesJson: string[];
  approvalTokenHash: string | null;
  expiresAt: string | null;
  signerKeyId: string;
  decisionPayloadCanonicalJson: string;
  decisionHash: string;
  signature: string;
  policyId?: string;
  policyVersion?: number;
  riskEngineVersion?: string;
  createdByUserId: string;
  createdAt: string;
};

export type ApprovalToken = {
  tokenHash: string;
  expiresAt: string;
  bindingHash: string;
};

export type ApprovalStatus = {
  required: number;
  completed: number;
  approvers: Array<{
    userId: string;
    name: string;
    status: "pending" | "completed";
    completedAt: string | null;
  }>;
};

// ============================================================================
// BENEFICIARIES
// ============================================================================

export type Beneficiary = {
  id: string;
  orgId: string;
  displayName: string;
  country: string;
  railsAllowed: RailsType[];
  bankLast4: string;
  bankTokenHash: string;
  version: number;
  status: "ACTIVE" | "LOCKED" | "PENDING_VERIFICATION";
  createdAt: string;
  updatedAt: string;
  lastChangedAt: string;
  lastChangedBy: string;
};

// ============================================================================
// EVENT LOGS
// ============================================================================

export type EventLog = {
  id: string;
  intentId: string;
  seq: number;
  eventType: string;
  payloadCanonicalJson: string;
  prevHash: string | null;
  eventHash: string;
  correlationId?: string;
  requestId?: string;
  createdByUserId: string;
  createdAt: string;
};

// ============================================================================
// AUDIT BUNDLES
// ============================================================================

export type AuditBundle = {
  id: string;
  intentId: string;
  mode?: "full" | "redacted" | string;
  bundleHash: string;
  chainHash?: string | null;
  manifestCanonicalJson: string;
  manifestSignature: string;
  signerKeyId: string;
  storageRef: string;
  createdAt: string;
};

// ============================================================================
// SERVICE HEALTH
// ============================================================================

export type ServiceHealthStatus = "healthy" | "degraded" | "down";

export type ServiceHealth = {
  voiceService: ServiceHealthStatus;
  phoneService: ServiceHealthStatus;
  storageService: ServiceHealthStatus;
};

// ============================================================================
// STATE MACHINES
// ============================================================================

export type ChallengeStatus = 
  | "idle"
  | "requesting_mic"
  | "recording"
  | "verifying"
  | "verified"
  | "error";

export type PhoneCallStatus =
  | "idle"
  | "calling"
  | "connected"
  | "listening"
  | "verifying"
  | "done"
  | "error";

// ============================================================================
// USER & ORG
// ============================================================================

export type Org = {
  id: string;
  name: string;
  createdAt: string;
};

export type OrgUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  voiceEnrolled?: boolean;
  enrolledAt?: string;
  lastActivityAt?: string;
  createdAt?: string;
};

// ============================================================================
// ADMIN DASHBOARD METRICS
// ============================================================================

export type AdminDashboardMetrics = {
  // Newer dashboard shape (used by WireAdminDashboardPage + mockData)
  financial?: {
    totalVolume30d: number;
    totalVolume7d: number;
    totalVolumeToday: number;
    fraudPrevented: number;
    averageTransferSize: number;
    railsDistribution: {
      wire: number;
      ach: number;
    };
  };
  risk?: {
    averageRiskScore: number;
    riskScoreDistribution: Array<{ range: string; count: number }>;
    highRiskIntents: { over60: number; over85: number };
    riskTrends: Array<{ date: string; avgScore: number }>;
  };
  users?: {
    totalActive: number;
    byRole: Record<string, number>;
    voiceEnrollmentRate: number;
    activeLast24h: number;
    needsEnrollment: number;
  };
  approvals?: {
    approvalRate: number;
    averageApprovalTimeMinutes: number;
    dualApprovalRate: number;
    pendingCount: number;
  };
  fraudPrevention?: {
    attemptsBlocked: number;
    spoofDetectionCount: number;
    coercionDetectionCount: number;
    challengeSuccessRate: number;
    failedChallengeRate: number;
  };

  // Legacy/alternate shape (kept optional for compatibility)
  overview?: {
    totalIntents: number;
    recentIntents: number;
    weeklyIntents: number;
    totalAmountMinor: string;
    avgRiskScore: number;
    totalUsers: number;
    activeUsers: number;
    totalBeneficiaries: number;
  };
  intentsByStatus?: Record<string, number>;
  voiceMetrics?: {
    totalProofs: number;
    successfulProofs: number;
    successRate: number;
  };
  approvalMetrics?: {
    totalDecisions: number;
    approvedDecisions: number;
    approvalRate: number;
  };
  executionMetrics?: {
    totalExecutions: number;
  };
  recentActivity?: Array<{
    id: string;
    status: string;
    amountMinor: string;
    currency: string;
    railsType: string;
    createdAt: string;
    createdByUserId: string;
  }>;
  generatedAt?: string;
};
