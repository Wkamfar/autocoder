/**
 * Audit Utility
 * 
 * Helper functions for creating audit logs throughout the application
 */

import { auditService, CreateAuditLogInput } from '../services/auditService';
import { logger } from './logger';

/**
 * Create audit log (convenience function)
 */
export async function auditLog(
  input: Omit<CreateAuditLogInput, 'orgId'> & { orgId: string },
  req?: any
): Promise<void> {
  try {
    await auditService.createAuditLog({
      ...input,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    logger.error('Failed to create audit log', { error, input });
  }
}

/**
 * Audit intent action
 */
export async function auditIntentAction(
  action: string,
  intentId: string,
  actorUserId: string,
  orgId: string,
  details: any = {},
  req?: any
): Promise<void> {
  await auditLog(
    {
      orgId,
      action: `intent.${action}`,
      actorUserId,
      entityType: 'intent',
      entityId: intentId,
      details,
    },
    req
  );
}

/**
 * Audit beneficiary action
 */
export async function auditBeneficiaryAction(
  action: string,
  beneficiaryId: string,
  actorUserId: string,
  orgId: string,
  details: any = {},
  req?: any
): Promise<void> {
  await auditLog(
    {
      orgId,
      action: `beneficiary.${action}`,
      actorUserId,
      entityType: 'beneficiary',
      entityId: beneficiaryId,
      details,
    },
    req
  );
}

/**
 * Audit approval action
 */
export async function auditApprovalAction(
  action: string,
  approvalId: string,
  intentId: string,
  actorUserId: string,
  orgId: string,
  details: any = {},
  req?: any
): Promise<void> {
  await auditLog(
    {
      orgId,
      action: `approval.${action}`,
      actorUserId,
      entityType: 'approval',
      entityId: approvalId,
      details: {
        ...details,
        intent_id: intentId,
      },
    },
    req
  );
}

/**
 * Audit user action
 */
export async function auditUserAction(
  action: string,
  targetUserId: string,
  actorUserId: string,
  orgId: string,
  details: any = {},
  req?: any
): Promise<void> {
  await auditLog(
    {
      orgId,
      action: `user.${action}`,
      actorUserId,
      entityType: 'user',
      entityId: targetUserId,
      details,
    },
    req
  );
}

/**
 * Audit policy action
 */
export async function auditPolicyAction(
  action: string,
  policyId: string,
  actorUserId: string,
  orgId: string,
  details: any = {},
  req?: any
): Promise<void> {
  await auditLog(
    {
      orgId,
      action: `policy.${action}`,
      actorUserId,
      entityType: 'policy',
      entityId: policyId,
      details,
    },
    req
  );
}
