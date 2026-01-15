/**
 * Policy Routes
 * 
 * All policy management endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, authorize } from '../auth/middleware';
import { policyService, RiskThresholds, ApprovalRules } from '../services/policyService';
import { rateLimiters } from '../auth/rateLimit';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createPolicySchema = z.object({
  name: z.string().min(1).max(255),
  rules: z.any().optional(),
  riskThresholds: z.object({
    very_low: z.number().min(0).max(100),
    low: z.number().min(0).max(100),
    medium: z.number().min(0).max(100),
    high: z.number().min(0).max(100),
    critical: z.number().min(0).max(100),
  }),
  approvalRules: z.object({
    required_approvals: z.record(z.string(), z.number().min(0)),
    challenge_levels: z.record(z.string(), z.enum(['L1', 'L2', 'L3'])),
    auto_approve: z.object({
      enabled: z.boolean(),
      max_amount: z.number().optional(),
      max_risk_score: z.number().optional(),
    }).optional(),
  }),
});

const updatePolicySchema = z.object({
  rules: z.any().optional(),
  riskThresholds: z.object({
    very_low: z.number().min(0).max(100),
    low: z.number().min(0).max(100),
    medium: z.number().min(0).max(100),
    high: z.number().min(0).max(100),
    critical: z.number().min(0).max(100),
  }).optional(),
  approvalRules: z.object({
    required_approvals: z.record(z.string(), z.number().min(0)),
    challenge_levels: z.record(z.string(), z.enum(['L1', 'L2', 'L3'])),
    auto_approve: z.object({
      enabled: z.boolean(),
      max_amount: z.number().optional(),
      max_risk_score: z.number().optional(),
    }).optional(),
  }).optional(),
});

const evaluatePolicySchema = z.object({
  riskScore: z.number().min(0).max(100),
  intentData: z.any(),
});

/**
 * GET /api/policies
 * List policies
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const policies = await policyService.getPolicies(req.orgId!, activeOnly);

    res.json({ policies });
  } catch (error) {
    logger.error('List policies error', { error });
    res.status(500).json({ error: 'Failed to list policies' });
  }
});

/**
 * GET /api/policies/:id
 * Get policy by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policy = await policyService.getPolicy(req.params.id, req.orgId!);

    if (!policy) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    res.json(policy);
  } catch (error) {
    logger.error('Get policy error', { error });
    res.status(500).json({ error: 'Failed to get policy' });
  }
});

/**
 * POST /api/policies
 * Create new policy
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  rateLimiters.api,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = createPolicySchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const { name, rules, riskThresholds, approvalRules } = validationResult.data;

      const policy = await policyService.createPolicy(
        req.orgId!,
        req.userId!,
        name,
        rules,
        riskThresholds,
        approvalRules
      );

      res.status(201).json(policy);
    } catch (error: any) {
      logger.error('Create policy error', { error });
      res.status(400).json({ error: error.message || 'Failed to create policy' });
    }
  }
);

/**
 * PATCH /api/policies/:id
 * Update policy (creates new version)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = updatePolicySchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: validationResult.error.errors,
        });
        return;
      }

      const updates: any = {};
      if (validationResult.data.rules !== undefined) {
        updates.rules = validationResult.data.rules;
      }
      if (validationResult.data.riskThresholds !== undefined) {
        updates.riskThresholds = validationResult.data.riskThresholds;
      }
      if (validationResult.data.approvalRules !== undefined) {
        updates.approvalRules = validationResult.data.approvalRules;
      }

      const policy = await policyService.updatePolicy(
        req.params.id,
        req.orgId!,
        req.userId!,
        updates
      );

      res.json(policy);
    } catch (error: any) {
      logger.error('Update policy error', { error });
      res.status(400).json({ error: error.message || 'Failed to update policy' });
    }
  }
);

/**
 * GET /api/policies/:id/versions
 * Get all versions of a policy
 */
router.get(
  '/:id/versions',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const versions = await policyService.getPolicyVersions(req.params.id, req.orgId!);

      res.json({ versions });
    } catch (error: any) {
      logger.error('Get policy versions error', { error });
      res.status(400).json({ error: error.message || 'Failed to get policy versions' });
    }
  }
);

/**
 * POST /api/policies/:id/activate-version
 * Activate policy version
 */
router.post(
  '/:id/activate-version',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const policy = await policyService.activatePolicyVersion(
        req.params.id,
        req.orgId!,
        req.userId!
      );

      res.json(policy);
    } catch (error: any) {
      logger.error('Activate policy version error', { error });
      res.status(400).json({ error: error.message || 'Failed to activate policy version' });
    }
  }
);

/**
 * GET /api/policies/evaluate
 * Evaluate policy for an intent
 */
router.get(
  '/evaluate',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const riskScore = parseFloat(req.query.riskScore as string);
      const intentData = req.query.intentData
        ? JSON.parse(req.query.intentData as string)
        : {};

      if (isNaN(riskScore) || riskScore < 0 || riskScore > 100) {
        res.status(400).json({ error: 'Invalid risk score' });
        return;
      }

      const evaluation = await policyService.evaluatePolicy(
        req.orgId!,
        riskScore,
        intentData
      );

      res.json(evaluation);
    } catch (error: any) {
      logger.error('Evaluate policy error', { error });
      res.status(400).json({ error: error.message || 'Failed to evaluate policy' });
    }
  }
);

export default router;
