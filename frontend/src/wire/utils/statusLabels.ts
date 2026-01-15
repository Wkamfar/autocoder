import type { IntentStatus, RequestStatus } from "../types/wire";

export const INTENT_STATUS_LABEL: Record<IntentStatus, string> = {
  DRAFT: "Draft",
  PENDING_PROOF: "Verification required",
  CHALLENGING: "Verifying",
  PENDING_APPROVALS: "Awaiting approvals",
  APPROVED: "Approved",
  DENIED: "Denied",
  EXECUTED: "Executed",
  EXPIRED: "Expired",
  CANCELED: "Canceled",
};

export function intentStatusLabel(status: IntentStatus): string {
  return INTENT_STATUS_LABEL[status];
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: "Draft",
  PENDING_VERIFICATION: "Verification required",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  DENIED: "Denied",
  PAID: "Paid",
  EXPIRED: "Expired",
};

export function requestStatusLabel(status: RequestStatus): string {
  return REQUEST_STATUS_LABEL[status];
}

