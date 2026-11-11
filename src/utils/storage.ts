import { 
  Transaction, 
  Category, 
  Budget, 
  RecurringTransaction, 
  UserSettings,
  PaymentMethodItem
} from '../types';
import { format } from 'date-fns';
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
  const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  if (!data) {
    const sample = generateSampleTransactions();
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
    return sample;
  }
  try {
    return JSON.parse(data);
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
  const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
    return INITIAL_BUDGETS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_BUDGETS;
  }
};

export const saveBudgets = (budgets: Budget[]): void => {
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
};

export const getStoredRecurring = (): RecurringTransaction[] => {
  const data = localStorage.getItem(STORAGE_KEYS.RECURRING);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(INITIAL_RECURRING));
    return INITIAL_RECURRING;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_RECURRING;
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
}

// Export Comprehensive Multi-Section Financial Report as CSV (Transactions, Budgets, Subscriptions, and Analytics)
export const exportFullReportAsCSV = ({
  transactions,
  categories,
  paymentMethods,
  budgets,
  recurring,
  settings,
}: FullReportExportData): string => {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const pmMap = new Map(paymentMethods.map(pm => [pm.id, pm.label]));

  const sym = settings.currency.symbol;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 1. Calculate Analytics
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryExpenseMap: Record<string, { total: number; count: number }> = {};
  const pmExpenseMap: Record<string, { total: number; count: number }> = {};
  const currentMonthSpends: Record<string, number> = {};

  transactions.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
      // Category aggregation
      if (!categoryExpenseMap[tx.categoryId]) {
        categoryExpenseMap[tx.categoryId] = { total: 0, count: 0 };
      }
      categoryExpenseMap[tx.categoryId].total += tx.amount;
      categoryExpenseMap[tx.categoryId].count++;

      // Payment method aggregation
      if (!pmExpenseMap[tx.paymentMethod]) {
        pmExpenseMap[tx.paymentMethod] = { total: 0, count: 0 };
      }
      pmExpenseMap[tx.paymentMethod].total += tx.amount;
      pmExpenseMap[tx.paymentMethod].count++;

      // Current month spend for budgets
      if (tx.date.startsWith(currentMonthKey)) {
        currentMonthSpends[tx.categoryId] = (currentMonthSpends[tx.categoryId] || 0) + tx.amount;
      }
    }
  });

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(2) + '%' : '0%';

  const lines: string[] = [];

  // HEADER BANNER
  lines.push(`"=== TRACKWISE COMPREHENSIVE FINANCIAL REPORT ==="`);
  lines.push(`"Generated Date","${now.toLocaleString()}"`);
  lines.push(`"Currency","${settings.currency.name} (${sym} ${settings.currency.code})"`);
  lines.push(`""`);

  // SECTION 1: FINANCIAL SUMMARY & ANALYTICS KPI
  lines.push(`"=== 1. FINANCIAL SUMMARY & KEY METRICS ==="`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Total Recorded Income","${sym} ${totalIncome.toLocaleString('en-IN')}"`);
  lines.push(`"Total Recorded Expenses","${sym} ${totalExpense.toLocaleString('en-IN')}"`);
  lines.push(`"Net Savings Balance","${sym} ${netSavings.toLocaleString('en-IN')}"`);
  lines.push(`"Overall Savings Rate","${savingsRate}"`);
  lines.push(`"Total Transactions Count","${transactions.length}"`);
  lines.push(`""`);

  // SECTION 2: CATEGORY ANALYTICS MATRIX
  lines.push(`"=== 2. CATEGORY ANALYTICS BREAKDOWN ==="`);
  lines.push(`"Category Name","Type","Total Spent (${sym})","Transactions Count","% of Total Expenses"`);
  Object.entries(categoryExpenseMap)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([catId, data]) => {
      const cat = categoryMap.get(catId);
      const catName = cat?.name || 'Uncategorized';
      const pct = totalExpense > 0 ? ((data.total / totalExpense) * 100).toFixed(1) + '%' : '0%';
      lines.push(`"${catName}","Expense",${data.total},${data.count},"${pct}"`);
    });
  lines.push(`""`);

  // SECTION 3: PAYMENT METHOD DISTRIBUTION ANALYTICS
  lines.push(`"=== 3. PAYMENT METHOD DISTRIBUTION ==="`);
  lines.push(`"Payment Method","Total Spent (${sym})","Transaction Count"`);
  Object.entries(pmExpenseMap)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([pmId, data]) => {
      const pmLabel = pmMap.get(pmId) || pmId.replace('_', ' ');
      lines.push(`"${pmLabel}",${data.total},${data.count}`);
    });
  lines.push(`""`);

  // SECTION 4: ACTIVE MONTHLY BUDGETS
  lines.push(`"=== 4. MONTHLY CATEGORY BUDGETS ==="`);
  lines.push(`"Category","Monthly Cap (${sym})","Current Month Spent (${sym})","Remaining (${sym})","% Utilized","Status"`);
  budgets.forEach((b) => {
    const catName = categoryMap.get(b.categoryId)?.name || 'Category';
    const spent = currentMonthSpends[b.categoryId] || 0;
    const remaining = b.monthlyLimit - spent;
    const pct = Math.round((spent / b.monthlyLimit) * 100);
    const status = spent >= b.monthlyLimit ? 'EXCEEDED' : pct >= b.alertThresholdPercentage ? 'WARNING' : 'HEALTHY';
    lines.push(`"${catName}",${b.monthlyLimit},${spent},${remaining},"${pct}%","${status}"`);
  });
  lines.push(`""`);

  // SECTION 5: SUBSCRIPTIONS & RECURRING BILLS
  lines.push(`"=== 5. SUBSCRIPTIONS & RECURRING BILLS ==="`);
  lines.push(`"Title","Amount (${sym})","Frequency","Category","Payment Method","Next Due Date","Status","Notes"`);
  recurring.forEach((r) => {
    const catName = categoryMap.get(r.categoryId)?.name || 'Category';
    const pmName = pmMap.get(r.paymentMethod) || r.paymentMethod;
    const status = r.active ? 'Active' : 'Paused';
    const notes = (r.notes || '').replace(/"/g, '""');
    lines.push(`"${r.title.replace(/"/g, '""')}",${r.amount},"${r.frequency}","${catName}","${pmName}","${r.nextDueDate}","${status}","${notes}"`);
  });
  lines.push(`""`);

  // SECTION 6: DETAILED TRANSACTIONS LEDGER
  lines.push(`"=== 6. DETAILED TRANSACTIONS LEDGER ==="`);
  lines.push(`"ID","Date","Title","Type","Category","Amount (${sym})","Payment Method","Notes","Tags"`);
  transactions.forEach((t) => {
    const catName = categoryMap.get(t.categoryId)?.name || 'Uncategorized';
    const pmName = pmMap.get(t.paymentMethod) || t.paymentMethod;
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    lines.push(`"${t.id}","${t.date}","${title}","${t.type}","${catName}",${t.amount},"${pmName}","${notes}","${tags}"`);
  });

  return lines.join('\n');
};

