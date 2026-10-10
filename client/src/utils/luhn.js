/**
 * Luhn checksum, card brand detection, expiry, and CVV validation utilities.
 */

export function cleanNumber(num = '') {
  return String(num).replace(/\D/g, '');
}

/**
 * Validates card number using the Luhn checksum algorithm (Mod 10).
 */
export function validateLuhn(cardNumber = '') {
  const digits = cleanNumber(cardNumber);
  if (!digits || digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Detects card brand based on BIN ranges:
 * - Visa: starts with 4
 * - Mastercard: starts with 51-55 or 2221-2720
 * - RuPay: starts with 60, 65, 81, 82, or 508
 */
export function detectCardBrand(cardNumber = '') {
  const digits = cleanNumber(cardNumber);
  if (!digits) return 'Unknown';

  if (digits.startsWith('4')) {
    return 'Visa';
  }

  const prefix2 = parseInt(digits.slice(0, 2), 10);
  const prefix4 = parseInt(digits.slice(0, 4), 10);
  const prefix3 = parseInt(digits.slice(0, 3), 10);

  if ((prefix2 >= 51 && prefix2 <= 55) || (prefix4 >= 2221 && prefix4 <= 2720)) {
    return 'Mastercard';
  }

  if (prefix2 === 60 || prefix2 === 65 || prefix2 === 81 || prefix2 === 82 || prefix3 === 508) {
    return 'RuPay';
  }

  return 'Unknown';
}

/**
 * Validates expiration date (MM/YY format) to ensure it is in the future.
 */
export function validateExpiry(expiry = '') {
  if (!expiry || typeof expiry !== 'string') return false;

  const parts = expiry.split('/');
  if (parts.length !== 2) return false;

  const month = parseInt(parts[0].trim(), 10);
  let year = parseInt(parts[1].trim(), 10);

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return false;
  }

  // Convert 2-digit year to 4-digit
  if (year < 100) {
    year += 2000;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  if (year > currentYear) {
    return true;
  }

  if (year === currentYear && month >= currentMonth) {
    return true;
  }

  return false;
}

/**
 * Validates 3-digit CVV (accepts 3 or 4 digits).
 */
export function validateCvv(cvv = '') {
  const clean = cleanNumber(cvv);
  return /^\d{3,4}$/.test(clean);
}

/**
 * Formats a card number with spaces every 4 digits.
 */
export function formatCardNumber(value = '') {
  const digits = cleanNumber(value).slice(0, 19);
  return digits.replace(/(\d{4})/g, '$1 ').trim();
}

/**
 * Formats an expiry date as MM/YY.
 */
export function formatExpiry(value = '') {
  const digits = cleanNumber(value).slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}
