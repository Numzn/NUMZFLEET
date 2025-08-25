/**
 * Currency formatting utilities for Zambian Kwacha
 */

export const formatCurrency = (amount: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency: 'ZMW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options,
  }).format(amount);
};

export const formatCurrencyCompact = (amount: number) => {
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency: 'ZMW',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
};

export const CURRENCY_SYMBOL = 'K';
export const CURRENCY_CODE = 'ZMW';
export const CURRENCY_NAME = 'Zambian Kwacha';
