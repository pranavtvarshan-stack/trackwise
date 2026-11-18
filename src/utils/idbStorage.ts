import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  Transaction,
  Budget,
  RecurringTransaction,
  Category,
  PaymentMethodItem,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
  INITIAL_BUDGETS,
  INITIAL_RECURRING,
  generateSampleTransactions,
} from '../constants/defaults';
import { normalizePaymentMethod } from './formatters';

const DB_NAME = 'trackwise_pro_db';
const DB_VERSION = 1;

interface NamespacedItem<T> {
  namespace: string;
  id: string;
  data: T;
}

interface TrackWiseDBSchema extends DBSchema {
  transactions: {
    key: [string, string]; // [namespace, id]
    value: NamespacedItem<Transaction>;
    indexes: { by_namespace: string };
  };
  budgets: {
    key: [string, string];
    value: NamespacedItem<Budget>;
    indexes: { by_namespace: string };
  };
  recurring: {
    key: [string, string];
    value: NamespacedItem<RecurringTransaction>;
    indexes: { by_namespace: string };
  };
  categories: {
    key: [string, string];
    value: NamespacedItem<Category>;
    indexes: { by_namespace: string };
  };
  paymentMethods: {
    key: [string, string];
    value: NamespacedItem<PaymentMethodItem>;
    indexes: { by_namespace: string };
  };
}

