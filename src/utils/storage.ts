import { 
  Transaction, 
  Category, 
  Budget, 
  RecurringTransaction, 
  UserSettings,
  PaymentMethodItem
} from '../types';
import { format } from 'date-fns';
import { normalizePaymentMethod } from './formatters';
import { 
  DEFAULT_CATEGORIES, 
  DEFAULT_PAYMENT_METHODS,
  INITIAL_BUDGETS, 
  INITIAL_RECURRING, 
  generateSampleTransactions, 
  CURRENCIES 
} from '../constants/defaults';

const STORAGE_KEYS = {
  TRANSACTIONS: 'trackwise_transactions_v1',
  CATEGORIES: 'trackwise_categories_v1',
  PAYMENT_METHODS: 'trackwise_payment_methods_v1',
  BUDGETS: 'trackwise_budgets_v1',
  RECURRING: 'trackwise_recurring_v1',
  SETTINGS: 'trackwise_settings_v1',
  INITIALIZED: 'trackwise_is_initialized_v1',
};

export const getStoredTransactions = (): Transaction[] => {
  const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  if (!data && !isInitialized) {
    const sample = generateSampleTransactions().map(tx => ({
      ...tx,
      paymentMethod: normalizePaymentMethod(tx.paymentMethod)
    }));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
    return sample;
  }
  if (!data) {
    return [];
  }
  try {
    const parsed: Transaction[] = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(tx => ({
      ...tx,
      paymentMethod: normalizePaymentMethod(tx.paymentMethod)
    })) : [];
  } catch (e) {
    console.error('Failed to parse transactions', e);
    return [];
  }
};

export const saveTransactions = (transactions: Transaction[]): void => {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
};

export const getStoredCategories = (): Category[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_CATEGORIES;
  }
};

export const saveCategories = (categories: Category[]): void => {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
};

export const getStoredPaymentMethods = (): PaymentMethodItem[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(DEFAULT_PAYMENT_METHODS));
    return DEFAULT_PAYMENT_METHODS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_PAYMENT_METHODS;
  }
};

export const savePaymentMethods = (paymentMethods: PaymentMethodItem[]): void => {
  localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(paymentMethods));
};

export const getStoredBudgets = (): Budget[] => {
  const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
  if (!data && !isInitialized) {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
    return INITIAL_BUDGETS;
  }
  if (!data) {
    return [];
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveBudgets = (budgets: Budget[]): void => {
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
};

export const getStoredRecurring = (): RecurringTransaction[] => {
  const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  const data = localStorage.getItem(STORAGE_KEYS.RECURRING);
  if (!data && !isInitialized) {
    const sample = INITIAL_RECURRING.map(rec => ({
      ...rec,
      paymentMethod: normalizePaymentMethod(rec.paymentMethod)
    }));
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(sample));
    return sample;
  }
  if (!data) {
    return [];
  }
  try {
    const parsed: RecurringTransaction[] = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(rec => ({
      ...rec,
      paymentMethod: normalizePaymentMethod(rec.paymentMethod)
    })) : [];
  } catch {
    return [];
  }
};

export const saveRecurring = (recurring: RecurringTransaction[]): void => {
  localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(recurring));
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  currency: CURRENCIES[0], // INR (₹) default
  theme: 'light',
  showDecimals: true,
  dateFormat: 'MMM dd, yyyy',
};

export const getStoredSettings = (): UserSettings => {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_USER_SETTINGS));
    return DEFAULT_USER_SETTINGS;
  }
  try {
    const parsed = JSON.parse(data);
    // Ensure currency defaults to INR (₹)
    if (!parsed.currency || parsed.currency.code !== 'INR') {
      parsed.currency = CURRENCIES[0];
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
};

export const saveSettings = (settings: UserSettings): void => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

export const resetAllDataToDefault = () => {
  const sample = generateSampleTransactions();
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(DEFAULT_PAYMENT_METHODS));
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
  localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(INITIAL_RECURRING));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_USER_SETTINGS));
  return {
    transactions: sample,
    categories: DEFAULT_CATEGORIES,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    budgets: INITIAL_BUDGETS,
    recurring: INITIAL_RECURRING,
    settings: DEFAULT_USER_SETTINGS,
  };
};

