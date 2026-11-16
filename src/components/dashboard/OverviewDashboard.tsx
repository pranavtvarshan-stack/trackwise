import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  TrendingUp, 
  PiggyBank, 
  Calendar,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  X,
  Filter,
  Smartphone,
  Banknote,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { formatCurrency, formatDateDisplay, formatPercentage, normalizePaymentMethod } from '../../utils/formatters';
import { DateRangePreset } from '../../types';
import { CategoryIcon } from '../common/CategoryIcon';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { format, parseISO, subMonths } from 'date-fns';

interface OverviewDashboardProps {
  onOpenAddModal: () => void;
  onNavigateToTab: (tab: string) => void;
  onEditTransaction: (tx: any) => void;
}

const DATE_RANGE_OPTIONS: { id: DateRangePreset; label: string }[] = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onOpenAddModal,
  onNavigateToTab,
  onEditTransaction,
}) => {
  const { 
    filteredTransactions, 
    transactions,
    categories, 
    budgets, 
    settings, 
    filters, 
    setFilters,
    totalIncome, 
    totalExpenses, 
    netSavings, 
    savingsRate,
    topSpendingCategory,
    upiBalance,
    cashBalance,
    isDark
  } = useExpense();

  // Category map
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Chart Data: Category Breakdown for Expenses
  const categoryChartData = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
      });

    return Object.entries(totals)
      .map(([catId, amount]) => {
        const cat = categoryMap.get(catId);
        return {
          name: cat ? cat.name : 'Other',
          value: Math.round(amount * 100) / 100,
          color: cat ? cat.color : '#94a3b8',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categoryMap]);

  // Chart Data: Monthly Cashflow Trend (Past 6 months based on all transactions)
  const cashflowTrendData = useMemo(() => {
    const monthMap: Record<string, { month: string; income: number; expense: number; rawDate: string }> = {};

    transactions.forEach((tx) => {
      try {
        const d = parseISO(tx.date);
        const key = format(d, 'yyyy-MM');
        const monthLabel = format(d, 'MMM yy');

        if (!monthMap[key]) {
          monthMap[key] = { month: monthLabel, income: 0, expense: 0, rawDate: key };
        }

        if (tx.type === 'income') {
          monthMap[key].income += tx.amount;
        } else {
          monthMap[key].expense += tx.amount;
        }
      } catch {
        // ignore invalid dates
      }
    });

    const sortedMonths = Object.values(monthMap)
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-6);

    return sortedMonths.length > 0
      ? sortedMonths
      : [{ month: format(new Date(), 'MMM yy'), income: 0, expense: 0, rawDate: '' }];
  }, [transactions]);

  // Compute spend for current month budgets
  const budgetStatusList = useMemo(() => {
    const now = new Date();
    const currentMonthKey = format(now, 'yyyy-MM');
    const monthlyCategorySpends: Record<string, number> = {};

    transactions
      .filter((tx) => tx.type === 'expense' && tx.date.startsWith(currentMonthKey))
      .forEach((tx) => {
        monthlyCategorySpends[tx.categoryId] = (monthlyCategorySpends[tx.categoryId] || 0) + tx.amount;
      });

    return budgets.map((b) => {
      const category = categoryMap.get(b.categoryId);
      const spent = monthlyCategorySpends[b.categoryId] || 0;
      const percentage = Math.round((spent / b.monthlyLimit) * 100);
      const isOver = spent >= b.monthlyLimit;
      const isWarning = spent >= (b.monthlyLimit * b.alertThresholdPercentage) / 100;

      return {
        ...b,
        category,
        spent,
        percentage,
        isOver,
        isWarning,
      };
    });
  }, [budgets, transactions, categoryMap]);

  // Over-budget alerts
  const overBudgets = budgetStatusList.filter((b) => b.isOver);
  const warningBudgets = budgetStatusList.filter((b) => b.isWarning && !b.isOver);

  // Month-over-Month Expense Comparison
  const momExpenseChange = useMemo(() => {
    const now = new Date();
    const thisMonthKey = format(now, 'yyyy-MM');
    const lastMonthKey = format(subMonths(now, 1), 'yyyy-MM');

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        if (tx.date.startsWith(thisMonthKey)) {
          thisMonthTotal += tx.amount;
        } else if (tx.date.startsWith(lastMonthKey)) {
          lastMonthTotal += tx.amount;
        }
      }
    });

    if (lastMonthTotal === 0) return null;
    const diff = thisMonthTotal - lastMonthTotal;
    const percentChange = (diff / lastMonthTotal) * 100;
    return {
      diff,
      percentChange: Math.round(percentChange * 10) / 10,
      isHigher: diff > 0,
    };
  }, [transactions]);

  // Expansion and Drill-down State
  const [expandedCard, setExpandedCard] = useState<'savings' | 'income' | 'expense' | 'category' | null>(null);
  const [walletTab, setWalletTab] = useState<'all' | 'upi' | 'cash'>('all');
  const expandedPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expandedCard && expandedPanelRef.current) {
      expandedPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expandedCard]);

  // Derived filtered transaction sets for expansions
  const incomeTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.type === 'income');
  }, [filteredTransactions]);

  const expenseTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.type === 'expense');
  }, [filteredTransactions]);

  const topCategoryTransactions = useMemo(() => {
    if (!topSpendingCategory.category) return [];
    return filteredTransactions.filter(
      (tx) => tx.type === 'expense' && tx.categoryId === topSpendingCategory.category?.id
    );
  }, [filteredTransactions, topSpendingCategory]);

  const topCategoryPercentage = totalExpenses > 0
    ? Math.round((topSpendingCategory.amount / totalExpenses) * 100)
    : 0;

  const topCategoryBudget = useMemo(() => {
    if (!topSpendingCategory.category) return null;
    return budgetStatusList.find((b) => b.categoryId === topSpendingCategory.category?.id);
  }, [budgetStatusList, topSpendingCategory]);

  // Wallet in-period split stats
  const walletStats = useMemo(() => {
    let periodUpiIncome = 0;
    let periodUpiExpense = 0;
    let periodCashIncome = 0;
    let periodCashExpense = 0;

    filteredTransactions.forEach((tx) => {
      const isUpi = normalizePaymentMethod(tx.paymentMethod) === 'UPI';
      if (tx.type === 'income') {
        if (isUpi) periodUpiIncome += tx.amount;
        else periodCashIncome += tx.amount;
      } else {
        if (isUpi) periodUpiExpense += tx.amount;
        else periodCashExpense += tx.amount;
      }
    });

    return {
      periodUpiIncome,
      periodUpiExpense,
      periodUpiNet: periodUpiIncome - periodUpiExpense,
      periodCashIncome,
      periodCashExpense,
      periodCashNet: periodCashIncome - periodCashExpense,
    };
  }, [filteredTransactions]);

  const upiTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => normalizePaymentMethod(tx.paymentMethod) === 'UPI');
  }, [filteredTransactions]);

  const cashTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => normalizePaymentMethod(tx.paymentMethod) === 'Cash');
  }, [filteredTransactions]);

  const savingsTransactions = useMemo(() => {
    if (walletTab === 'upi') return upiTransactions;
    if (walletTab === 'cash') return cashTransactions;
    return filteredTransactions;
  }, [filteredTransactions, upiTransactions, cashTransactions, walletTab]);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, { categoryName: string; amount: number; color: string }> = {};
    incomeTransactions.forEach((tx) => {
      const cat = categoryMap.get(tx.categoryId);
      const catId = tx.categoryId || 'other';
      if (!map[catId]) {
        map[catId] = {
          categoryName: cat?.name || 'Income',
          amount: 0,
          color: cat?.color || '#10b981',
        };
      }
      map[catId].amount += tx.amount;
    });
    return Object.values(map);
  }, [incomeTransactions, categoryMap]);

  // Reusable transaction row renderer for expanded lists
  const renderTransactionRow = (tx: (typeof filteredTransactions)[0]) => {
    const cat = categoryMap.get(tx.categoryId);
    const isExpense = tx.type === 'expense';
    const isUpi = normalizePaymentMethod(tx.paymentMethod) === 'UPI';

    return (
      <div
        key={tx.id}
        onClick={() => onEditTransaction(tx)}
        className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors duration-150 group border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/60"
        title="Click to view/edit details"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs"
            style={{
              backgroundColor: `${cat?.color || '#94a3b8'}20`,
              color: cat?.color || '#64748b',
            }}
          >
            <CategoryIcon name={cat?.icon || 'Tag'} size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {tx.title}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500">
              <span className="font-medium text-slate-600 dark:text-slate-400 truncate max-w-[90px] sm:max-w-none">
                {cat?.name || 'Uncategorized'}
              </span>
              <span>•</span>
              <span className="whitespace-nowrap">{formatDateDisplay(tx.date)}</span>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 sm:px-2 py-0.5 rounded-md border ${
              isUpi
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/50'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50'
            }`}
          >
            {isUpi ? <Smartphone size={10} /> : <Banknote size={10} />}
            <span>{isUpi ? 'UPI' : 'Cash'}</span>
          </span>
          <div className="text-right min-w-[65px] sm:min-w-[80px]">
            <p
              className={`text-xs sm:text-sm font-black tracking-tight ${
                isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isExpense ? '-' : '+'}
              {formatCurrency(tx.amount, settings.currency, settings.showDecimals)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-2.5 sm:p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 px-2">
          <Calendar size={15} className="text-indigo-600 dark:text-indigo-400" />
          <span>Period:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilters((prev) => ({ ...prev, dateRange: opt.id }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                filters.dateRange === opt.id
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-600 dark:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Over-budget Banner Alert if any */}
      {overBudgets.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-rose-50 to-orange-50/80 dark:from-rose-950/40 dark:to-orange-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-xs shadow-rose-500/20 flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                Budget Exceeded in {overBudgets.length} Categor{overBudgets.length > 1 ? 'ies' : 'y'}!
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                {overBudgets.map((b) => b.category?.name).join(', ')} exceeded monthly spending limits.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('budgets')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            Manage Budgets
          </button>
        </div>
      )}

      {/* Top Stat Cards - Expandable in both Mobile and Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Savings / Balance */}
        <div
          onClick={() => {
            setExpandedCard((prev) => (prev === 'savings' ? null : 'savings'));
            setWalletTab('all');
          }}
          className={`bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${
            expandedCard === 'savings'
              ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
              : 'border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              Net Savings
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`p-2 rounded-xl flex-shrink-0 shadow-2xs ${
                  netSavings >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/60'
                }`}
              >
                <Wallet size={16} className="sm:w-[17px] sm:h-[17px]" />
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  expandedCard === 'savings'
                    ? 'rotate-180 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`}
              />
            </div>
          </div>
          <div
            className={`text-lg sm:text-2xl font-black tracking-tight truncate ${
              netSavings >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(netSavings, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs flex items-center justify-between font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1 truncate">
              <span>Savings Rate:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded-md ${
                  savingsRate >= 20
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                }`}
              >
                {formatPercentage(savingsRate)}
              </span>
            </div>
          </div>

          {/* Split Wallets (UPI vs Liquid Cash) - Clean vertical layout with ample breathing room */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCard('savings');
                setWalletTab('upi');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-150 active:scale-95 text-left ${
                expandedCard === 'savings' && walletTab === 'upi'
                  ? 'bg-indigo-100/90 dark:bg-indigo-900/60 border border-indigo-500 shadow-xs'
                  : 'bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100/70 dark:border-indigo-900/40 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40'
              }`}
              title="Click to view UPI breakdown"
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <Smartphone size={11} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  UPI
                </span>
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums pl-2">
                {formatCurrency(upiBalance, settings.currency, settings.showDecimals)}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCard('savings');
                setWalletTab('cash');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-150 active:scale-95 text-left ${
                expandedCard === 'savings' && walletTab === 'cash'
                  ? 'bg-emerald-100/90 dark:bg-emerald-900/60 border border-emerald-500 shadow-xs'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-100/70 dark:border-emerald-900/40 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40'
              }`}
              title="Click to view Cash breakdown"
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <Banknote size={11} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Cash
                </span>
              </div>
              <span
                className={`text-xs font-black tabular-nums pl-2 ${
                  cashBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatCurrency(cashBalance, settings.currency, settings.showDecimals)}
              </span>
            </button>
          </div>
        </div>

        {/* Total Income */}
        <div
          onClick={() => setExpandedCard((prev) => (prev === 'income' ? null : 'income'))}
          className={`bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${
            expandedCard === 'income'
              ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
              : 'border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              Total Income
            </span>
            <div className="flex items-center gap-1.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 flex-shrink-0 shadow-2xs">
                <ArrowUpRight size={16} className="sm:w-[17px] sm:h-[17px]" />
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  expandedCard === 'income'
                    ? 'rotate-180 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`}
              />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
            {formatCurrency(totalIncome, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
            <span>{incomeTransactions.length} source(s)</span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
              {expandedCard === 'income' ? 'Hide' : 'View all'}
            </span>
          </div>
        </div>

        {/* Total Expenses */}
        <div
          onClick={() => setExpandedCard((prev) => (prev === 'expense' ? null : 'expense'))}
          className={`bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${
            expandedCard === 'expense'
              ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/30 shadow-md'
              : 'border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              Total Expenses
            </span>
            <div className="flex items-center gap-1.5">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/60 flex-shrink-0 shadow-2xs">
                <ArrowDownRight size={16} className="sm:w-[17px] sm:h-[17px]" />
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  expandedCard === 'expense'
                    ? 'rotate-180 text-rose-600 dark:text-rose-400'
                    : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`}
              />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 truncate">
            {formatCurrency(totalExpenses, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
            <span>{expenseTransactions.length} expense(s)</span>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 group-hover:underline">
              {expandedCard === 'expense' ? 'Hide' : 'View all'}
            </span>
          </div>
        </div>

        {/* Top Spending Category */}
        <div
          onClick={() => setExpandedCard((prev) => (prev === 'category' ? null : 'category'))}
          className={`bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${
            expandedCard === 'category'
              ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
              : 'border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              Top Category
            </span>
            <div className="flex items-center gap-1.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60 flex-shrink-0 shadow-2xs">
                <TrendingUp size={16} className="sm:w-[17px] sm:h-[17px]" />
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  expandedCard === 'category'
                    ? 'rotate-180 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`}
              />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
            {topSpendingCategory.category ? topSpendingCategory.category.name : 'None'}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between truncate">
            {topSpendingCategory.amount > 0 ? (
              <>
                <span className="text-slate-700 dark:text-slate-300 font-bold truncate">
                  {formatCurrency(topSpendingCategory.amount, settings.currency, settings.showDecimals)}
                </span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                  {expandedCard === 'category' ? 'Hide' : 'View all'}
                </span>
              </>
            ) : (
              'No expense data'
            )}
          </div>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {expandedCard && (
        <div
          ref={expandedPanelRef}
          className="w-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border-2 border-indigo-500/30 dark:border-indigo-500/40 shadow-xl animate-fade-in transition-all"
        >
          {/* Card 1: Net Savings & Wallet Breakdown */}
          {expandedCard === 'savings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60 shadow-2xs">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      Wallet & Savings Breakdown
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
                      Live balances and account activity for the active period
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Close breakdown"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Both Wallet Cards Side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* UPI Wallet Card */}
                <div
                  onClick={() => setWalletTab('upi')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                    walletTab === 'upi'
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                      : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                        <Smartphone size={13} />
                      </div>
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">UPI / Online Balance</span>
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {formatCurrency(upiBalance, settings.currency, settings.showDecimals)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px] sm:text-[11px]">
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">Period In</p>
                      <p className="font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                        +{formatCurrency(walletStats.periodUpiIncome, settings.currency, false)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">Period Out</p>
                      <p className="font-extrabold text-rose-600 dark:text-rose-400 truncate">
                        -{formatCurrency(walletStats.periodUpiExpense, settings.currency, false)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">Period Net</p>
                      <p
                        className={`font-extrabold truncate ${
                          walletStats.periodUpiNet >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatCurrency(walletStats.periodUpiNet, settings.currency, false)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cash Wallet Card */}
                <div
                  onClick={() => setWalletTab('cash')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                    walletTab === 'cash'
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                        <Banknote size={13} />
                      </div>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Cash in Hand</span>
                    </div>
                    <span
                      className={`text-xs font-black ${
                        cashBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {formatCurrency(cashBalance, settings.currency, settings.showDecimals)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px] sm:text-[11px]">
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">Period In</p>
                      <p className="font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                        +{formatCurrency(walletStats.periodCashIncome, settings.currency, false)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">Period Out</p>
                      <p className="font-extrabold text-rose-600 dark:text-rose-400 truncate">
                        -{formatCurrency(walletStats.periodCashExpense, settings.currency, false)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">Period Net</p>
                      <p
                        className={`font-extrabold truncate ${
                          walletStats.periodCashNet >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatCurrency(walletStats.periodCashNet, settings.currency, false)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setWalletTab('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                      walletTab === 'all'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    All ({filteredTransactions.length})
                  </button>
                  <button
                    onClick={() => setWalletTab('upi')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                      walletTab === 'upi'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    UPI ({upiTransactions.length})
                  </button>
                  <button
                    onClick={() => setWalletTab('cash')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                      walletTab === 'cash'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Cash ({cashTransactions.length})
                  </button>
                </div>
                <button
                  onClick={() => onNavigateToTab('transactions')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 whitespace-nowrap ml-2"
                >
                  <span>Ledger</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              {/* Transactions List */}
              <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
                {savingsTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    No transactions found for this wallet selection in this period.
                  </div>
                ) : (
                  savingsTransactions.map((tx) => renderTransactionRow(tx))
                )}
              </div>
            </div>
          )}

          {/* Card 2: Total Income */}
          {expandedCard === 'income' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 shadow-2xs">
                    <ArrowUpRight size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      All Income Sources ({incomeTransactions.length})
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
                      Total:{' '}
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totalIncome, settings.currency, settings.showDecimals)}
                      </span>{' '}
                      credited in this period
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Close breakdown"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Income Categories Chips */}
              {incomeByCategory.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {incomeByCategory.map((cat, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap border border-slate-200/50 dark:border-slate-700/50"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span>{cat.categoryName}:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                        {formatCurrency(cat.amount, settings.currency, false)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Transactions List */}
              <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
                {incomeTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    <p>No income transactions recorded for this period.</p>
                    <button
                      onClick={onOpenAddModal}
                      className="mt-2.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>Add Income</span>
                    </button>
                  </div>
                ) : (
                  incomeTransactions.map((tx) => renderTransactionRow(tx))
                )}
              </div>
            </div>
          )}

          {/* Card 3: Total Expenses */}
          {expandedCard === 'expense' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/60 shadow-2xs">
                    <ArrowDownRight size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      All Expense Transactions ({expenseTransactions.length})
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
                      Total:{' '}
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {formatCurrency(totalExpenses, settings.currency, settings.showDecimals)}
                      </span>{' '}
                      spent in this period
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Close breakdown"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick Split Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <div className="px-2.5 py-1 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1.5 whitespace-nowrap">
                  <Smartphone size={12} />
                  <span>UPI Expenses:</span>
                  <span className="font-extrabold text-rose-600 dark:text-rose-400">
                    {formatCurrency(walletStats.periodUpiExpense, settings.currency, settings.showDecimals)}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-1.5 whitespace-nowrap">
                  <Banknote size={12} />
                  <span>Cash Expenses:</span>
                  <span className="font-extrabold text-rose-600 dark:text-rose-400">
                    {formatCurrency(walletStats.periodCashExpense, settings.currency, settings.showDecimals)}
                  </span>
                </div>
              </div>

              {/* Transactions List */}
              <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
                {expenseTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    <p>No expense transactions recorded for this period.</p>
                    <button
                      onClick={onOpenAddModal}
                      className="mt-2.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>Add Expense</span>
                    </button>
                  </div>
                ) : (
                  expenseTransactions.map((tx) => renderTransactionRow(tx))
                )}
              </div>
            </div>
          )}

          {/* Card 4: Top Category */}
          {expandedCard === 'category' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60 shadow-2xs">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      {topSpendingCategory.category
                        ? `${topSpendingCategory.category.name} Expenses`
                        : 'Top Category Expenses'}{' '}
                      ({topCategoryTransactions.length})
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
                      Total:{' '}
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(topSpendingCategory.amount, settings.currency, settings.showDecimals)}
                      </span>{' '}
                      • {topCategoryPercentage}% of total period spending
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Close breakdown"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Budget Progress if exists */}
              {topCategoryBudget && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Monthly Budget Utilization
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {formatCurrency(topCategoryBudget.spent, settings.currency, false)} /{' '}
                      {formatCurrency(topCategoryBudget.monthlyLimit, settings.currency, false)} (
                      {topCategoryBudget.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        topCategoryBudget.isOver
                          ? 'bg-rose-500'
                          : topCategoryBudget.isWarning
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(topCategoryBudget.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Transactions List */}
              <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
                {topCategoryTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    No transactions found for this category in this period.
                  </div>
                ) : (
                  topCategoryTransactions.map((tx) => renderTransactionRow(tx))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Cashflow Trend (Income vs Expense) */}
        <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Cash Flow History</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Monthly Income vs. Spending balance</p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs"></span>
                <span>Income</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 rounded-lg text-rose-800 dark:text-rose-300 border border-rose-100 dark:border-rose-800/60">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-2xs"></span>
                <span>Expense</span>
              </div>
            </div>
          </div>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowTrendData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <XAxis dataKey="month" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: number) => formatCurrency(val, settings.currency, settings.showDecimals)}
                  itemStyle={{
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
                  labelStyle={{
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
                  contentStyle={
                    isDark
                      ? {
                          borderRadius: '16px',
                          background: 'rgba(15, 23, 42, 0.96)',
                          backdropFilter: 'blur(16px)',
                          border: '1px solid rgba(51, 65, 85, 0.8)',
                          boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.5)',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '12px',
                        }
                      : {
                          borderRadius: '16px',
                          background: 'rgba(255, 255, 255, 0.96)',
                          backdropFilter: 'blur(16px)',
                          border: '1px solid rgba(226, 232, 240, 0.8)',
                          boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.08)',
                          color: '#0f172a',
                          fontWeight: 600,
                          fontSize: '12px',
                        }
                  }
                />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Category Breakdown Donut */}
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Category Share</h3>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Expenses</span>
          </div>
          {categoryChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
              <PiggyBank size={36} className="mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
              <p className="text-xs">No expense data found for this period</p>
            </div>
          ) : (
            <>
              <div className="h-48 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val, settings.currency, settings.showDecimals)}
                      itemStyle={{
                        color: isDark ? '#ffffff' : '#0f172a',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                      labelStyle={{
                        color: isDark ? '#ffffff' : '#0f172a',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                      contentStyle={
                        isDark
                          ? {
                              borderRadius: '16px',
                              background: 'rgba(15, 23, 42, 0.96)',
                              backdropFilter: 'blur(16px)',
                              border: '1px solid rgba(51, 65, 85, 0.8)',
                              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.5)',
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: '12px',
                            }
                          : {
                              borderRadius: '16px',
                              background: 'rgba(255, 255, 255, 0.96)',
                              backdropFilter: 'blur(16px)',
                              border: '1px solid rgba(226, 232, 240, 0.8)',
                              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.08)',
                              color: '#0f172a',
                              fontWeight: 600,
                              fontSize: '12px',
                            }
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                {categoryChartData.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 dark:text-slate-300 truncate font-semibold">{item.name}</span>
                    </div>
                    <span className="text-slate-900 dark:text-white font-bold whitespace-nowrap ml-2">
                      {formatCurrency(item.value, settings.currency, false)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Two Columns: Recent Transactions & Active Budget Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List */}
        <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Recent Transactions</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Latest recorded activity in ledger</p>
            </div>
            <button
              onClick={() => onNavigateToTab('transactions')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-all hover:translate-x-0.5"
            >
              <span>View All</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
              <p className="text-sm">No transactions found for this period.</p>
              <button
                onClick={onOpenAddModal}
                className="mt-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition shadow-2xs"
              >
                + Add your first transaction
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredTransactions.slice(0, 6).map((tx) => {
                const cat = categoryMap.get(tx.categoryId);
                const isExpense = tx.type === 'expense';
                return (
                  <div
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 -mx-2 px-3 rounded-xl cursor-pointer transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: `${cat?.color || '#94a3b8'}20`,
                          color: cat?.color || '#64748b',
                        }}
                      >
                        <CategoryIcon name={cat?.icon || 'Tag'} size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{tx.title}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                          <span className="font-medium text-slate-500 dark:text-slate-400">{cat?.name || 'Uncategorized'}</span>
                          <span>•</span>
                          <span>{formatDateDisplay(tx.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-bold tracking-tight ${
                          isExpense ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatCurrency(tx.amount, settings.currency, settings.showDecimals)}
                      </p>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                        {tx.paymentMethod.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Budget Health Overview */}
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Budget Progress</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Monthly category limit tracker</p>
              </div>
              <button
                onClick={() => onNavigateToTab('budgets')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-all hover:translate-x-0.5"
              >
                <span>Manage</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {budgetStatusList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                No budgets set up yet. Set monthly limits to track your habits.
              </div>
            ) : (
              <div className="space-y-4">
                {budgetStatusList.slice(0, 4).map((b) => {
                  let barColor = 'bg-emerald-500';
                  if (b.isOver) barColor = 'bg-rose-500';
                  else if (b.isWarning) barColor = 'bg-amber-500';

                  return (
                    <div key={b.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {b.category?.name || 'Budget'}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">
                          {formatCurrency(b.spent, settings.currency, false)} / {formatCurrency(b.monthlyLimit, settings.currency, false)}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100/90 dark:bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                        <div
                          className={`h-full rounded-full transition-all duration-500 shadow-2xs ${barColor}`}
                          style={{ width: `${Math.min(b.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{budgetStatusList.length} total active budget limits</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {overBudgets.length > 0 ? `${overBudgets.length} exceeded` : 'All healthy'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

