export type TransactionType = 'expense' | 'income';

export interface PaymentMethodItem {
  id: string;
  label: string;
  icon: string;
  isDefault?: boolean;
}

export type PaymentMethod = string;

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType | 'both';
  isDefault?: boolean;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  notes?: string;
  receiptUrl?: string; // base64 or object URL
  tags?: string[];
  recurringId?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  alertThresholdPercentage: number; // e.g. 80
}

export interface RecurringTransaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  paymentMethod: PaymentMethod;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string; // YYYY-MM-DD
  startDate: string;
  active: boolean;
  notes?: string;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  position: 'prefix' | 'suffix';
}

export interface UserSettings {
  currency: Currency;
  theme: 'light' | 'dark' | 'system';
  showDecimals: boolean;
  dateFormat: string;
}

export type DateRangePreset = 
  | 'all' 
  | 'this_month' 
  | 'last_month' 
  | 'last_30_days' 
  | 'this_year' 
  | 'custom';

export interface FilterState {
  dateRange: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  categoryId: string;
  paymentMethod: string;
  type: 'all' | TransactionType;
  searchQuery: string;
  sortBy: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
}