export const clearAllData = () => {
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify([]));
  return {
    transactions: [],
    budgets: [],
    recurring: [],
  };
};

// Export to JSON string
export const exportDataAsJSON = () => {
  const exportPayload = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    transactions: getStoredTransactions(),
    categories: getStoredCategories(),
    paymentMethods: getStoredPaymentMethods(),
    budgets: getStoredBudgets(),
    recurring: getStoredRecurring(),
    settings: getStoredSettings(),
  };
  return JSON.stringify(exportPayload, null, 2);
};

export interface FullReportExportData {
  transactions: Transaction[];
  categories: Category[];
  paymentMethods: PaymentMethodItem[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  settings: UserSettings;
  upiBalance?: number;
  cashBalance?: number;
  totalBalance?: number;
}

// Export Comprehensive Multi-Section Financial Report as CSV matching the 5-sheet structure
export const exportFullReportAsCSV = ({
  transactions,
  categories,
  paymentMethods,
  budgets,
  recurring,
  settings,
  upiBalance,
  cashBalance,
  totalBalance,
}: FullReportExportData): string => {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const sym = settings.currency.symbol;
  const now = new Date();
  const nowFormatted = format(now, 'yyyy-MM-dd HH:mm:ss');

  // Compute Balances if not passed
  let liveUpi = upiBalance;
  let liveCash = cashBalance;
  if (liveUpi === undefined || liveCash === undefined) {
    let calcUpi = 0;
    let calcCash = 0;
    transactions.forEach((tx) => {
      if (tx.isDeleted) return;
      const pm = normalizePaymentMethod(tx.paymentMethod);
      const val = tx.type === 'income' ? tx.amount : -tx.amount;
      if (pm === 'UPI') calcUpi += val;
      else if (pm === 'Cash') calcCash += val;
    });
    if (liveUpi === undefined) liveUpi = calcUpi;
    if (liveCash === undefined) liveCash = calcCash;
  }
  const liveTotal = totalBalance !== undefined ? totalBalance : (liveUpi + liveCash);

  const lines: string[] = [];

  // HEADER BANNER
  lines.push(`"=== TRACKWISE 5-SHEET FINANCIAL REPORT ==="`);
  lines.push(`"Generated Date","${nowFormatted}"`);
  lines.push(`"Currency","${settings.currency.name} (${sym} ${settings.currency.code})"`);
  lines.push(`"Total Transactions","${transactions.length}"`);
  lines.push(`""`);

  // SHEET 1: TRANSACTIONS (All transactions ledger)
  lines.push(`"=== SHEET 1: TRANSACTIONS ==="`);
  const txHeaders = ['ID', 'Date', 'Title', 'Type', 'Category', `Amount (${sym})`, 'Payment Method', 'Notes', 'Tags', 'Updated At'];
  lines.push(txHeaders.map(h => `"${h}"`).join(','));
  transactions.forEach((t) => {
    const catName = categoryMap.get(t.categoryId) || 'Uncategorized';
    const pmName = normalizePaymentMethod(t.paymentMethod);
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    const updatedAt = t.updatedAt || t.createdAt || '';
    lines.push([
      `"${t.id}"`,
      `"${t.date}"`,
      `"${title}"`,
      `"${t.type}"`,
      `"${catName}"`,
      t.amount,
      `"${pmName}"`,
      `"${notes}"`,
      `"${tags}"`,
      `"${updatedAt}"`
    ].join(','));
  });
  lines.push(`""`);

  // SHEET 2: UPI EXPENSES (UPI expenses exclusively + Dedicated Total)
  lines.push(`"=== SHEET 2: UPI EXPENSES ==="`);
  const upiHeaders = ['ID', 'Date', 'Title', 'Category', `Amount (${sym})`, 'Notes', 'Tags', 'Updated At'];
  lines.push(upiHeaders.map(h => `"${h}"`).join(','));
  const upiExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'UPI'
  );
  let totalUpiExpenses = 0;
  upiExpenses.forEach((t) => {
    totalUpiExpenses += t.amount;
    const catName = categoryMap.get(t.categoryId) || 'Uncategorized';
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    const updatedAt = t.updatedAt || t.createdAt || '';
    lines.push([
      `"${t.id}"`,
      `"${t.date}"`,
      `"${title}"`,
      `"${catName}"`,
      t.amount,
      `"${notes}"`,
      `"${tags}"`,
      `"${updatedAt}"`
    ].join(','));
  });
  lines.push([
    `""`,
    `""`,
    `"TOTAL UPI EXPENSES"`,
    `""`,
    totalUpiExpenses,
    `""`,
    `""`,
    `""`
  ].join(','));
  lines.push(`""`);

