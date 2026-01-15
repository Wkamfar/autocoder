/**
 * Beneficiary Routes
 * 
 * All beneficiary management endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, authorize } from '../auth/middleware';
import { beneficiaryService } from '../services/beneficiaryService';
import { rateLimiters } from '../auth/rateLimit';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createBeneficiarySchema = z.object({
  displayName: z.string().min(1).max(255),
  country: z.string().length(2),
  railsAllowed: z.array(z.enum(['ACH', 'WIRE'])).min(1),
  bankRoutingNumber: z.string().min(4).max(20),
  bankAccountNumber: z.string().min(4).max(17),
  accountType: z.string(),
});

const updateBeneficiarySchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  bankRoutingNumber: z.string().min(4).max(20).optional(),
  bankAccountNumber: z.string().min(4).max(17).optional(),
  accountType: z.string().optional(),
});

const verifyMicroDepositsSchema = z.object({
  amount1: z.number().positive(),
  amount2: z.number().positive(),
});

/**
 * GET /api/beneficiaries
 * List beneficiaries with filtering
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const status = req.query.status as string | undefined;
      const railsAllowed = req.query.railsAllowed as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await beneficiaryService.listBeneficiaries(req.orgId!, {
        status: status as any,
        railsAllowed: railsAllowed as any,
        limit,
        offset,
      });

      res.json({
        beneficiaries: result.beneficiaries,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error('List beneficiaries error', { error });
      res.status(500).json({ error: 'Failed to list beneficiaries' });
    }
  }
);

/**
 * GET /api/beneficiaries/:id
 * Get beneficiary by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const beneficiary = await beneficiaryService.getBeneficiary(
      req.params.id,
      req.orgId!
    );

    if (!beneficiary) {
      res.status(404).json({ error: 'Beneficiary not found' });
      return;
    }

    res.json(beneficiary);
  } catch (error) {
    logger.error('Get beneficiary error', { error });
    res.status(500).json({ error: 'Failed to get beneficiary' });
  }
});

/**
 * POST /api/beneficiaries
 * Create new beneficiary
 */
router.post(
  '/',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  rateLimiters.api,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = createBeneficiarySchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const input = validationResult.data;

      const beneficiary = await beneficiaryService.createBeneficiary(
        req.userId!,
        req.orgId!,
        input
      );

      res.status(201).json(beneficiary);
    } catch (error: any) {
      logger.error('Create beneficiary error', { error });
      res.status(400).json({ error: error.message || 'Failed to create beneficiary' });
    }
  }
);

/**
 * PATCH /api/beneficiaries/:id
 * Update beneficiary
 */
router.patch(
  '/:id',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = updateBeneficiarySchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const input = validationResult.data;

      const beneficiary = await beneficiaryService.updateBeneficiary(
        req.params.id,
        req.orgId!,
        req.userId!,
        input
      );

      res.json(beneficiary);
    } catch (error: any) {
      logger.error('Update beneficiary error', { error });
      res.status(400).json({ error: error.message || 'Failed to update beneficiary' });
    }
  }
);

/**
 * DELETE /api/beneficiaries/:id
 * Delete beneficiary
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await beneficiaryService.deleteBeneficiary(req.params.id, req.orgId!);

    res.json({ message: 'Beneficiary deleted successfully' });
  } catch (error: any) {
    logger.error('Delete beneficiary error', { error });
    res.status(400).json({ error: error.message || 'Failed to delete beneficiary' });
  }
});

/**
 * POST /api/beneficiaries/:id/lock
 * Lock beneficiary
 */
router.post(
  '/:id/lock',
  authenticate,
  authorize('ADMIN', 'APPROVER'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const beneficiary = await beneficiaryService.lockBeneficiary(
        req.params.id,
        req.orgId!,
        req.userId!
      );

      res.json(beneficiary);
    } catch (error: any) {
      logger.error('Lock beneficiary error', { error });
      res.status(400).json({ error: error.message || 'Failed to lock beneficiary' });
    }
  }
);

/**
 * POST /api/beneficiaries/:id/unlock
 * Unlock beneficiary
 */
router.post(
  '/:id/unlock',
  authenticate,
  authorize('ADMIN', 'APPROVER'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const beneficiary = await beneficiaryService.unlockBeneficiary(
        req.params.id,
        req.orgId!,
        req.userId!
      );

      res.json(beneficiary);
    } catch (error: any) {
      logger.error('Unlock beneficiary error', { error });
      res.status(400).json({ error: error.message || 'Failed to unlock beneficiary' });
    }
  }
);

/**
 * POST /api/beneficiaries/:id/verify-account
 * Verify bank account (initiates verification process)
 */
router.post(
  '/:id/verify-account',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await beneficiaryService.verifyAccount(
        req.params.id,
        req.orgId!
      );

      res.json(result);
    } catch (error: any) {
      logger.error('Verify account error', { error });
      res.status(400).json({ error: error.message || 'Failed to verify account' });
    }
  }
);

/**
 * POST /api/beneficiaries/:id/micro-deposits
 * Initiate micro-deposits (called automatically by verify-account)
 * This endpoint is for manual re-initiation if needed
 */
router.post(
  '/:id/micro-deposits',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // This is handled by verify-account, but we can expose it separately
      const result = await beneficiaryService.verifyAccount(
        req.params.id,
        req.orgId!
      );

      if (!result.microDepositsInitiated) {
        res.status(400).json({ error: 'Failed to initiate micro-deposits' });
        return;
      }

      res.json({
        message: 'Micro-deposits initiated',
        amounts: result.microDepositAmounts,
      });
    } catch (error: any) {
      logger.error('Initiate micro-deposits error', { error });
      res.status(400).json({ error: error.message || 'Failed to initiate micro-deposits' });
    }
  }
);

/**
 * POST /api/beneficiaries/:id/verify-micro-deposits
 * Verify micro-deposits
 */
router.post(
  '/:id/verify-micro-deposits',
  authenticate,
  authorize('TREASURY_INITIATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = verifyMicroDepositsSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const amounts = validationResult.data;

      const beneficiary = await beneficiaryService.verifyMicroDeposits(
        req.params.id,
        req.orgId!,
        amounts
      );

      res.json(beneficiary);
    } catch (error: any) {
      logger.error('Verify micro-deposits error', { error });
      res.status(400).json({ error: error.message || 'Failed to verify micro-deposits' });
    }
  }
);

/**
 * GET /api/beneficiaries/:id/intelligence
 * Get beneficiary intelligence and statistics
 */
router.get(
  '/:id/intelligence',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const intelligence = await beneficiaryService.getBeneficiaryIntelligence(
        req.params.id,
        req.orgId!
      );

      res.json(intelligence);
    } catch (error: any) {
      logger.error('Get beneficiary intelligence error', { error });
      res.status(400).json({ error: error.message || 'Failed to get beneficiary intelligence' });
    }
  }
);

export default router;