let dbPromise: Promise<IDBPDatabase<TrackWiseDBSchema>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<TrackWiseDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TrackWiseDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transactions')) {
          const s = db.createObjectStore('transactions', { keyPath: ['namespace', 'id'] });
          s.createIndex('by_namespace', 'namespace');
        }
        if (!db.objectStoreNames.contains('budgets')) {
          const s = db.createObjectStore('budgets', { keyPath: ['namespace', 'id'] });
          s.createIndex('by_namespace', 'namespace');
        }
        if (!db.objectStoreNames.contains('recurring')) {
          const s = db.createObjectStore('recurring', { keyPath: ['namespace', 'id'] });
          s.createIndex('by_namespace', 'namespace');
        }
        if (!db.objectStoreNames.contains('categories')) {
          const s = db.createObjectStore('categories', { keyPath: ['namespace', 'id'] });
          s.createIndex('by_namespace', 'namespace');
        }
        if (!db.objectStoreNames.contains('paymentMethods')) {
          const s = db.createObjectStore('paymentMethods', { keyPath: ['namespace', 'id'] });
          s.createIndex('by_namespace', 'namespace');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Request persistent storage from the browser to prevent iOS Safari & mobile browsers
 * from evicting offline IndexedDB records under storage pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[TrackWise IDB] Storage persistence locked: ${isPersisted}`);
      return isPersisted;
    } catch (err) {
      console.warn('[TrackWise IDB] Failed to lock storage persistence:', err);
    }
  }
  return false;
}

const normalizeRev = (rev: unknown): number => {
  const num = typeof rev === 'number' ? rev : parseInt(String(rev ?? ''), 10);
  return Number.isFinite(num) && num >= 1 ? Math.floor(num) : 1;
};

/**
 * Load all transactions for a specific user namespace (or 'guest').
 */
export async function loadTransactions(namespace: string = 'guest'): Promise<Transaction[]> {
  const db = await getDatabase();
  const records = await db.getAllFromIndex('transactions', 'by_namespace', namespace);
  return records.map((r) => ({
    ...r.data,
    paymentMethod: normalizePaymentMethod(r.data.paymentMethod),
    rev: normalizeRev(r.data.rev),
    updatedAt: r.data.updatedAt || r.data.createdAt || new Date(0).toISOString(),
    isDeleted: Boolean(r.data.isDeleted),
  }));
}

/**
 * Save all transactions for a specific user namespace (replaces all rows in that namespace).
 */
export async function saveTransactionsIDB(
  transactions: Transaction[],
  namespace: string = 'guest'
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('transactions', 'readwrite');
  const store = tx.objectStore('transactions');

  // Delete existing records for this namespace
  const existingKeys = await store.index('by_namespace').getAllKeys(namespace);
  for (const key of existingKeys) {
    await store.delete(key);
  }

  // Put new records
  for (const item of transactions) {
    await store.put({
      namespace,
      id: item.id,
      data: item,
    });
  }
  await tx.done;
}

/**
 * Load all budgets for a namespace.
 */
export async function loadBudgets(namespace: string = 'guest'): Promise<Budget[]> {
  const db = await getDatabase();
  const records = await db.getAllFromIndex('budgets', 'by_namespace', namespace);
  return records.map((r) => ({
    ...r.data,
    rev: normalizeRev(r.data.rev),
    updatedAt: r.data.updatedAt || new Date(0).toISOString(),
    isDeleted: Boolean(r.data.isDeleted),
  }));
}

/**
 * Save all budgets for a namespace.
 */
export async function saveBudgetsIDB(budgets: Budget[], namespace: string = 'guest'): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('budgets', 'readwrite');
  const store = tx.objectStore('budgets');
  const existingKeys = await store.index('by_namespace').getAllKeys(namespace);
  for (const key of existingKeys) {
    await store.delete(key);
  }
  for (const item of budgets) {
    await store.put({
      namespace,
      id: item.id,
      data: item,
    });
  }
  await tx.done;
}

/**
 * Load all recurring transactions for a namespace.
 */
export async function loadRecurring(namespace: string = 'guest'): Promise<RecurringTransaction[]> {
  const db = await getDatabase();
  const records = await db.getAllFromIndex('recurring', 'by_namespace', namespace);
  return records.map((r) => ({
    ...r.data,
    paymentMethod: normalizePaymentMethod(r.data.paymentMethod),
    rev: normalizeRev(r.data.rev),
    updatedAt: r.data.updatedAt || new Date(0).toISOString(),
    isDeleted: Boolean(r.data.isDeleted),
  }));
}

/**
 * Save all recurring transactions for a namespace.
 */
export async function saveRecurringIDB(
  recurring: RecurringTransaction[],
  namespace: string = 'guest'
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('recurring', 'readwrite');
  const store = tx.objectStore('recurring');
  const existingKeys = await store.index('by_namespace').getAllKeys(namespace);
  for (const key of existingKeys) {
    await store.delete(key);
  }
  for (const item of recurring) {
    await store.put({
      namespace,
      id: item.id,
      data: item,
    });
  }
  await tx.done;
}

/**
 * Load categories for a namespace.
 */
export async function loadCategories(namespace: string = 'guest'): Promise<Category[]> {
  const db = await getDatabase();
  const records = await db.getAllFromIndex('categories', 'by_namespace', namespace);
  if (records.length === 0) {
    // Seed default categories
    await saveCategoriesIDB(DEFAULT_CATEGORIES, namespace);
    return DEFAULT_CATEGORIES;
  }
  return records.map((r) => r.data);
}

/**
 * Save categories for a namespace.
 */
export async function saveCategoriesIDB(
  categories: Category[],
  namespace: string = 'guest'
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const existingKeys = await store.index('by_namespace').getAllKeys(namespace);
  for (const key of existingKeys) {
    await store.delete(key);
  }
  for (const item of categories) {
    await store.put({
      namespace,
      id: item.id,
      data: item,
    });
  }
  await tx.done;
}

/**
 * Load payment methods for a namespace.
 */
export async function loadPaymentMethods(namespace: string = 'guest'): Promise<PaymentMethodItem[]> {
  const db = await getDatabase();
  const records = await db.getAllFromIndex('paymentMethods', 'by_namespace', namespace);
  if (records.length === 0) {
    await savePaymentMethodsIDB(DEFAULT_PAYMENT_METHODS, namespace);
    return DEFAULT_PAYMENT_METHODS;
  }
  return records.map((r) => r.data);
}

/**
 * Save payment methods for a namespace.
 */
export async function savePaymentMethodsIDB(
  methods: PaymentMethodItem[],
  namespace: string = 'guest'
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('paymentMethods', 'readwrite');
  const store = tx.objectStore('paymentMethods');
  const existingKeys = await store.index('by_namespace').getAllKeys(namespace);
  for (const key of existingKeys) {
    await store.delete(key);
  }
  for (const item of methods) {
    await store.put({
      namespace,
      id: item.id,
      data: item,
    });
  }
  await tx.done;
}

/**
 * Seamless Migration: Checks if legacy synchronous localStorage financial data exists.
 * If found, migrates it into IndexedDB under the active namespace and cleans up localStorage,
 * ensuring zero data loss during upgrade and keeping localStorage strictly for UI flags.
 */
export async function migrateFromLocalStorageIfPresent(
  namespace: string = 'guest'
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  const LEGACY_KEYS = {
    TRANSACTIONS: 'trackwise_transactions_v1',
    CATEGORIES: 'trackwise_categories_v1',
    PAYMENT_METHODS: 'trackwise_payment_methods_v1',
    BUDGETS: 'trackwise_budgets_v1',
    RECURRING: 'trackwise_recurring_v1',
    INITIALIZED: 'trackwise_is_initialized_v1',
  };

  const rawTx = localStorage.getItem(LEGACY_KEYS.TRANSACTIONS);
  const rawBudgets = localStorage.getItem(LEGACY_KEYS.BUDGETS);
  const rawRec = localStorage.getItem(LEGACY_KEYS.RECURRING);
  const rawCat = localStorage.getItem(LEGACY_KEYS.CATEGORIES);
  const rawPM = localStorage.getItem(LEGACY_KEYS.PAYMENT_METHODS);

  // If already migrated or empty
  if (!rawTx && !rawBudgets && !rawRec && !rawCat && !rawPM) {
    return false;
  }

  try {
    if (rawTx) {
      const parsed: Transaction[] = JSON.parse(rawTx);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveTransactionsIDB(parsed, namespace);
      }
      localStorage.removeItem(LEGACY_KEYS.TRANSACTIONS);
    }

    if (rawBudgets) {
      const parsed: Budget[] = JSON.parse(rawBudgets);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveBudgetsIDB(parsed, namespace);
      }
      localStorage.removeItem(LEGACY_KEYS.BUDGETS);
    }

    if (rawRec) {
      const parsed: RecurringTransaction[] = JSON.parse(rawRec);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveRecurringIDB(parsed, namespace);
      }
      localStorage.removeItem(LEGACY_KEYS.RECURRING);
    }

    if (rawCat) {
      const parsed: Category[] = JSON.parse(rawCat);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveCategoriesIDB(parsed, namespace);
      }
      localStorage.removeItem(LEGACY_KEYS.CATEGORIES);
    }

    if (rawPM) {
      const parsed: PaymentMethodItem[] = JSON.parse(rawPM);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await savePaymentMethodsIDB(parsed, namespace);
      }
      localStorage.removeItem(LEGACY_KEYS.PAYMENT_METHODS);
    }

    console.log(`[TrackWise IDB] Successfully migrated localStorage financial data to IndexedDB for namespace: ${namespace}`);
    return true;
  } catch (err) {
    console.error('[TrackWise IDB] Failed during localStorage migration:', err);
    return false;
  }
}

/**
 * Initialize financial dataset for a new user/guest if totally empty.
 */
export async function initializeEmptyUserDataset(namespace: string): Promise<{
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  categories: Category[];
  paymentMethods: PaymentMethodItem[];
}> {
  const now = new Date().toISOString();
  const sampleTransactions = generateSampleTransactions().map((tx) => ({
    ...tx,
    paymentMethod: normalizePaymentMethod(tx.paymentMethod),
    rev: 1,
    updatedAt: tx.updatedAt || tx.createdAt || now,
    isDeleted: false,
  }));

  const sampleBudgets = INITIAL_BUDGETS.map((b) => ({
    ...b,
    rev: 1,
    updatedAt: b.updatedAt || now,
    isDeleted: false,
  }));

  const sampleRecurring = INITIAL_RECURRING.map((r) => ({
    ...r,
    paymentMethod: normalizePaymentMethod(r.paymentMethod),
    rev: 1,
    updatedAt: r.updatedAt || now,
    isDeleted: false,
  }));

  await saveTransactionsIDB(sampleTransactions, namespace);
  await saveBudgetsIDB(sampleBudgets, namespace);
  await saveRecurringIDB(sampleRecurring, namespace);
  await saveCategoriesIDB(DEFAULT_CATEGORIES, namespace);
  await savePaymentMethodsIDB(DEFAULT_PAYMENT_METHODS, namespace);

  return {
    transactions: sampleTransactions,
    budgets: sampleBudgets,
    recurring: sampleRecurring,
    categories: DEFAULT_CATEGORIES,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
  };
}

