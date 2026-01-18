export type ConfirmationSessionState =
  | "pending"
  | "voice_required"
  | "awaiting_confirmation"
  | "ready_to_send"
  | "executing"
  | "sent"
  | "cancelled"
  | "expired"
  | "locked"
  | "failed";

export type DeviceTrustLevel = "trusted" | "new" | "unknown";

export type ConfirmationSession = {
  id: string;
  orgId: string;
  userId: string;
  intentId: string;
  challengeId: string | null;
  challengePhrase: string | null;
  challengePhraseDisplay: string | null;
  clientConfirmationId: string;
  deviceTrustLevel: DeviceTrustLevel;
  isNewDevice: boolean;
  sessionContinuityHash: string | null;
  state: ConfirmationSessionState;
  voiceRetryAttempted: boolean;
  transferId?: string | null;
  lockReason?: string | null;
  policyOutcome?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type CreateConfirmationSessionRequest = {
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  purpose?: string;
  clientConfirmationId: string;
  deviceFingerprint?: string;
};

export type CreateConfirmationSessionResponse =
  | {
      sessionId: string;
      challengeId: string;
      challengePhrase: string;
      challengePhraseDisplay: string;
      intentId: string;
      expiresAt: string;
      state: "voice_required";
      policyOutcome?: string;
    }
  | {
      status: "failed";
      error: string;
    };

export type SubmitVoiceRequest = {
  audioBuffer: string;
  transcript?: string;
  deviceFingerprint?: string;
};

export type SubmitVoiceResponse =
  | {
      status: "sent";
      transferId: string;
      intentId: string;
      sentAt: string;
    }
  | {
      status: "awaiting_confirmation";
      intentId: string;
      message: string;
    }
  | {
      status: "ready_to_send";
      intentId: string;
      message: string;
      estimatedSendAt?: string;
    }
  | {
      status: "voice_required";
      error: string;
      challengePhrase: string;
    }
  | {
      status: "locked";
      intentId: string;
      message: string;
    }
  | {
      status: "failed";
      error: string;
    };

export type GetSessionResponse = {
  status: ConfirmationSessionState;
  transferId?: string;
  intentId: string;
  message?: string;
  policyOutcome?: string;
  expiresAt?: string;
};

export type CancelSessionResponse =
  | {
      status: "cancelled";
      intentId: string;
      cancelledAt: string;
      message: string;
    }
  | {
      status: "failed";
      error: string;
    };
