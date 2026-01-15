/**
 * Standardized error response format for all API endpoints.
 * 
 * All errors should follow this format:
 * {
 *   error: string;        // Human-readable message
 *   code?: string;        // Machine-parseable error code
 *   details?: object;     // Additional context
 * }
 */

export type ErrorCode =
  | "INVALID_REQUEST"
  | "MISSING_APPROVAL_TOKEN"
  | "INTENT_NOT_FOUND"
  | "BENEFICIARY_NOT_FOUND"
  | "POLICY_NOT_CONFIGURED"
  | "PERMISSION_DENIED"
  | "INTERNAL_ERROR"
  | "INTENT_INVALID_STATUS"
  | "INTENT_IN_COOLDOWN"
  | "CHALLENGE_NOT_FOUND"
  | "APPROVAL_TOKEN_INVALID"
  | "APPROVAL_TOKEN_EXPIRED"
  | "APPROVAL_TOKEN_CONSUMED"
  | "BINDING_HASH_MISMATCH";

export interface ErrorResponse {
  error: string;
  code?: ErrorCode;
  details?: Record<string, unknown>;
}

/**
 * Creates a standardized error response.
 */
export function createErrorResponse(
  message: string,
  code?: ErrorCode,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    error: message,
    ...(code && { code }),
    ...(details && { details }),
  };
}

/**
 * Common error responses.
 */
export const Errors = {
  invalidRequest: (message: string, details?: Record<string, unknown>) =>
    createErrorResponse(message, "INVALID_REQUEST", details),

  missingApprovalToken: () =>
    createErrorResponse("Missing X-POSE-APPROVAL header", "MISSING_APPROVAL_TOKEN"),

  intentNotFound: () =>
    createErrorResponse("Intent not found", "INTENT_NOT_FOUND"),

  beneficiaryNotFound: () =>
    createErrorResponse("Beneficiary not found", "BENEFICIARY_NOT_FOUND"),

  policyNotConfigured: () =>
    createErrorResponse("No policy configured", "POLICY_NOT_CONFIGURED"),

  permissionDenied: (permission?: string) =>
    createErrorResponse(
      permission ? `Permission denied: ${permission}` : "Permission denied",
      "PERMISSION_DENIED",
      permission ? { requiredPermission: permission } : undefined
    ),

  intentInvalidStatus: (currentStatus: string, allowedStatuses?: string[]) =>
    createErrorResponse(
      `Intent not in required status (current: ${currentStatus})`,
      "INTENT_INVALID_STATUS",
      { currentStatus, allowedStatuses }
    ),

  intentInCooldown: (cooldownUntil: string) =>
    createErrorResponse("Intent is in cooldown", "INTENT_IN_COOLDOWN", { cooldownUntil }),

  internalError: (message?: string) =>
    createErrorResponse(message || "Internal server error", "INTERNAL_ERROR"),
};
