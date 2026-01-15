/**
 * Cooldown Service
 * 
 * Enforces cooldown periods for high-risk intents
 * Prevents rapid-fire high-risk transfers
 */

import { getDatabase } from '../db/connection';
import { logger } from '../utils/logger';

const COOLDOWN_MINUTES_LOW_RISK = 0;
const COOLDOWN_MINUTES_MEDIUM_RISK = 5;
const COOLDOWN_MINUTES_HIGH_RISK = 15;
const COOLDOWN_MINUTES_CRITICAL_RISK = 60;

/**
 * Check if user is in cooldown period
 */
export async function checkCooldown(
  userId: string,
  amountMinor: number
): Promise<{ allowed: boolean; retryAfter?: string; cooldownUntil?: Date }> {
  const db = getDatabase();

  // Get most recent intent
  const result = await db.query(
    `SELECT cooldown_until, created_at, risk_score
     FROM intents
     WHERE created_by_user_id = $1
     AND status != 'CANCELED'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { allowed: true };
  }

  const lastIntent = result.rows[0];

  // Check if cooldown is active
  if (lastIntent.cooldown_until) {
    const cooldownUntil = new Date(lastIntent.cooldown_until);
    if (cooldownUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (cooldownUntil.getTime() - Date.now()) / (1000 * 60)
      );
      return {
        allowed: false,
        retryAfter: `${minutesRemaining} minutes`,
        cooldownUntil,
      };
    }
  }

  return { allowed: true };
}

/**
 * Enforce cooldown period based on risk score
 */
export async function enforceCooldown(
  userId: string,
  amountMinor: number,
  riskScore: number
): Promise<void> {
  const db = getDatabase();

  let cooldownMinutes = COOLDOWN_MINUTES_LOW_RISK;

  if (riskScore >= 85) {
    cooldownMinutes = COOLDOWN_MINUTES_CRITICAL_RISK;
  } else if (riskScore >= 60) {
    cooldownMinutes = COOLDOWN_MINUTES_HIGH_RISK;
  } else if (riskScore >= 30) {
    cooldownMinutes = COOLDOWN_MINUTES_MEDIUM_RISK;
  }

  if (cooldownMinutes > 0) {
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

    // Update all user's DRAFT intents with cooldown
    await db.query(
      `UPDATE intents
       SET cooldown_until = $1
       WHERE created_by_user_id = $2
       AND status = 'DRAFT'`,
      [cooldownUntil, userId]
    );

    logger.info('Cooldown enforced', {
      userId,
      riskScore,
      cooldownMinutes,
      cooldownUntil,
    });
  }
}
