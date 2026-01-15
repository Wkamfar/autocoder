/**
 * Multi-Factor Authentication (MFA)
 * 
 * TOTP-based MFA using speakeasy
 * QR code generation for enrollment
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { logger } from '../utils/logger';

export interface MFASecret {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface MFAVerifyResult {
  valid: boolean;
  delta?: number;
}

class MFAService {
  /**
   * Generate MFA secret for user
   */
  generateSecret(email: string, issuer: string = 'WIRE2'): MFASecret {
    const secret = speakeasy.generateSecret({
      name: `${issuer}:${email}`,
      issuer,
      length: 32,
    });

    return {
      secret: secret.base32!,
      qrCodeUrl: secret.otpauth_url!,
      manualEntryKey: secret.base32!,
    };
  }

  /**
   * Generate QR code data URL for MFA enrollment
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeUrl;
    } catch (error) {
      logger.error('QR code generation failed', { error });
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify TOTP token
   */
  verifyToken(token: string, secret: string, window: number = 2): MFAVerifyResult {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window, // Allow tokens within ±2 time steps
      });

      return {
        valid: verified !== null,
        delta: verified || undefined,
      };
    } catch (error) {
      logger.error('MFA token verification failed', { error });
      return { valid: false };
    }
  }

  /**
   * Generate backup codes (for MFA recovery)
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      codes.push(code);
    }
    return codes;
  }
}

export const mfaService = new MFAService();
