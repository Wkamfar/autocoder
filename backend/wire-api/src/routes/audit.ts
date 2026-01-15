/**
 * Audit Routes
 * 
 * All audit trail endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, authorize } from '../auth/middleware';
import { auditService } from '../services/auditService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/audit/logs
 * Get audit logs with filtering
 */
router.get('/logs', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filters: any = {};

    if (req.query.action) {
      filters.action = req.query.action as string;
    }

    if (req.query.actorUserId) {
      filters.actorUserId = req.query.actorUserId as string;
    }

    if (req.query.entityType) {
      filters.entityType = req.query.entityType as string;
    }

    if (req.query.entityId) {
      filters.entityId = req.query.entityId as string;
    }

    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    filters.limit = limit;
    filters.offset = offset;

    const result = await auditService.getAuditLogs(req.orgId!, filters);

    res.json({
      logs: result.logs,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Get audit logs error', { error });
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

/**
 * GET /api/audit/logs/:id
 * Get audit log by ID
 */
router.get('/logs/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const log = await auditService.getAuditLog(req.params.id, req.orgId!);

    if (!log) {
      res.status(404).json({ error: 'Audit log not found' });
      return;
    }

    res.json(log);
  } catch (error) {
    logger.error('Get audit log error', { error });
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

/**
 * GET /api/audit/intent/:intentId
 * Get audit logs for an intent
 */
router.get(
  '/intent/:intentId',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const logs = await auditService.getIntentAuditLogs(
        req.params.intentId,
        req.orgId!
      );

      res.json({ logs });
    } catch (error) {
      logger.error('Get intent audit logs error', { error });
      res.status(500).json({ error: 'Failed to get intent audit logs' });
    }
  }
);

/**
 * GET /api/audit/beneficiary/:beneficiaryId
 * Get audit logs for a beneficiary
 */
router.get(
  '/beneficiary/:beneficiaryId',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const logs = await auditService.getBeneficiaryAuditLogs(
        req.params.beneficiaryId,
        req.orgId!
      );

      res.json({ logs });
    } catch (error) {
      logger.error('Get beneficiary audit logs error', { error });
      res.status(500).json({ error: 'Failed to get beneficiary audit logs' });
    }
  }
);

/**
 * GET /api/audit/user/:userId
 * Get audit logs for a user
 */
router.get(
  '/user/:userId',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const logs = await auditService.getUserAuditLogs(
        req.params.userId,
        req.orgId!
      );

      res.json({ logs });
    } catch (error) {
      logger.error('Get user audit logs error', { error });
      res.status(500).json({ error: 'Failed to get user audit logs' });
    }
  }
);

/**
 * POST /api/audit/export
 * Export audit logs
 */
router.post(
  '/export',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const filters: any = {};

      if (req.body.startDate) {
        filters.startDate = new Date(req.body.startDate);
      }

      if (req.body.endDate) {
        filters.endDate = new Date(req.body.endDate);
      }

      filters.format = req.body.format || 'json';

      const exportData = await auditService.exportAuditLogs(req.orgId!, filters);

      const contentType =
        filters.format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `audit-logs-${new Date().toISOString()}.${filters.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      logger.error('Export audit logs error', { error });
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }
);

/**
 * GET /api/audit/verify
 * Verify audit log chain integrity
 */
router.get(
  '/verify',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await auditService.verifyChainIntegrity(req.orgId!);

      res.json(result);
    } catch (error) {
      logger.error('Verify audit chain error', { error });
      res.status(500).json({ error: 'Failed to verify audit chain' });
    }
  }
);

export default router;
