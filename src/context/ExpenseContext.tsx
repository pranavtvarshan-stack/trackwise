import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  Transaction, 
  Category, 
  Budget, 
  RecurringTransaction, 
  UserSettings, 
  FilterState,
  TransactionType,
  PaymentMethod,
  PaymentMethodItem
} from '../types';
import { 
  getStoredTransactions, 
  saveTransactions,
  getStoredCategories, 
  saveCategories,
  getStoredPaymentMethods,
  savePaymentMethods,
  getStoredBudgets, 
  saveBudgets,
  getStoredRecurring, 
  saveRecurring,
  getStoredSettings, 
  saveSettings,
  resetAllDataToDefault,
  clearAllData,
  exportDataAsJSON,
  exportFullReportAsCSV,
  exportTransactionsAsCSV
} from '../utils/storage';
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear, 
  subDays, 
  parseISO, 
  isWithinInterval,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  format
} from 'date-fns';
import { normalizePaymentMethod } from '../utils/formatters';

interface ExpenseContextType {
  // State
  transactions: Transaction[];
  categories: Category[];
  paymentMethods: PaymentMethodItem[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  settings: UserSettings;
  filters: FilterState;

  // Filtered Data & Stats
  filteredTransactions: Transaction[];
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  topSpendingCategory: { category: Category | null; amount: number };

  // Live Split Balances (UPI vs Liquid Cash)
  upiBalance: number;
  cashBalance: number;
  filteredUpiBalance: number;
  filteredCashBalance: number;
  
  // Actions - Transactions
  addTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Actions - Categories
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;

  // Actions - Payment Methods
  addPaymentMethod: (pm: Omit<PaymentMethodItem, 'id'>) => void;
  updatePaymentMethod: (id: string, data: Partial<PaymentMethodItem>) => void;
  deletePaymentMethod: (id: string) => boolean;

  // Actions - Budgets
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, data: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  // Actions - Recurring
  addRecurring: (recurring: Omit<RecurringTransaction, 'id'>) => void;
  updateRecurring: (id: string, data: Partial<RecurringTransaction>) => void;
  deleteRecurring: (id: string) => void;
  processDueRecurring: () => number;

  // Actions - Settings & Filters
  updateSettings: (data: Partial<UserSettings>) => void;
  toggleTheme: () => void;
  isDark: boolean;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resetFilters: () => void;
  
  // Data Management
  resetData: () => void;
  clearData: () => void;
  exportJSON: () => void;
  exportCSV: () => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  importJSON: (jsonString: string) => boolean;
}

const defaultFilters: FilterState = {
  dateRange: 'this_month',
  categoryId: 'all',
  paymentMethod: 'all',
  type: 'all',
  searchQuery: '',
  sortBy: 'date_desc',
};

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions);
  const [categories, setCategories] = useState<Category[]>(getStoredCategories);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(getStoredPaymentMethods);
  const [budgets, setBudgets] = useState<Budget[]>(getStoredBudgets);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>(getStoredRecurring);
  const [settings, setSettings] = useState<UserSettings>(getStoredSettings);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = getStoredSettings();
    if (stored.theme === 'dark') return true;
    if (stored.theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const openExportModal = () => setIsExportModalOpen(true);
  const closeExportModal = () => setIsExportModalOpen(false);

  // Sync theme to document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    const checkDark = () => {
      if (settings.theme === 'dark') return true;
      if (settings.theme === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    };

    const shouldBeDark = checkDark();
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        setIsDark(e.matches);
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  const toggleTheme = () => {
    setSettings((prev) => {
      const currentIsDark =
        prev.theme === 'dark' ||
        (prev.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const nextTheme = currentIsDark ? 'light' : 'dark';
      return { ...prev, theme: nextTheme };
    });
  };

  // Sync to storage whenever state changes
  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    savePaymentMethods(paymentMethods);
  }, [paymentMethods]);

  useEffect(() => {
    saveBudgets(budgets);
  }, [budgets]);

  useEffect(() => {
    saveRecurring(recurring);
  }, [recurring]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Filtered transactions computation
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (filters.dateRange) {
      case 'this_month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'last_month': {
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      }
      case 'last_30_days':
        startDate = subDays(now, 30);
        endDate = now;
        break;
      case 'this_year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case 'custom':
        if (filters.customStartDate) startDate = parseISO(filters.customStartDate);
        if (filters.customEndDate) endDate = parseISO(filters.customEndDate);
        break;
      case 'all':
      default:
        startDate = null;
        endDate = null;
        break;
    }

    return transactions
      .filter((tx) => {
        // Date range filter
        if (startDate || endDate) {
          try {
            const txDate = parseISO(tx.date);
            if (startDate && endDate) {
              if (!isWithinInterval(txDate, { start: startDate, end: endDate })) return false;
            } else if (startDate && txDate < startDate) {
              return false;
            } else if (endDate && txDate > endDate) {
              return false;
            }
          } catch {
            return false;
          }
        }

        // Type filter
        if (filters.type !== 'all' && tx.type !== filters.type) {
          return false;
        }

        // Category filter
        if (filters.categoryId !== 'all' && tx.categoryId !== filters.categoryId) {
          return false;
        }

        // Payment method filter (supports 'all', 'UPI', 'Cash' and legacy IDs)
        if (filters.paymentMethod !== 'all') {
          const txPm = normalizePaymentMethod(tx.paymentMethod);
          const filterPm = normalizePaymentMethod(filters.paymentMethod);
          if (txPm !== filterPm && tx.paymentMethod !== filters.paymentMethod) {
            return false;
          }
        }

        // Search query filter (matches title, notes, or tags)
        if (filters.searchQuery.trim()) {
          const query = filters.searchQuery.toLowerCase();
          const matchTitle = tx.title.toLowerCase().includes(query);
          const matchNotes = tx.notes ? tx.notes.toLowerCase().includes(query) : false;
          const matchTags = tx.tags ? tx.tags.some(tag => tag.toLowerCase().includes(query)) : false;
          if (!matchTitle && !matchNotes && !matchTags) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'date_desc') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (filters.sortBy === 'date_asc') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (filters.sortBy === 'amount_desc') {
          return b.amount - a.amount;
        }
        if (filters.sortBy === 'amount_asc') {
          return a.amount - b.amount;
        }
        return 0;
      });
  }, [transactions, filters]);

  // Key Summary Stats based on filtered transactions
  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTransactions]);

  const totalExpenses = useMemo(() => {
    return filteredTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTransactions]);

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;

  // Live Split Wallet Balances (All-time cumulative ledger)
  const upiBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (normalizePaymentMethod(tx.paymentMethod) === 'UPI') {
        return tx.type === 'income' ? acc + tx.amount : acc - tx.amount;
      }
      return acc;
    }, 0);
  }, [transactions]);

  const cashBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (normalizePaymentMethod(tx.paymentMethod) === 'Cash') {
        return tx.type === 'income' ? acc + tx.amount : acc - tx.amount;
      }
      return acc;
    }, 0);
  }, [transactions]);

  // Period Split Balances (Based on filtered period)
  const filteredUpiBalance = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (normalizePaymentMethod(tx.paymentMethod) === 'UPI') {
        return tx.type === 'income' ? acc + tx.amount : acc - tx.amount;
      }
      return acc;
    }, 0);
  }, [filteredTransactions]);

  const filteredCashBalance = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (normalizePaymentMethod(tx.paymentMethod) === 'Cash') {
        return tx.type === 'income' ? acc + tx.amount : acc - tx.amount;
      }
      return acc;
    }, 0);
  }, [filteredTransactions]);

  const topSpendingCategory = useMemo(() => {
    const expensesByCategory: Record<string, number> = {};
    filteredTransactions
      .filter(tx => tx.type === 'expense')
      .forEach(tx => {
        expensesByCategory[tx.categoryId] = (expensesByCategory[tx.categoryId] || 0) + tx.amount;
      });

    let topCatId = '';
    let maxAmount = 0;
    Object.entries(expensesByCategory).forEach(([catId, amount]) => {
      if (amount > maxAmount) {
        maxAmount = amount;
        topCatId = catId;
      }
    });

    const category = categories.find(c => c.id === topCatId) || null;
    return { category, amount: maxAmount };
  }, [filteredTransactions, categories]);

  // Transaction Actions
  const addTransaction = (data: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...data,
      paymentMethod: normalizePaymentMethod(data.paymentMethod),
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const updateTransaction = (id: string, data: Partial<Transaction>) => {
    setTransactions(prev => prev.map(tx => (tx.id === id ? { 
      ...tx, 
      ...data,
      paymentMethod: data.paymentMethod ? normalizePaymentMethod(data.paymentMethod) : tx.paymentMethod
    } : tx)));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  // Category Actions
  const addCategory = (data: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...data,
      id: `cat_${Date.now()}`,
    };
    setCategories(prev => [...prev, newCat]);
  };

  const updateCategory = (id: string, data: Partial<Category>) => {
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...data } : c)));
  };

  const deleteCategory = (id: string): boolean => {
    if (categories.length <= 1) {
      return false; // prevent deleting the last remaining category
    }
    setCategories(prev => prev.filter(c => c.id !== id));
    return true;
  };

  // Payment Method Actions
  const addPaymentMethod = (data: Omit<PaymentMethodItem, 'id'>) => {
    const newPm: PaymentMethodItem = {
      ...data,
      id: `pm_${Date.now()}`,
    };
    setPaymentMethods(prev => [...prev, newPm]);
  };

  const updatePaymentMethod = (id: string, data: Partial<PaymentMethodItem>) => {
    setPaymentMethods(prev => prev.map(pm => (pm.id === id ? { ...pm, ...data } : pm)));
  };

  const deletePaymentMethod = (id: string): boolean => {
    if (paymentMethods.length <= 1) {
      return false; // prevent deleting the last remaining payment method
    }
    setPaymentMethods(prev => prev.filter(pm => pm.id !== id));
    return true;
  };

  // Budget Actions
  const addBudget = (data: Omit<Budget, 'id'>) => {
    const newBudget: Budget = {
      ...data,
      id: `budget_${Date.now()}`,
    };
    setBudgets(prev => [...prev, newBudget]);
  };

  const updateBudget = (id: string, data: Partial<Budget>) => {
    setBudgets(prev => prev.map(b => (b.id === id ? { ...b, ...data } : b)));
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  // Recurring Actions
  const addRecurring = (data: Omit<RecurringTransaction, 'id'>) => {
    const newRec: RecurringTransaction = {
      ...data,
      id: `rec_${Date.now()}`,
    };
    setRecurring(prev => [...prev, newRec]);
  };

  const updateRecurring = (id: string, data: Partial<RecurringTransaction>) => {
    setRecurring(prev => prev.map(r => (r.id === id ? { ...r, ...data } : r)));
  };

  const deleteRecurring = (id: string) => {
    setRecurring(prev => prev.filter(r => r.id !== id));
  };

  // Process due recurring transactions and insert them as transactions
  const processDueRecurring = (): number => {
    const today = format(new Date(), 'yyyy-MM-dd');
    let generatedCount = 0;
    const newTransactionsToAdd: Transaction[] = [];

    const updatedRecurring = recurring.map(rec => {
      if (!rec.active || rec.nextDueDate > today) {
        return rec;
      }

      // Create transaction for due item
      newTransactionsToAdd.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: `${rec.title} (Recurring)`,
        amount: rec.amount,
        type: rec.type,
        categoryId: rec.categoryId,
        date: rec.nextDueDate,
        paymentMethod: rec.paymentMethod,
        notes: rec.notes || 'Auto-generated recurring payment',
        recurringId: rec.id,
        createdAt: new Date().toISOString(),
      });
      generatedCount++;

      // Compute next due date
      const currentDate = parseISO(rec.nextDueDate);
      let nextDate = currentDate;
      switch (rec.frequency) {
        case 'daily':
          nextDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          nextDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          nextDate = addMonths(currentDate, 1);
          break;
        case 'yearly':
          nextDate = addYears(currentDate, 1);
          break;
      }

      return {
        ...rec,
        nextDueDate: format(nextDate, 'yyyy-MM-dd'),
      };
    });

    if (generatedCount > 0) {
      setTransactions(prev => [...newTransactionsToAdd, ...prev]);
      setRecurring(updatedRecurring);
    }

    return generatedCount;
  };

  // User Settings Actions
  const updateSettings = (data: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...data }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const resetData = () => {
    const res = resetAllDataToDefault();
    setTransactions(res.transactions);
    setCategories(res.categories);
    setPaymentMethods(res.paymentMethods);
    setBudgets(res.budgets);
    setRecurring(res.recurring);
    setSettings(res.settings);
  };

  const clearData = () => {
    const res = clearAllData();
    setTransactions(res.transactions);
    setBudgets(res.budgets);
    setRecurring(res.recurring);
  };

  const exportJSON = () => {
    const json = exportDataAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trackwise_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    setIsExportModalOpen(true);
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
        saveTransactions(data.transactions);
      }
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
        saveCategories(data.categories);
      }
      if (Array.isArray(data.paymentMethods)) {
        setPaymentMethods(data.paymentMethods);
        savePaymentMethods(data.paymentMethods);
      }
      if (Array.isArray(data.budgets)) {
        setBudgets(data.budgets);
        saveBudgets(data.budgets);
      }
      if (Array.isArray(data.recurring)) {
        setRecurring(data.recurring);
        saveRecurring(data.recurring);
      }
      if (data.settings) {
        setSettings(data.settings);
        saveSettings(data.settings);
      }
      return true;
    } catch (err) {
      console.error('Import failed', err);
      return false;
    }
  };

  return (
    <ExpenseContext.Provider
      value={{
        transactions,
        categories,
        paymentMethods,
        budgets,
        recurring,
        settings,
        filters,
        filteredTransactions,
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRate,
        topSpendingCategory,
        upiBalance,
        cashBalance,
        filteredUpiBalance,
        filteredCashBalance,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCategory,
        updateCategory,
        deleteCategory,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        addBudget,
        updateBudget,
        deleteBudget,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        processDueRecurring,
        updateSettings,
        toggleTheme,
        isDark,
        setFilters,
        resetFilters,
        resetData,
        clearData,
        exportJSON,
        exportCSV,
        isExportModalOpen,
        setIsExportModalOpen,
        openExportModal,
        closeExportModal,
        importJSON,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
};

