/**
 * Bank Account Validation
 * 
 * Validates bank account numbers and routing numbers
 * Uses Luhn algorithm and routing number validation
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate bank account number using Luhn algorithm
 */
export function validateBankAccount(accountNumber: string): ValidationResult {
  if (!accountNumber || accountNumber.length < 4) {
    return { valid: false, error: 'Account number must be at least 4 digits' };
  }

  if (accountNumber.length > 17) {
    return { valid: false, error: 'Account number must be 17 digits or less' };
  }

  if (!/^\d+$/.test(accountNumber)) {
    return { valid: false, error: 'Account number must contain only digits' };
  }

  // Luhn algorithm validation
  const digits = accountNumber.split('').map(Number);
  let sum = 0;
  let isEven = false;

  // Process from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return { valid: false, error: 'Invalid account number (Luhn check failed)' };
  }

  return { valid: true };
}

/**
 * Validate routing number
 */
export function validateRoutingNumber(
  routingNumber: string,
  country: string
): ValidationResult {
  if (!routingNumber) {
    return { valid: false, error: 'Routing number is required' };
  }

  // US routing numbers are 9 digits
  if (country === 'US') {
    if (!/^\d{9}$/.test(routingNumber)) {
      return { valid: false, error: 'US routing number must be 9 digits' };
    }

    // US routing number checksum validation
    const digits = routingNumber.split('').map(Number);
    const checksum =
      (3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        digits[2] +
        digits[5] +
        digits[8]) %
      10;

    if (checksum !== 0) {
      return { valid: false, error: 'Invalid US routing number (checksum failed)' };
    }

    // Check Federal Reserve district (first two digits)
    const district = parseInt(routingNumber.substring(0, 2));
    if (district < 1 || district > 12) {
      return { valid: false, error: 'Invalid Federal Reserve district' };
    }
  } else {
    // For international, basic format validation
    if (routingNumber.length < 4 || routingNumber.length > 20) {
      return {
        valid: false,
        error: 'Routing number must be between 4 and 20 characters',
      };
    }
  }

  return { valid: true };
}

/**
 * Mask account number (show only last 4 digits)
 */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) {
    return '****';
  }
  return '****' + accountNumber.slice(-4);
}

/**
 * Validate account type
 */
export function validateAccountType(accountType: string): ValidationResult {
  const validTypes = ['checking', 'savings', 'business_checking', 'business_savings'];
  
  if (!validTypes.includes(accountType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid account type. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  return { valid: true };
}
