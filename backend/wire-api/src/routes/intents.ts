/**
 * Intent Routes
 * 
 * All intent management endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, authorize } from '../auth/middleware';
import { intentService } from '../services/intentService';
import { rateLimiters } from '../auth/rateLimit';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createIntentSchema = z.object({
  railsType: z.enum(['ACH', 'WIRE']),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3).default('USD'),
  beneficiaryId: z.string().uuid(),
  purpose: z.string().min(1).max(1000),
});

const updateIntentSchema = z.object({
  purpose: z.string().min(1).max(1000).optional(),
  beneficiaryId: z.string().uuid().optional(),
});

/**
 * GET /api/intents
 * List intents with filtering
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;
      const beneficiaryId = req.query.beneficiaryId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await intentService.listIntents(req.orgId!, {
        status: status as any,
        userId: userId || req.userId,
        beneficiaryId,
        limit,
        offset,
      });

      res.json({
        intents: result.intents,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error('List intents error', { error });
      res.status(500).json({ error: 'Failed to list intents' });
    }
  }
);

/**
 * GET /api/intents/:id
 * Get intent by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const intent = await intentService.getIntent(req.params.id, req.orgId!);

    if (!intent) {
      res.status(404).json({ error: 'Intent not found' });
      return;
    }

    // Check permissions (user can only see intents from their org)
    if (intent.org_id !== req.orgId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(intent);
  } catch (error) {
    logger.error('Get intent error', { error });
    res.status(500).json({ error: 'Failed to get intent' });
  }
});

/**
 * POST /api/intents
 * Create new intent
 */
router.post(
  '/',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  rateLimiters.api,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = createIntentSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const input = validationResult.data;

      const intent = await intentService.createIntent(req.userId!, req.orgId!, input);

      res.status(201).json(intent);
    } catch (error: any) {
      logger.error('Create intent error', { error });
      res.status(400).json({ error: error.message || 'Failed to create intent' });
    }
  }
);

/**
 * PATCH /api/intents/:id
 * Update intent (only DRAFT status)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = updateIntentSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const input = validationResult.data;

      const intent = await intentService.updateIntent(
        req.params.id,
        req.orgId!,
        req.userId!,
        input
      );

      res.json(intent);
    } catch (error: any) {
      logger.error('Update intent error', { error });
      res.status(400).json({ error: error.message || 'Failed to update intent' });
    }
  }
);

/**
 * DELETE /api/intents/:id
 * Delete intent (only DRAFT status)
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await intentService.deleteIntent(req.params.id, req.orgId!, req.userId!);

    res.json({ message: 'Intent deleted successfully' });
  } catch (error: any) {
    logger.error('Delete intent error', { error });
    res.status(400).json({ error: error.message || 'Failed to delete intent' });
  }
});

/**
 * POST /api/intents/:id/submit
 * Submit intent for approval
 */
router.post(
  '/:id/submit',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const intent = await intentService.submitIntent(
        req.params.id,
        req.orgId!,
        req.userId!
      );

      res.json(intent);
    } catch (error: any) {
      logger.error('Submit intent error', { error });
      res.status(400).json({ error: error.message || 'Failed to submit intent' });
    }
  }
);

/**
 * POST /api/intents/:id/cancel
 * Cancel intent
 */
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const intent = await intentService.cancelIntent(
      req.params.id,
      req.orgId!,
      req.userId!
    );

    res.json(intent);
  } catch (error: any) {
    logger.error('Cancel intent error', { error });
    res.status(400).json({ error: error.message || 'Failed to cancel intent' });
  }
});

/**
 * GET /api/intents/:id/risk-assessment
 * Get risk assessment for intent
 */
router.get(
  '/:id/risk-assessment',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const assessment = await intentService.getRiskAssessment(
        req.params.id,
        req.orgId!
      );

      res.json(assessment);
    } catch (error: any) {
      logger.error('Get risk assessment error', { error });
      res.status(400).json({ error: error.message || 'Failed to get risk assessment' });
    }
  }
);

/**
 * GET /api/intents/:id/approval-history
 * Get approval history for intent
 */
router.get(
  '/:id/approval-history',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { approvalService } = require('../services/approvalService');
      const history = await approvalService.getApprovalHistory(
        req.params.id,
        req.orgId!
      );

      res.json({ approvals: history });
    } catch (error: any) {
      logger.error('Get approval history error', { error });
      res.status(400).json({ error: error.message || 'Failed to get approval history' });
    }
  }
);

export default router;
