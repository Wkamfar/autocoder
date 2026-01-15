/**
 * Audit Service
 * 
 * Core business logic for audit trail management
 * Provides immutable, cryptographically signed audit logs
 */

import { getDatabase } from '../db/connection';
import { logger } from '../utils/logger';
import { signAuditLog, verifyAuditLogSignature, calculateLogHash } from './auditSigning';

export interface AuditLog {
  id: string;
  org_id: string;
  action: string;
  actor_user_id?: string;
  entity_type?: string;
  entity_id?: string;
  details_json: any;
  ip_address?: string;
  user_agent?: string;
  previous_hash?: string;
  log_hash: string;
  signature: string;
  created_at: Date;
}

export interface CreateAuditLogInput {
  orgId: string;
  action: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  /**
   * Create audit log
   */
  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
    const db = getDatabase();

    // Get previous log hash (for chain integrity)
    const previousLog = await this.getLatestAuditLog(input.orgId);
    const previousHash = previousLog?.log_hash || null;

    // Calculate log hash
    const logHash = await calculateLogHash({
      action: input.action,
      actorId: input.actorUserId,
      details: input.details,
      previousHash,
      timestamp: new Date(),
    });

    // Sign log
    const signature = await signAuditLog(logHash);

    // Create audit log
    const result = await db.query(
      `INSERT INTO audit_logs (
        id, org_id, action, actor_user_id, entity_type, entity_id,
        details_json, ip_address, user_agent, previous_hash,
        log_hash, signature, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
      ) RETURNING *`,
      [
        input.orgId,
        input.action,
        input.actorUserId || null,
        input.entityType || null,
        input.entityId || null,
        JSON.stringify(input.details),
        input.ipAddress || null,
        input.userAgent || null,
        previousHash,
        logHash,
        signature,
      ]
    );

    const auditLog = result.rows[0];

    logger.info('Audit log created', {
      auditLogId: auditLog.id,
      action: input.action,
      actorUserId: input.actorUserId,
    });

    return auditLog;
  }

  /**
   * Get audit log by ID
   */
  async getAuditLog(logId: string, orgId: string): Promise<AuditLog | null> {
    const db = getDatabase();

    const result = await db.query(
      'SELECT * FROM audit_logs WHERE id = $1 AND org_id = $2',
      [logId, orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const auditLog = result.rows[0];
    
    // Verify signature
    const isValid = await verifyAuditLogSignature(auditLog.log_hash, auditLog.signature);
    if (!isValid) {
      logger.warn('Audit log signature verification failed', { logId });
    }

    return auditLog;
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    orgId: string,
    filters: {
      action?: string;
      actorUserId?: string;
      entityType?: string;
      entityId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const db = getDatabase();

    const conditions: string[] = ['org_id = $1'];
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (filters.action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.actorUserId) {
      conditions.push(`actor_user_id = $${paramIndex}`);
      params.push(filters.actorUserId);
      paramIndex++;
    }

    if (filters.entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(filters.entityType);
      paramIndex++;
    }

    if (filters.entityId) {
      conditions.push(`entity_id = $${paramIndex}`);
      params.push(filters.entityId);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get logs
    const logsResult = await db.query(
      `SELECT * FROM audit_logs 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      logs: logsResult.rows,
      total,
    };
  }

  /**
   * Get audit logs for an intent
   */
  async getIntentAuditLogs(intentId: string, orgId: string): Promise<AuditLog[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM audit_logs 
       WHERE org_id = $1 
       AND entity_type = 'intent' 
       AND entity_id = $2
       ORDER BY created_at ASC`,
      [orgId, intentId]
    );

    return result.rows;
  }

  /**
   * Get audit logs for a beneficiary
   */
  async getBeneficiaryAuditLogs(
    beneficiaryId: string,
    orgId: string
  ): Promise<AuditLog[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM audit_logs 
       WHERE org_id = $1 
       AND entity_type = 'beneficiary' 
       AND entity_id = $2
       ORDER BY created_at ASC`,
      [orgId, beneficiaryId]
    );

    return result.rows;
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(userId: string, orgId: string): Promise<AuditLog[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM audit_logs 
       WHERE org_id = $1 
       AND actor_user_id = $2
       ORDER BY created_at DESC
       LIMIT 1000`,
      [orgId, userId]
    );

    return result.rows;
  }

  /**
   * Get latest audit log for organization (for chain integrity)
   */
  private async getLatestAuditLog(orgId: string): Promise<AuditLog | null> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT * FROM audit_logs 
       WHERE org_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Verify audit log chain integrity
   */
  async verifyChainIntegrity(orgId: string): Promise<{
    valid: boolean;
    brokenAt?: string;
    errors: string[];
  }> {
    const db = getDatabase();
    const errors: string[] = [];

    // Get all logs ordered by creation time
    const logs = await db.query(
      `SELECT * FROM audit_logs 
       WHERE org_id = $1 
       ORDER BY created_at ASC`,
      [orgId]
    );

    if (logs.rows.length === 0) {
      return { valid: true, errors: [] };
    }

    // Verify chain
    for (let i = 0; i < logs.rows.length; i++) {
      const log = logs.rows[i];
      const previousLog = i > 0 ? logs.rows[i - 1] : null;

      // Verify signature
      const signatureValid = await verifyAuditLogSignature(log.log_hash, log.signature);
      if (!signatureValid) {
        errors.push(`Invalid signature for log ${log.id}`);
        return {
          valid: false,
          brokenAt: log.id,
          errors,
        };
      }

      // Verify previous hash
      if (previousLog) {
        if (log.previous_hash !== previousLog.log_hash) {
          errors.push(`Hash mismatch at log ${log.id}`);
          return {
            valid: false,
            brokenAt: log.id,
            errors,
          };
        }
      } else {
        // First log should have null previous_hash
        if (log.previous_hash !== null) {
          errors.push(`First log should have null previous_hash`);
          return {
            valid: false,
            brokenAt: log.id,
            errors,
          };
        }
      }
    }

    return { valid: true, errors: [] };
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(
    orgId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      format?: 'json' | 'csv';
    } = {}
  ): Promise<string> {
    const logsResult = await this.getAuditLogs(orgId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: 10000, // Max export size
    });

    if (filters.format === 'csv') {
      return this.exportToCSV(logsResult.logs);
    } else {
      return JSON.stringify(logsResult.logs, null, 2);
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(logs: AuditLog[]): string {
    const headers = [
      'id',
      'created_at',
      'action',
      'actor_user_id',
      'entity_type',
      'entity_id',
      'ip_address',
      'log_hash',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.created_at.toISOString(),
      log.action,
      log.actor_user_id || '',
      log.entity_type || '',
      log.entity_id || '',
      log.ip_address || '',
      log.log_hash,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}

export const auditService = new AuditService();