  // SHEET 3: CASH EXPENSES (Cash expenses exclusively + Dedicated Total)
  lines.push(`"=== SHEET 3: CASH EXPENSES ==="`);
  const cashHeaders = ['ID', 'Date', 'Title', 'Category', `Amount (${sym})`, 'Notes', 'Tags', 'Updated At'];
  lines.push(cashHeaders.map(h => `"${h}"`).join(','));
  const cashExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'Cash'
  );
  let totalCashExpenses = 0;
  cashExpenses.forEach((t) => {
    totalCashExpenses += t.amount;
    const catName = categoryMap.get(t.categoryId) || 'Uncategorized';
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    const updatedAt = t.updatedAt || t.createdAt || '';
    lines.push([
      `"${t.id}"`,
      `"${t.date}"`,
      `"${title}"`,
      `"${catName}"`,
      t.amount,
      `"${notes}"`,
      `"${tags}"`,
      `"${updatedAt}"`
    ].join(','));
  });
  lines.push([
    `""`,
    `""`,
    `"TOTAL CASH EXPENSES"`,
    `""`,
    totalCashExpenses,
    `""`,
    `""`,
    `""`
  ].join(','));
  lines.push(`""`);

  // SHEET 4: BUDGETS
  lines.push(`"=== SHEET 4: BUDGETS ==="`);
  const budgetHeaders = ['ID', 'Category', `Monthly Limit (${sym})`, 'Alert Threshold (%)', 'Updated At'];
  lines.push(budgetHeaders.map(h => `"${h}"`).join(','));
  budgets.forEach((b) => {
    const catName = categoryMap.get(b.categoryId) || b.categoryId;
    lines.push([
      `"${b.id}"`,
      `"${catName}"`,
      b.monthlyLimit,
      `"${b.alertThresholdPercentage}%"`,
      `"${b.updatedAt || ''}"`
    ].join(','));
  });
  lines.push(`""`);

  // SHEET 5: ACCOUNTS (Live wallet balances)
  lines.push(`"=== SHEET 5: ACCOUNTS ==="`);
  const accountHeaders = ['Wallet / Account', `Live Balance (${sym})`, 'Currency', 'Last Synced / As Of'];
  lines.push(accountHeaders.map(h => `"${h}"`).join(','));
  lines.push([`"UPI / Online Wallet"`, liveUpi, `"${sym}"`, `"${nowFormatted}"`].join(','));
  lines.push([`"Liquid Cash Wallet"`, liveCash, `"${sym}"`, `"${nowFormatted}"`].join(','));
  lines.push([`"Total Net Balance"`, liveTotal, `"${sym}"`, `"${nowFormatted}"`].join(','));

  // Optional recurring bills appendix
  if (recurring && recurring.length > 0) {
    lines.push(`""`);
    lines.push(`"=== APPENDIX: RECURRING BILLS ==="`);
    lines.push(`"Title","Amount (${sym})","Frequency","Category","Payment Method","Next Due Date","Status","Notes"`);
    recurring.forEach((r) => {
      const catName = categoryMap.get(r.categoryId) || 'Category';
      const pmName = normalizePaymentMethod(r.paymentMethod);
      const status = r.active ? 'Active' : 'Paused';
      const notes = (r.notes || '').replace(/"/g, '""');
      lines.push(`"${r.title.replace(/"/g, '""')}",${r.amount},"${r.frequency}","${catName}","${pmName}","${r.nextDueDate}","${status}","${notes}"`);
    });
  }

  return lines.join('\n');
};

