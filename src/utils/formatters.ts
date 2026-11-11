import { Currency } from '../types';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

export const formatCurrency = (amount: number, currency: Currency, showDecimals: boolean = true): string => {
  const absAmount = Math.abs(amount);
  const locale = currency.code === 'INR' ? 'en-IN' : 'en-US';
  const formattedNumber = absAmount.toLocaleString(locale, {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  const sign = amount < 0 ? '-' : '';
  if (currency.position === 'suffix') {
    return `${sign}${formattedNumber} ${currency.symbol}`;
  }
  return `${sign}${currency.symbol}${formattedNumber}`;
};

export const formatDateDisplay = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM dd, yyyy');
  } catch {
    return dateString;
  }
};

export const formatPercentage = (value: number): string => {
  return `${Math.round(value)}%`;
};

