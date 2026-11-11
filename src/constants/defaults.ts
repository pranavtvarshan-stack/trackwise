import { Category, Currency, PaymentMethodItem, RecurringTransaction, Transaction, Budget } from '../types';

export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', position: 'prefix' },
  // Additional currencies (commented out for now as requested):
  // { code: 'USD', symbol: '$', name: 'US Dollar', position: 'prefix' },
  // { code: 'EUR', symbol: '€', name: 'Euro', position: 'prefix' },
  // { code: 'GBP', symbol: '£', name: 'British Pound', position: 'prefix' },
  // { code: 'JPY', symbol: '¥', name: 'Japanese Yen', position: 'prefix' },
  // { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', position: 'prefix' },
  // { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', position: 'prefix' },
  // { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', position: 'prefix' },
  // { code: 'AED', symbol: 'AED', name: 'UAE Dirham', position: 'prefix' },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodItem[] = [
  { id: 'upi', label: 'UPI / Fast Pay', icon: 'Smartphone', isDefault: true },
  { id: 'credit_card', label: 'Credit Card', icon: 'CreditCard', isDefault: true },
  { id: 'debit_card', label: 'Debit Card', icon: 'CreditCard', isDefault: true },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: 'Building2', isDefault: true },
  { id: 'cash', label: 'Cash', icon: 'Banknote', isDefault: true },
  { id: 'paypal', label: 'PayPal', icon: 'Wallet', isDefault: true },
  { id: 'other', label: 'Other', icon: 'HelpCircle', isDefault: true },
];

export const PAYMENT_METHODS = DEFAULT_PAYMENT_METHODS;

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense Categories
  { id: 'cat_food', name: 'Food & Dining', icon: 'Utensils', color: '#f97316', type: 'expense', isDefault: true },
  { id: 'cat_groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10b981', type: 'expense', isDefault: true },
  { id: 'cat_housing', name: 'Housing & Rent', icon: 'Home', color: '#6366f1', type: 'expense', isDefault: true },
  { id: 'cat_transport', name: 'Transportation', icon: 'Car', color: '#06b6d4', type: 'expense', isDefault: true },
  { id: 'cat_utilities', name: 'Utilities & Bills', icon: 'Zap', color: '#eab308', type: 'expense', isDefault: true },
  { id: 'cat_entertainment', name: 'Entertainment', icon: 'Film', color: '#ec4899', type: 'expense', isDefault: true },
  { id: 'cat_shopping', name: 'Shopping', icon: 'ShoppingBag', color: '#8b5cf6', type: 'expense', isDefault: true },
  { id: 'cat_health', name: 'Health & Fitness', icon: 'Activity', color: '#ef4444', type: 'expense', isDefault: true },
  { id: 'cat_travel', name: 'Travel & Vacation', icon: 'Plane', color: '#14b8a6', type: 'expense', isDefault: true },
  { id: 'cat_education', name: 'Education', icon: 'BookOpen', color: '#3b82f6', type: 'expense', isDefault: true },
  { id: 'cat_personal', name: 'Personal Care', icon: 'Smile', color: '#f43f5e', type: 'expense', isDefault: true },
  
  // Income Categories
  { id: 'cat_salary', name: 'Salary & Wages', icon: 'Briefcase', color: '#22c55e', type: 'income', isDefault: true },
  { id: 'cat_freelance', name: 'Freelance & Projects', icon: 'Laptop', color: '#3b82f6', type: 'income', isDefault: true },
  { id: 'cat_investment', name: 'Investments & Dividends', icon: 'TrendingUp', color: '#8b5cf6', type: 'income', isDefault: true },
  { id: 'cat_other_income', name: 'Other Income / Gifts', icon: 'Gift', color: '#10b981', type: 'income', isDefault: true },
];

export const INITIAL_BUDGETS: Budget[] = [
  { id: 'b_food', categoryId: 'cat_food', monthlyLimit: 12000, alertThresholdPercentage: 80 },
  { id: 'b_groceries', categoryId: 'cat_groceries', monthlyLimit: 10000, alertThresholdPercentage: 85 },
  { id: 'b_housing', categoryId: 'cat_housing', monthlyLimit: 25000, alertThresholdPercentage: 90 },
  { id: 'b_transport', categoryId: 'cat_transport', monthlyLimit: 5000, alertThresholdPercentage: 80 },
  { id: 'b_entertainment', categoryId: 'cat_entertainment', monthlyLimit: 6000, alertThresholdPercentage: 75 },
  { id: 'b_shopping', categoryId: 'cat_shopping', monthlyLimit: 8000, alertThresholdPercentage: 80 },
  { id: 'b_utilities', categoryId: 'cat_utilities', monthlyLimit: 4000, alertThresholdPercentage: 85 },
];

export const INITIAL_RECURRING: RecurringTransaction[] = [
  {
    id: 'rec_rent',
    title: 'Apartment Rent',
    amount: 22000,
    type: 'expense',
    categoryId: 'cat_housing',
    paymentMethod: 'bank_transfer',
    frequency: 'monthly',
    nextDueDate: '2026-12-01',
    startDate: '2026-01-01',
    active: true,
    notes: 'Monthly apartment rent transfer'
  },
  {
    id: 'rec_salary',
    title: 'Monthly Tech Salary',
    amount: 85000,
    type: 'income',
    categoryId: 'cat_salary',
    paymentMethod: 'bank_transfer',
    frequency: 'monthly',
    nextDueDate: '2026-11-30',
    startDate: '2025-06-01',
    active: true,
    notes: 'Direct salary deposit'
  },
  {
    id: 'rec_netflix',
    title: 'Netflix Premium 4K',
    amount: 649,
    type: 'expense',
    categoryId: 'cat_entertainment',
    paymentMethod: 'credit_card',
    frequency: 'monthly',
    nextDueDate: '2026-11-18',
    startDate: '2025-02-18',
    active: true,
    notes: 'Streaming subscription'
  },
  {
    id: 'rec_gym',
    title: 'Fitness Gym Membership',
    amount: 1500,
    type: 'expense',
    categoryId: 'cat_health',
    paymentMethod: 'upi',
    frequency: 'monthly',
    nextDueDate: '2026-11-25',
    startDate: '2026-01-01',
    active: true,
  },
  {
    id: 'rec_internet',
    title: 'High-speed Fiber Broadband',
    amount: 999,
    type: 'expense',
    categoryId: 'cat_utilities',
    paymentMethod: 'upi',
    frequency: 'monthly',
    nextDueDate: '2026-11-20',
    startDate: '2025-08-01',
    active: true,
  }
];