export interface ExportTransactionsOptions {
  periodName?: string;
  dateRangeDescription?: string;
  currencySymbol?: string;
}

// Export to Filtered Period Transactions CSV string
export const exportTransactionsAsCSV = (
  transactions: Transaction[],
  categories: Category[],
  paymentMethods: PaymentMethodItem[] = [],
  options?: ExportTransactionsOptions
): string => {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const pmMap = new Map(paymentMethods.map(pm => [pm.id, pm.label]));
  const sym = options?.currencySymbol || '₹';
  const now = new Date();

  const lines: string[] = [];

  // Period & Metadata Header
  lines.push(`"=== TRACKWISE TRANSACTIONS EXPORT ==="`);
  if (options?.periodName) {
    lines.push(`"Export Period","${options.periodName}"`);
  }
  if (options?.dateRangeDescription) {
    lines.push(`"Period Date Range","${options.dateRangeDescription}"`);
  }
  lines.push(`"Total Transactions","${transactions.length}"`);
  lines.push(`"Exported On","${format(now, 'yyyy-MM-dd HH:mm:ss')}"`);
  lines.push(`"Currency","${sym}"`);
  lines.push(`""`);

  // Table Headers
  const headers = ['ID', 'Date', 'Title', 'Type', 'Category', `Amount (${sym})`, 'Payment Method', 'Notes', 'Tags'];
  lines.push(headers.map(h => `"${h}"`).join(','));

  // Table Rows
  transactions.forEach(t => {
    const catName = categoryMap.get(t.categoryId) || 'Uncategorized';
    const pmName = pmMap.get(t.paymentMethod) || t.paymentMethod.replace('_', ' ');
    const tags = (t.tags || []).join(';');
    const notes = (t.notes || '').replace(/"/g, '""');
    const title = t.title.replace(/"/g, '""');
    lines.push([
      `"${t.id}"`,
      `"${t.date}"`,
      `"${title}"`,
      `"${t.type}"`,
      `"${catName}"`,
      t.amount,
      `"${pmName}"`,
      `"${notes}"`,
      `"${tags}"`
    ].join(','));
  });

  return lines.join('\n');
};

