export const JOB_TYPES = {
  WEBHOOK_DELIVERY: "webhook.delivery",
  EMAIL_SEND: "email.send",
  EVIDENCE_BUNDLE_GENERATE: "evidence.bundle.generate",
  PROVIDER_EVENT_PROCESS: "provider_event.process",
  PLAID_TRANSFER_EVENT_SYNC: "plaid.transfer_event.sync",
  // Agent 11: anchor intent events onto POSE chain (via POSE Core HTTP tx submitter)
  POSE_ANCHOR_INTENT_EVENT: "pose.anchor_intent_event",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export type WebhookDeliveryJobPayload = {
  deliveryId: string;
  orgId: string;
};

export type EmailSendJobPayload = {
  to: string;
  templateType: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  variables?: Record<string, string>;
  orgId?: string;
  userId?: string;
};

export type EvidenceBundleGenerateJobPayload = {
  orgId: string;
  userId: string;
  intentId: string;
  mode: "full" | "redacted";
};

export type ProviderEventProcessJobPayload = {
  providerEventId: string;
  orgId: string;
};

export type PlaidTransferEventSyncJobPayload = {
  orgId: string;
  // Optional: the ProviderEvent that triggered this sync (used for dedupe/audit)
  triggerProviderEventId?: string;
};

export type PoseAnchorIntentEventJobPayload = {
  orgId: string;
  intentId: string;
  seq: number;
  eventType?: string;
  eventHash: string;
  prevEventHash: string | null;
  requestId?: string | null;
  traceId?: string | null;
};

export type JobPayloadByType = {
  [JOB_TYPES.WEBHOOK_DELIVERY]: WebhookDeliveryJobPayload;
  [JOB_TYPES.EMAIL_SEND]: EmailSendJobPayload;
  [JOB_TYPES.EVIDENCE_BUNDLE_GENERATE]: EvidenceBundleGenerateJobPayload;
  [JOB_TYPES.PROVIDER_EVENT_PROCESS]: ProviderEventProcessJobPayload;
  [JOB_TYPES.PLAID_TRANSFER_EVENT_SYNC]: PlaidTransferEventSyncJobPayload;
  [JOB_TYPES.POSE_ANCHOR_INTENT_EVENT]: PoseAnchorIntentEventJobPayload;
};

