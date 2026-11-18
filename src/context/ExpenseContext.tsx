import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
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
  getStoredCategories, 
  getStoredPaymentMethods,
  getStoredBudgets, 
  getStoredRecurring, 
  getStoredSettings, 
  saveSettings,
  resetAllDataToDefault,
  clearAllData,
  exportDataAsJSON,
  exportFullReportAsCSV,
  exportTransactionsAsCSV
} from '../utils/storage';
import {
  loadTransactions,
  saveTransactionsIDB,
  loadBudgets,
  saveBudgetsIDB,
  loadRecurring,
  saveRecurringIDB,
  loadCategories,
  saveCategoriesIDB,
  loadPaymentMethods,
  savePaymentMethodsIDB,
  migrateFromLocalStorageIfPresent,
  initializeEmptyUserDataset,
} from '../utils/idbStorage';
import { useGoogleAuth } from './GoogleAuthContext';
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
  // Active State (excludes soft-deleted tombstones for all UI views & calculations)
  transactions: Transaction[];
  categories: Category[];
  paymentMethods: PaymentMethodItem[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  settings: UserSettings;
  filters: FilterState;

  // Full State (includes soft-deleted tombstones — for multi-device sync engine)
  allTransactions: Transaction[];
  allBudgets: Budget[];
  allRecurring: RecurringTransaction[];

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
  setAllTransactions: (txs: Transaction[]) => void;
  setAllBudgets: (bds: Budget[]) => void;
  setAllRecurring: (recs: RecurringTransaction[]) => void;

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
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>(getStoredTransactions);
  const [categories, setCategories] = useState<Category[]>(getStoredCategories);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(getStoredPaymentMethods);
  const [rawBudgets, setRawBudgets] = useState<Budget[]>(getStoredBudgets);
  const [rawRecurring, setRawRecurring] = useState<RecurringTransaction[]>(getStoredRecurring);
  const [settings, setSettings] = useState<UserSettings>(getStoredSettings);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Active-only views (soft-deleted tombstones are strictly hidden from all UI views, charts, budgets & balance calculations)
  const transactions = useMemo(() => rawTransactions.filter(tx => !tx.isDeleted), [rawTransactions]);
  const budgets = useMemo(() => rawBudgets.filter(b => !b.isDeleted), [rawBudgets]);
  const recurring = useMemo(() => rawRecurring.filter(r => !r.isDeleted), [rawRecurring]);
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

  const { user } = useGoogleAuth();
  const currentNamespace = user?.email || 'guest';
  const [isIDBReady, setIsIDBReady] = useState(false);
  const activeNamespaceRef = useRef(currentNamespace);
  activeNamespaceRef.current = currentNamespace;

  // Asynchronously load and isolate data per user email / guest in IndexedDB
  useEffect(() => {
    let isCurrent = true;
    setIsIDBReady(false);

    const initUserData = async () => {
      try {
        // Step 1: Migrate any legacy localStorage records seamlessly
        await migrateFromLocalStorageIfPresent(currentNamespace);

        // Step 2: Load primary collections from IndexedDB
        const [loadedTx, loadedBudgets, loadedRec, loadedCats, loadedPM] = await Promise.all([
          loadTransactions(currentNamespace),
          loadBudgets(currentNamespace),
          loadRecurring(currentNamespace),
          loadCategories(currentNamespace),
          loadPaymentMethods(currentNamespace),
        ]);

        if (!isCurrent) return;

        // If dataset is completely empty and uninitialized for this namespace
        if (loadedTx.length === 0 && loadedBudgets.length === 0 && loadedRec.length === 0) {
          const initKey = `trackwise_init_${currentNamespace}`;
          if (!localStorage.getItem(initKey)) {
            localStorage.setItem(initKey, 'true');
            const seeded = await initializeEmptyUserDataset(currentNamespace);
            if (!isCurrent) return;
            setRawTransactions(seeded.transactions);
            setRawBudgets(seeded.budgets);
            setRawRecurring(seeded.recurring);
            setCategories(seeded.categories);
            setPaymentMethods(seeded.paymentMethods);
            setIsIDBReady(true);
            return;
          }
        }

        setRawTransactions(loadedTx);
        setRawBudgets(loadedBudgets);
        setRawRecurring(loadedRec);
        setCategories(loadedCats);
        setPaymentMethods(loadedPM);
        setIsIDBReady(true);
      } catch (err) {
        console.error('[TrackWise] Error loading IndexedDB for namespace:', currentNamespace, err);
        setIsIDBReady(true);
      }
    };

    initUserData();

    return () => {
      isCurrent = false;
    };
  }, [currentNamespace]);

  // Asynchronously persist changes to IndexedDB isolated by user namespace
  useEffect(() => {
    if (isIDBReady) {
      saveTransactionsIDB(rawTransactions, currentNamespace);
    }
  }, [rawTransactions, currentNamespace, isIDBReady]);

  useEffect(() => {
    if (isIDBReady) {
      saveCategoriesIDB(categories, currentNamespace);
    }
  }, [categories, currentNamespace, isIDBReady]);

  useEffect(() => {
    if (isIDBReady) {
      savePaymentMethodsIDB(paymentMethods, currentNamespace);
    }
  }, [paymentMethods, currentNamespace, isIDBReady]);

  useEffect(() => {
    if (isIDBReady) {
      saveBudgetsIDB(rawBudgets, currentNamespace);
    }
  }, [rawBudgets, currentNamespace, isIDBReady]);

  useEffect(() => {
    if (isIDBReady) {
      saveRecurringIDB(rawRecurring, currentNamespace);
    }
  }, [rawRecurring, currentNamespace, isIDBReady]);

  // Keep localStorage strictly for lightweight UI flags and user settings
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
        // Exclude soft-deleted items
        if (tx.isDeleted) return false;

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
      if (tx.isDeleted) return acc;
      if (normalizePaymentMethod(tx.paymentMethod) === 'UPI') {
        return tx.type === 'income' ? acc + tx.amount : acc - tx.amount;
      }
      return acc;
    }, 0);
  }, [transactions]);

  const cashBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.isDeleted) return acc;
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

  // Helper for generating standard UUIDs
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  // Transaction Actions (with monotonic rev & soft-delete tombstones)
  const addTransaction = (data: Omit<Transaction, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...data,
      paymentMethod: normalizePaymentMethod(data.paymentMethod),
      id: generateUUID(),
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      rev: 1,
      syncStatus: 'pending',
    };
    setRawTransactions(prev => [newTx, ...prev]);
  };

  const updateTransaction = (id: string, data: Partial<Transaction>) => {
    const now = new Date().toISOString();
    setRawTransactions(prev => prev.map(tx => (tx.id === id ? {
      ...tx,
      ...data,
      paymentMethod: data.paymentMethod ? normalizePaymentMethod(data.paymentMethod) : tx.paymentMethod,
      rev: (tx.rev || 1) + 1,
      updatedAt: now,
      syncStatus: 'pending',
    } : tx)));
  };

  const deleteTransaction = (id: string) => {
    const now = new Date().toISOString();
    setRawTransactions(prev => prev.map(tx => (tx.id === id ? {
      ...tx,
      isDeleted: true,
      rev: (tx.rev || 1) + 1,
      updatedAt: now,
      syncStatus: 'pending',
    } : tx)));
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

  // Budget Actions (with monotonic rev & soft-delete tombstones)
  const addBudget = (data: Omit<Budget, 'id'>) => {
    const now = new Date().toISOString();
    const newBudget: Budget = {
      ...data,
      id: `budget_${Date.now()}`,
      rev: 1,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending',
    };
    setRawBudgets(prev => [...prev, newBudget]);
  };

  const updateBudget = (id: string, data: Partial<Budget>) => {
    const now = new Date().toISOString();
    setRawBudgets(prev => prev.map(b => (b.id === id ? {
      ...b,
      ...data,
      rev: (b.rev || 1) + 1,
      updatedAt: now,
      syncStatus: 'pending',
    } : b)));
  };

  const deleteBudget = (id: string) => {
    const now = new Date().toISOString();
    setRawBudgets(prev => prev.map(b => (b.id === id ? {
      ...b,
      isDeleted: true,
      rev: (b.rev || 1) + 1,
      updatedAt: now,
      syncStatus: 'pending',
    } : b)));
  };

  // Recurring Actions (with monotonic rev & soft-delete tombstones)
  const addRecurring = (data: Omit<RecurringTransaction, 'id'>) => {
    const now = new Date().toISOString();
    const newRec: RecurringTransaction = {
      ...data,
      paymentMethod: normalizePaymentMethod(data.paymentMethod),
      id: `rec_${Date.now()}`,
      rev: 1,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending',
    };
    setRawRecurring(prev => [...prev, newRec]);
  };

  const updateRecurring = (id: string, data: Partial<RecurringTransaction>) => {
    const now = new Date().toISOString();
    setRawRecurring(prev => prev.map(r => (r.id === id ? {
      ...r,
      ...data,
      paymentMethod: data.paymentMethod ? normalizePaymentMethod(data.paymentMethod) : r.paymentMethod,
      rev: (r.rev || 1) + 1,
      updatedAt: now,
      syncStatus: 'pending',
    } : r)));
  };

  const deleteRecurring = (id: string) => {
    const now = new Date().toISOString();
    setRawRecurring(prev => prev.map(r => (r.id === id ? {
      ...r,
      isDeleted: true,
      rev: (r.rev || 1) + 1,
      updatedAt: now,
      syncStatus: 'pending',
    } : r)));
  };

  // Process due recurring transactions and insert them as transactions
  const processDueRecurring = (): number => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date().toISOString();
    let generatedCount = 0;
    const newTransactionsToAdd: Transaction[] = [];

    const updatedRecurring = rawRecurring.map(rec => {
      if (rec.isDeleted || !rec.active || rec.nextDueDate > today) {
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
        paymentMethod: normalizePaymentMethod(rec.paymentMethod),
        notes: rec.notes || 'Auto-generated recurring payment',
        recurringId: rec.id,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        rev: 1,
        syncStatus: 'pending',
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
        rev: (rec.rev || 1) + 1,
        updatedAt: now,
        syncStatus: 'pending' as const,
      };
    });

    if (generatedCount > 0) {
      setRawTransactions(prev => [...newTransactionsToAdd, ...prev]);
      setRawRecurring(updatedRecurring);
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
    setRawTransactions(res.transactions);
    setCategories(res.categories);
    setPaymentMethods(res.paymentMethods);
    setRawBudgets(res.budgets);
    setRawRecurring(res.recurring);
    setSettings(res.settings);
  };

  const clearData = () => {
    // Soft-delete all active records so multi-device Google Sheets sync propagates the wipe
    // cleanly without resurrecting rows on the next pull, and mark storage initialized.
    clearAllData();
    const now = new Date().toISOString();
    setRawTransactions(prev =>
      prev.map(tx =>
        tx.isDeleted
          ? tx
          : { ...tx, isDeleted: true, rev: (tx.rev || 1) + 1, updatedAt: now, syncStatus: 'pending' }
      )
    );
    setRawBudgets(prev =>
      prev.map(b =>
        b.isDeleted
          ? b
          : { ...b, isDeleted: true, rev: (b.rev || 1) + 1, updatedAt: now, syncStatus: 'pending' }
      )
    );
    setRawRecurring(prev =>
      prev.map(r =>
        r.isDeleted
          ? r
          : { ...r, isDeleted: true, rev: (r.rev || 1) + 1, updatedAt: now, syncStatus: 'pending' }
      )
    );
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
      const now = new Date().toISOString();
      if (Array.isArray(data.transactions)) {
        const normalized: Transaction[] = data.transactions.map((tx: Transaction) => ({
          ...tx,
          paymentMethod: normalizePaymentMethod(tx.paymentMethod),
          rev: typeof tx.rev === 'number' && tx.rev >= 1 ? tx.rev : 1,
          updatedAt: tx.updatedAt || tx.createdAt || now,
          isDeleted: Boolean(tx.isDeleted),
        }));
        setRawTransactions(normalized);
      }
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
      if (Array.isArray(data.paymentMethods)) {
        setPaymentMethods(data.paymentMethods);
      }
      if (Array.isArray(data.budgets)) {
        const normalized: Budget[] = data.budgets.map((b: Budget) => ({
          ...b,
          rev: typeof b.rev === 'number' && b.rev >= 1 ? b.rev : 1,
          updatedAt: b.updatedAt || now,
          isDeleted: Boolean(b.isDeleted),
        }));
        setRawBudgets(normalized);
      }
      if (Array.isArray(data.recurring)) {
        const normalized: RecurringTransaction[] = data.recurring.map((r: RecurringTransaction) => ({
          ...r,
          paymentMethod: normalizePaymentMethod(r.paymentMethod),
          rev: typeof r.rev === 'number' && r.rev >= 1 ? r.rev : 1,
          updatedAt: r.updatedAt || now,
          isDeleted: Boolean(r.isDeleted),
        }));
        setRawRecurring(normalized);
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
        allTransactions: rawTransactions,
        allBudgets: rawBudgets,
        allRecurring: rawRecurring,
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
        setAllTransactions: setRawTransactions,
        setAllBudgets: setRawBudgets,
        setAllRecurring: setRawRecurring,
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

