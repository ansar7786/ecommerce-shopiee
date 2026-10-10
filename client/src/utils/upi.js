/**
 * UPI validation utilities and common bank handle chips.
 */

export const UPI_REGEX = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;

export const COMMON_UPI_HANDLES = ['@okhdfcbank', '@oksbi', '@ybl', '@paytm'];

/**
 * Validates whether a UPI VPA string matches the standard specification.
 */
export function validateUpiId(upiId = '') {
  if (!upiId || typeof upiId !== 'string') return false;
  return UPI_REGEX.test(upiId.trim());
}

/**
 * Extracts username handle and bank suffix from a UPI string.
 */
export function parseUpiId(upiId = '') {
  if (!upiId.includes('@')) {
    return { username: upiId, handle: '' };
  }
  const [username, ...rest] = upiId.split('@');
  return { username, handle: `@${rest.join('@')}` };
}
