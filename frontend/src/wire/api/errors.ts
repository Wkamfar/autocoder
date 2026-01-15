export type WireErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "INTENT_NOT_FOUND"
  | "INTENT_INVALID_STATUS"
  | "INTENT_IN_COOLDOWN"
  | "CHALLENGE_NOT_FOUND"
  | "BENEFICIARY_NOT_FOUND"
  | "POLICY_NOT_CONFIGURED"
  | "MISSING_APPROVAL_TOKEN"
  | "APPROVAL_TOKEN_INVALID"
  | "APPROVAL_TOKEN_EXPIRED"
  | "APPROVAL_TOKEN_CONSUMED"
  | "BINDING_HASH_MISMATCH"
  | string;

export type WireErrorPayload = {
  error?: string;
  code?: WireErrorCode;
  details?: any;
  correlationId?: string;
};

export class WireApiError extends Error {
  readonly status: number;
  readonly code?: WireErrorCode;
  readonly details?: any;
  readonly correlationId?: string;

  constructor(params: { message: string; status: number; code?: WireErrorCode; details?: any; correlationId?: string }) {
    super(params.message);
    this.name = "WireApiError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.correlationId = params.correlationId;
  }
}

const CODE_TO_MESSAGE: Record<string, string> = {
  AUTH_REQUIRED: "Sign in to continue.",
  PERMISSION_DENIED: "You don’t have permission to perform this action.",
  INVALID_REQUEST: "That request wasn’t valid. Please check your inputs and try again.",
  NOT_FOUND: "That resource could not be found.",
  INTERNAL_ERROR: "The service hit an internal error. Please retry.",
  INTENT_NOT_FOUND: "This transfer intent could not be found.",
  INTENT_INVALID_STATUS: "This intent is not in a valid state for that action.",
  INTENT_IN_COOLDOWN: "This intent is in cooldown. Please wait and try again.",
  CHALLENGE_NOT_FOUND: "That voice challenge no longer exists. Please start a new challenge.",
  BENEFICIARY_NOT_FOUND: "That beneficiary could not be found.",
  POLICY_NOT_CONFIGURED: "Policy is not configured yet. Ask an admin to configure policy.",
  MISSING_APPROVAL_TOKEN: "Missing approval token. Request a new token and try again.",
  APPROVAL_TOKEN_INVALID: "That approval token is invalid. Request a new token and try again.",
  APPROVAL_TOKEN_EXPIRED: "That approval token expired. Request a new token and try again.",
  APPROVAL_TOKEN_CONSUMED: "That approval token was already used. Request a new token and try again.",
  BINDING_HASH_MISMATCH: "This intent changed after approval. Re-approve the updated intent.",
};

export function messageForWireError(payload: WireErrorPayload, fallbackStatusText?: string): string {
  const code = payload.code;
  if (code && CODE_TO_MESSAGE[code]) return CODE_TO_MESSAGE[code]!;
  if (payload.error && typeof payload.error === "string" && payload.error.trim().length > 0) return payload.error;
  return fallbackStatusText ? `Request failed: ${fallbackStatusText}` : "Request failed.";
}

export async function parseWireErrorResponse(res: Response): Promise<WireApiError> {
  let payload: WireErrorPayload = {};
  try {
    payload = (await res.json()) as WireErrorPayload;
  } catch {
    payload = {};
  }

  const message = messageForWireError(payload, res.statusText);
  return new WireApiError({
    message,
    status: res.status,
    code: payload.code,
    details: payload.details,
    correlationId: payload.correlationId,
  });
}

export function isWireApiError(err: unknown): err is WireApiError {
  return err instanceof WireApiError || (err instanceof Error && err.name === "WireApiError");
}

