/**
 * Device Fingerprinting
 * 
 * Creates unique device fingerprints for security
 * Used for session tracking and anomaly detection
 */

import crypto from 'crypto';
import { Request } from 'express';

export interface DeviceFingerprint {
  fingerprint: string;
  components: {
    userAgent: string;
    acceptLanguage: string;
    acceptEncoding: string;
    ip: string;
  };
}

/**
 * Generate device fingerprint from request
 */
export function generateDeviceFingerprint(req: Request): DeviceFingerprint {
  const components = {
    userAgent: req.get('user-agent') || '',
    acceptLanguage: req.get('accept-language') || '',
    acceptEncoding: req.get('accept-encoding') || '',
    ip: getClientIP(req),
  };

  // Create hash from components
  const fingerprintString = [
    components.userAgent,
    components.acceptLanguage,
    components.acceptEncoding,
    components.ip,
  ].join('|');

  const fingerprint = crypto
    .createHash('sha256')
    .update(fingerprintString)
    .digest('hex')
    .substring(0, 32); // Use first 32 chars

  return {
    fingerprint,
    components,
  };
}

/**
 * Get client IP address (handles proxies)
 */
function getClientIP(req: Request): string {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = req.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 (simplified check)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}