export interface ExportTransactionsOptions {
  periodName?: string;
  dateRangeDescription?: string;
  currencySymbol?: string;
  budgets?: Budget[];
  upiBalance?: number;
  cashBalance?: number;
  totalBalance?: number;
}

// Export to Filtered Period Transactions CSV string with 5-Sheet structure
export const exportTransactionsAsCSV = (
  transactions: Transaction[],
  categories: Category[],
  paymentMethods: PaymentMethodItem[] = [],
  options?: ExportTransactionsOptions
): string => {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const sym = options?.currencySymbol || '₹';
  const now = new Date();
  const nowFormatted = format(now, 'yyyy-MM-dd HH:mm:ss');

  // Compute live wallet balances if not passed
  let liveUpi = options?.upiBalance;
  let liveCash = options?.cashBalance;
  if (liveUpi === undefined || liveCash === undefined) {
    let calcUpi = 0;
    let calcCash = 0;
    transactions.forEach((tx) => {
      if (tx.isDeleted) return;
      const pm = normalizePaymentMethod(tx.paymentMethod);
      const val = tx.type === 'income' ? tx.amount : -tx.amount;
      if (pm === 'UPI') calcUpi += val;
      else if (pm === 'Cash') calcCash += val;
    });
    if (liveUpi === undefined) liveUpi = calcUpi;
    if (liveCash === undefined) liveCash = calcCash;
  }
  const liveTotal = options?.totalBalance !== undefined ? options.totalBalance : (liveUpi + liveCash);

  const lines: string[] = [];

  // Period & Metadata Header Banner
  lines.push(`"=== TRACKWISE 5-SHEET FINANCIAL EXPORT ==="`);
  if (options?.periodName) {
    lines.push(`"Export Period","${options.periodName}"`);
  }
  if (options?.dateRangeDescription) {
    lines.push(`"Period Date Range","${options.dateRangeDescription}"`);
  }
  lines.push(`"Total Transactions","${transactions.length}"`);
  lines.push(`"Exported On","${nowFormatted}"`);
  lines.push(`"Currency","${sym}"`);
  lines.push(`""`);

  // SHEET 1: TRANSACTIONS (All transactions ledger)
  lines.push(`"=== SHEET 1: TRANSACTIONS ==="`);
  const txHeaders = ['ID', 'Date', 'Title', 'Type', 'Category', `Amount (${sym})`, 'Payment Method', 'Notes', 'Tags', 'Updated At'];
  lines.push(txHeaders.map(h => `"${h}"`).join(','));
  transactions.forEach((t) => {
    const catName = categoryMap.get(t.categoryId) || 'Uncategorized';
    const pmName = normalizePaymentMethod(t.paymentMethod);
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    const updatedAt = t.updatedAt || t.createdAt || '';
    lines.push([
      `"${t.id}"`,
      `"${t.date}"`,
      `"${title}"`,
      `"${t.type}"`,
      `"${catName}"`,
      t.amount,
      `"${pmName}"`,
      `"${notes}"`,
      `"${tags}"`,
      `"${updatedAt}"`
    ].join(','));
  });
  lines.push(`""`);

  // SHEET 2: UPI EXPENSES (UPI expenses exclusively + Dedicated Total)
  lines.push(`"=== SHEET 2: UPI EXPENSES ==="`);
  const upiHeaders = ['ID', 'Date', 'Title', 'Category', `Amount (${sym})`, 'Notes', 'Tags', 'Updated At'];
  lines.push(upiHeaders.map(h => `"${h}"`).join(','));
  const upiExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'UPI'
  );
  let totalUpiExpenses = 0;
  upiExpenses.forEach((t) => {
    totalUpiExpenses += t.amount;
    const catName = categoryMap.get(t.categoryId) || 'Uncategorized';
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    const updatedAt = t.updatedAt || t.createdAt || '';
    lines.push([
      `"${t.id}"`,
      `"${t.date}"`,
      `"${title}"`,
      `"${catName}"`,
      t.amount,
      `"${notes}"`,
      `"${tags}"`,
      `"${updatedAt}"`
    ].join(','));
  });
  // Summary Total row for UPI Expenses
  lines.push([
    `""`,
    `""`,
    `"TOTAL UPI EXPENSES"`,
    `""`,
    totalUpiExpenses,
    `""`,
    `""`,
    `""`
  ].join(','));
  lines.push(`""`);

  // SHEET 3: CASH EXPENSES (Cash expenses exclusively + Dedicated Total)
  lines.push(`"=== SHEET 3: CASH EXPENSES ==="`);
  const cashHeaders = ['ID', 'Date', 'Title', 'Category', `Amount (${sym})`, 'Notes', 'Tags', 'Updated At'];
  lines.push(cashHeaders.map(h => `"${h}"`).join(','));
  const cashExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'Cash'
  );
  let totalCashExpenses = 0;
  cashExpenses.forEach((t) => {
    totalCashExpenses += t.amount;
    const catName = categoryMap.get(t.categoryId) || 'Uncategorized';
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    const updatedAt = t.updatedAt || t.createdAt || '';
    lines.push([
      `"${t.id}"`,
      `"${t.date}"`,
      `"${title}"`,
      `"${catName}"`,
      t.amount,
      `"${notes}"`,
      `"${tags}"`,
      `"${updatedAt}"`
    ].join(','));
  });
  // Summary Total row for Cash Expenses
  lines.push([
    `""`,
    `""`,
    `"TOTAL CASH EXPENSES"`,
    `""`,
    totalCashExpenses,
    `""`,
    `""`,
    `""`
  ].join(','));
  lines.push(`""`);

  // SHEET 4: BUDGETS
  lines.push(`"=== SHEET 4: BUDGETS ==="`);
  const budgetHeaders = ['ID', 'Category', `Monthly Limit (${sym})`, 'Alert Threshold (%)', 'Updated At'];
  lines.push(budgetHeaders.map(h => `"${h}"`).join(','));
  const budgetsList = options?.budgets || getStoredBudgets();
  budgetsList.forEach((b) => {
    const catName = categoryMap.get(b.categoryId) || b.categoryId;
    lines.push([
      `"${b.id}"`,
      `"${catName}"`,
      b.monthlyLimit,
      `"${b.alertThresholdPercentage}%"`,
      `"${b.updatedAt || ''}"`
    ].join(','));
  });
  lines.push(`""`);

  // SHEET 5: ACCOUNTS (Live wallet balances)
  lines.push(`"=== SHEET 5: ACCOUNTS ==="`);
  const accountHeaders = ['Wallet / Account', `Live Balance (${sym})`, 'Currency', 'Last Synced / As Of'];
  lines.push(accountHeaders.map(h => `"${h}"`).join(','));
  lines.push([`"UPI / Online Wallet"`, liveUpi, `"${sym}"`, `"${nowFormatted}"`].join(','));
  lines.push([`"Liquid Cash Wallet"`, liveCash, `"${sym}"`, `"${nowFormatted}"`].join(','));
  lines.push([`"Total Net Balance"`, liveTotal, `"${sym}"`, `"${nowFormatted}"`].join(','));

  return lines.join('\n');
};

