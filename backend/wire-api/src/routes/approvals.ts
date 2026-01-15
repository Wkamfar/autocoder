/**
 * Approval Routes
 * 
 * All approval workflow endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, authorize } from '../auth/middleware';
import { approvalService } from '../services/approvalService';
import { rateLimiters } from '../auth/rateLimit';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const approveIntentSchema = z.object({
  voiceProofId: z.string().uuid(),
});

const denyIntentSchema = z.object({
  reasonCodes: z.array(z.string()).min(1),
});

/**
 * GET /api/approvals/pending
 * Get pending approvals for current user
 */
router.get('/pending', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const approvals = await approvalService.getPendingApprovals(
      req.userId!,
      req.orgId!
    );

    res.json({ approvals });
  } catch (error) {
    logger.error('Get pending approvals error', { error });
    res.status(500).json({ error: 'Failed to get pending approvals' });
  }
});

/**
 * GET /api/approvals/:id
 * Get approval by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const approval = await approvalService.getApproval(req.params.id, req.orgId!);

    if (!approval) {
      res.status(404).json({ error: 'Approval not found' });
      return;
    }

    res.json(approval);
  } catch (error) {
    logger.error('Get approval error', { error });
    res.status(500).json({ error: 'Failed to get approval' });
  }
});

/**
 * POST /api/approvals/:id/approve
 * Approve intent
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize('APPROVER', 'ADMIN'),
  rateLimiters.api,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = approveIntentSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const { voiceProofId } = validationResult.data;

      const approval = await approvalService.approveIntent(
        req.params.id,
        req.userId!,
        voiceProofId,
        req.orgId!
      );

      res.json(approval);
    } catch (error: any) {
      logger.error('Approve intent error', { error });
      res.status(400).json({ error: error.message || 'Failed to approve intent' });
    }
  }
);

/**
 * POST /api/approvals/:id/deny
 * Deny intent
 */
router.post(
  '/:id/deny',
  authenticate,
  authorize('APPROVER', 'ADMIN'),
  rateLimiters.api,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = denyIntentSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const { reasonCodes } = validationResult.data;

      const approval = await approvalService.denyIntent(
        req.params.id,
        req.userId!,
        reasonCodes,
        req.orgId!
      );

      res.json(approval);
    } catch (error: any) {
      logger.error('Deny intent error', { error });
      res.status(400).json({ error: error.message || 'Failed to deny intent' });
    }
  }
);

/**
 * POST /api/approvals/:id/request-voice-challenge
 * Request voice challenge for approval
 */
router.post(
  '/:id/request-voice-challenge',
  authenticate,
  authorize('APPROVER', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const challenge = await approvalService.requestVoiceChallenge(
        req.params.id,
        req.userId!,
        req.orgId!
      );

      res.json(challenge);
    } catch (error: any) {
      logger.error('Request voice challenge error', { error });
      res.status(400).json({ error: error.message || 'Failed to request voice challenge' });
    }
  }
);

/**
 * GET /api/approvals/:id/status
 * Get approval status
 */
router.get('/:id/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const approval = await approvalService.getApproval(req.params.id, req.orgId!);

    if (!approval) {
      res.status(404).json({ error: 'Approval not found' });
      return;
    }

    const status = await approvalService.getApprovalStatus(approval.intent_id, req.orgId!);

    res.json(status);
  } catch (error: any) {
    logger.error('Get approval status error', { error });
    res.status(400).json({ error: error.message || 'Failed to get approval status' });
  }
});

export default router;
