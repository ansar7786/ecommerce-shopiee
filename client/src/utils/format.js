/**
 * Formats an amount in paise to Indian rupee string format (e.g. 125000 -> "₹1,250", 1250 -> "₹12.50")
 * @param {number} paise - Amount in integer paise
 * @returns {string} Formatted Indian currency string
 */
export const formatCurrency = (paise) => {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0';
  const rupees = paise / 100;

  const hasFractions = paise % 100 !== 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasFractions ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
};

export const formatPrice = formatCurrency;
export const formatPaise = formatCurrency;

/**
 * Converts paise to numeric rupees (e.g. 5000 -> 50)
 */
export const paiseToRupees = (paise) => {
  if (!paise || isNaN(paise)) return 0;
  return Number((paise / 100).toFixed(2));
};

/**
 * Converts numeric rupees to integer paise (e.g. 50 -> 5000)
 */
export const rupeesToPaise = (rupees) => {
  if (!rupees || isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
};

/**
 * Formats a date string or object to localized Indian date (en-IN or te-IN)
 * @param {string|Date|number} date - Date to format
 * @param {string} [locale='en'] - 'en' or 'te'
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export const formatDate = (date, locale = 'en', options = {}) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const intlLocale = locale === 'te' ? 'te-IN' : 'en-IN';
  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };
  return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(d);
};

/**
 * Formats date and time in en-IN / te-IN
 */
export const formatDateTime = (date, locale = 'en', options = {}) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const intlLocale = locale === 'te' ? 'te-IN' : 'en-IN';
  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  };
  return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(d);
};

/**
 * Formats time in en-IN / te-IN
 */
export const formatTime = (date, locale = 'en', options = {}) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const intlLocale = locale === 'te' ? 'te-IN' : 'en-IN';
  const defaultOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  };
  return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(d);
};