// Helper to generate sample realistic transactions around current date
export const generateSampleTransactions = (): Transaction[] => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prevMonth = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0');
  const prevYear = now.getMonth() === 0 ? year - 1 : year;

  return [
    {
      id: 'tx-1',
      title: 'Monthly Tech Salary',
      amount: 85000,
      type: 'income',
      categoryId: 'cat_salary',
      date: `${year}-${month}-01`,
      paymentMethod: 'bank_transfer',
      notes: 'Direct deposit for current month',
      tags: ['salary', 'tech'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-2',
      title: 'Apartment Rent Payment',
      amount: 22000,
      type: 'expense',
      categoryId: 'cat_housing',
      date: `${year}-${month}-02`,
      paymentMethod: 'bank_transfer',
      notes: 'Rent via transfer',
      tags: ['rent', 'fixed'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-3',
      title: 'Nature Basket Groceries',
      amount: 3250,
      type: 'expense',
      categoryId: 'cat_groceries',
      date: `${year}-${month}-03`,
      paymentMethod: 'upi',
      notes: 'Weekly fresh vegetables, fruits & pantry essentials',
      tags: ['groceries'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-4',
      title: 'Dinner at Barbeque Nation',
      amount: 2450,
      type: 'expense',
      categoryId: 'cat_food',
      date: `${year}-${month}-05`,
      paymentMethod: 'credit_card',
      notes: 'Dinner with friends',
      tags: ['dinner', 'dining-out'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-5',
      title: 'Petrol Pump Fuel',
      amount: 2200,
      type: 'expense',
      categoryId: 'cat_transport',
      date: `${year}-${month}-06`,
      paymentMethod: 'upi',
      notes: 'Full tank petrol',
      tags: ['car', 'fuel'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-6',
      title: 'Freelance Design Milestone',
      amount: 25000,
      type: 'income',
      categoryId: 'cat_freelance',
      date: `${year}-${month}-07`,
      paymentMethod: 'bank_transfer',
      notes: 'Mobile app UI wireframe delivery',
      tags: ['freelance', 'client'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-7',
      title: 'Supermarket Supplies',
      amount: 1850,
      type: 'expense',
      categoryId: 'cat_groceries',
      date: `${year}-${month}-08`,
      paymentMethod: 'upi',
      notes: 'Snacks, cheeses, and kitchen items',
      tags: ['groceries'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-8',
      title: 'Electricity & Utility Bill',
      amount: 1780,
      type: 'expense',
      categoryId: 'cat_utilities',
      date: `${year}-${month}-09`,
      paymentMethod: 'upi',
      notes: 'Power bill payment',
      tags: ['utilities'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-9',
      title: 'Blue Tokai Coffee & Cafe',
      amount: 480,
      type: 'expense',
      categoryId: 'cat_food',
      date: `${year}-${month}-10`,
      paymentMethod: 'upi',
      notes: 'Cold brew & croissant working from cafe',
      tags: ['coffee'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-10',
      title: 'Amazon - Desk Lamp & Cable Organizers',
      amount: 1899,
      type: 'expense',
      categoryId: 'cat_shopping',
      date: `${year}-${month}-04`,
      paymentMethod: 'credit_card',
      notes: 'Work desk setup items',
      tags: ['shopping', 'wfh'],
      createdAt: new Date().toISOString()
    },
    // Previous month comparison data
    {
      id: 'tx-prev-1',
      title: 'Previous Month Salary',
      amount: 85000,
      type: 'income',
      categoryId: 'cat_salary',
      date: `${prevYear}-${prevMonth}-01`,
      paymentMethod: 'bank_transfer',
      notes: 'Monthly direct deposit',
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-prev-2',
      title: 'Apartment Rent',
      amount: 22000,
      type: 'expense',
      categoryId: 'cat_housing',
      date: `${prevYear}-${prevMonth}-02`,
      paymentMethod: 'bank_transfer',
      notes: 'Rent',
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-prev-3',
      title: 'Mutual Fund Dividend / Yield',
      amount: 4200,
      type: 'income',
      categoryId: 'cat_investment',
      date: `${prevYear}-${prevMonth}-15`,
      paymentMethod: 'bank_transfer',
      notes: 'Monthly mutual fund return',
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-prev-4',
      title: 'Monthly Hypermarket Grocery Run',
      amount: 6800,
      type: 'expense',
      categoryId: 'cat_groceries',
      date: `${prevYear}-${prevMonth}-12`,
      paymentMethod: 'credit_card',
      notes: 'Bulk groceries & household supplies',
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx-prev-5',
      title: 'Weekend Outing & Movies',
      amount: 3400,
      type: 'expense',
      categoryId: 'cat_entertainment',
      date: `${prevYear}-${prevMonth}-20`,
      paymentMethod: 'upi',
      notes: 'IMAX tickets and dinner',
      createdAt: new Date().toISOString()
    }
  ];
};

