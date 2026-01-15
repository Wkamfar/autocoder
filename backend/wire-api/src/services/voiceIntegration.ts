/**
 * Voice Service Integration
 * 
 * Integrates with Voice Verification Service
 * Verifies voice proofs for approvals
 */

import { logger } from '../utils/logger';

export interface VoiceProofVerificationResult {
  valid: boolean;
  reason?: string;
  scores?: any;
}

/**
 * Verify voice proof
 * Calls Voice Service API
 */
export async function verifyVoiceProof(
  voiceProofId: string,
  userId: string
): Promise<VoiceProofVerificationResult> {
  try {
    const voiceServiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:8001';
    
    const response = await fetch(`${voiceServiceUrl}/api/voice/proof/${voiceProofId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Voice service returned ${response.status}`);
    }

    const proof = await response.json();
    
    // Verify proof belongs to user
    if (proof.user_id !== userId) {
      return { valid: false, reason: 'Voice proof user mismatch' };
    }

    // Check scores meet thresholds
    const scores = proof.scores_json || {};
    if (scores.identity_confidence < 0.85) {
      return { valid: false, reason: 'Identity confidence too low' };
    }

    if (scores.liveness_score < 0.90) {
      return { valid: false, reason: 'Liveness score too low' };
    }

    if (scores.spoof_risk_score > 0.30) {
      return { valid: false, reason: 'Spoof risk too high' };
    }

    if (scores.coercion_risk_score > 0.25) {
      return { valid: false, reason: 'Coercion risk too high' };
    }

    return {
      valid: true,
      scores: scores,
    };
  } catch (error) {
    logger.error('Voice proof verification failed', { error });
    return {
      valid: false,
      reason: 'Voice verification service error',
    };
  }
}

/**
 * Check if user has voice enrollment
 */
export async function checkVoiceEnrollment(userId: string): Promise<boolean> {
  try {
    const voiceServiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:8001';
    
    const response = await fetch(
      `${voiceServiceUrl}/api/voice/enrollment/${userId}/status`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Fallback to database check
      const { getDatabase } = require('../db/connection');
      const db = getDatabase();
      const result = await db.query(
        'SELECT voice_enrolled FROM users WHERE id = $1',
        [userId]
      );
      return result.rows.length > 0 && result.rows[0].voice_enrolled === true;
    }

    const status = await response.json();
    return status.enrolled === true;
  } catch (error) {
    logger.error('Voice enrollment check failed', { error });
    // Fallback to database check
    try {
      const { getDatabase } = require('../db/connection');
      const db = getDatabase();
      const result = await db.query(
        'SELECT voice_enrolled FROM users WHERE id = $1',
        [userId]
      );
      return result.rows.length > 0 && result.rows[0].voice_enrolled === true;
    } catch (dbError) {
      logger.error('Database fallback check failed', { error: dbError });
      return false;
    }
  }
}
