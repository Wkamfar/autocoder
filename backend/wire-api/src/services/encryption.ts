/**
 * Encryption Service
 * 
 * Encrypts/decrypts sensitive data (bank account numbers)
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'change-me-in-production-use-strong-random-key-32-bytes';
  
  if (key === 'change-me-in-production-use-strong-random-key-32-bytes') {
    logger.warn('Using default encryption key. Change in production!');
  }

  // Derive key using PBKDF2
  return crypto.pbkdf2Sync(key, 'wire2-salt', 100000, 32, 'sha256');
}

/**
 * Encrypt account number
 */
export async function encryptAccountNumber(accountNumber: string): Promise<string> {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(accountNumber, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted
    const result = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex'),
    ]).toString('base64');

    return result;
  } catch (error) {
    logger.error('Encryption failed', { error });
    throw new Error('Failed to encrypt account number');
  }
}

/**
 * Decrypt account number
 */
export async function decryptAccountNumber(encryptedData: string): Promise<string> {
  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedData, 'base64');

    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = data.subarray(ENCRYPTED_POSITION);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', { error });
    throw new Error('Failed to decrypt account number');
  }
}
