import React, { useMemo } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  TrendingUp, 
  PiggyBank, 
  Calendar,
  AlertTriangle,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { formatCurrency, formatDateDisplay, formatPercentage } from '../../utils/formatters';
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
    topSpendingCategory 
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

  return (
    <div className="space-y-6">
      {/* Date Range Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-xl p-2.5 sm:p-3 rounded-2xl border border-slate-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 px-2">
          <Calendar size={15} className="text-indigo-600" />
          <span>Period:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilters((prev) => ({ ...prev, dateRange: opt.id }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                filters.dateRange === opt.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Over-budget Banner Alert if any */}
      {overBudgets.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-rose-50 to-orange-50/80 border border-rose-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-xs shadow-rose-500/20 flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950">
                Budget Exceeded in {overBudgets.length} Categor{overBudgets.length > 1 ? 'ies' : 'y'}!
              </h4>
              <p className="text-xs text-rose-700">
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

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Savings / Balance */}
        <div className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">Net Savings</span>
            <div className={`p-2 rounded-xl flex-shrink-0 shadow-2xs ${netSavings >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
              <Wallet size={16} className="sm:w-[17px] sm:h-[17px]" />
            </div>
          </div>
          <div className={`text-lg sm:text-2xl font-black tracking-tight truncate ${netSavings >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(netSavings, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs flex items-center gap-1 font-medium text-slate-500 truncate">
            <span>Savings Rate:</span>
            <span className={`font-bold px-1.5 py-0.5 rounded-md ${savingsRate >= 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {formatPercentage(savingsRate)}
            </span>
          </div>
        </div>

        {/* Total Income */}
        <div className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">Total Income</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0 shadow-2xs">
              <ArrowUpRight size={16} className="sm:w-[17px] sm:h-[17px]" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black tracking-tight text-emerald-600 truncate">
            {formatCurrency(totalIncome, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium truncate">
            {filteredTransactions.filter((t) => t.type === 'income').length} income source(s)
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">Total Expenses</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex-shrink-0 shadow-2xs">
              <ArrowDownRight size={16} className="sm:w-[17px] sm:h-[17px]" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black tracking-tight text-rose-600 truncate">
            {formatCurrency(totalExpenses, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium truncate">
            {filteredTransactions.filter((t) => t.type === 'expense').length} expense(s)
          </div>
        </div>

        {/* Top Spending Category */}
        <div className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">Top Category</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0 shadow-2xs">
              <TrendingUp size={16} className="sm:w-[17px] sm:h-[17px]" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black tracking-tight text-slate-900 truncate">
            {topSpendingCategory.category ? topSpendingCategory.category.name : 'None'}
          </div>
          <div className="mt-2 text-[11px] sm:text-xs text-slate-500 font-medium truncate">
            {topSpendingCategory.amount > 0 ? (
              <span className="text-slate-700 font-bold truncate">
                {formatCurrency(topSpendingCategory.amount, settings.currency, false)}
              </span>
            ) : (
              'No expense data'
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Cashflow Trend (Income vs Expense) */}
        <div className="lg:col-span-2 bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Cash Flow History</h3>
              <p className="text-xs text-slate-400 font-medium">Monthly Income vs. Spending balance</p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-lg text-emerald-800 border border-emerald-100">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs"></span>
                <span>Income</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 rounded-lg text-rose-800 border border-rose-100">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-2xs"></span>
                <span>Expense</span>
              </div>
            </div>
          </div>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowTrendData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: number) => formatCurrency(val, settings.currency, settings.showDecimals)}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    background: 'rgba(255, 255, 255, 0.96)', 
                    backdropFilter: 'blur(16px)', 
                    border: '1px solid rgba(226, 232, 240, 0.8)', 
                    boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.08)',
                    fontWeight: 600,
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Category Breakdown Donut */}
        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Category Share</h3>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Expenses</span>
          </div>
          {categoryChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <PiggyBank size={36} className="mb-2 stroke-1 text-slate-300" />
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
                      contentStyle={{ 
                        borderRadius: '16px', 
                        background: 'rgba(255, 255, 255, 0.96)', 
                        backdropFilter: 'blur(16px)', 
                        border: '1px solid rgba(226, 232, 240, 0.8)', 
                        boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.08)',
                        fontWeight: 600,
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                {categoryChartData.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs p-1 rounded-lg hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 truncate font-semibold">{item.name}</span>
                    </div>
                    <span className="text-slate-900 font-bold whitespace-nowrap ml-2">
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
        <div className="lg:col-span-2 bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Recent Transactions</h3>
              <p className="text-xs text-slate-400 font-medium">Latest recorded activity in ledger</p>
            </div>
            <button
              onClick={() => onNavigateToTab('transactions')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all hover:translate-x-0.5"
            >
              <span>View All</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">No transactions found for this period.</p>
              <button
                onClick={onOpenAddModal}
                className="mt-3 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-2xs"
              >
                + Add your first transaction
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransactions.slice(0, 6).map((tx) => {
                const cat = categoryMap.get(tx.categoryId);
                const isExpense = tx.type === 'expense';
                return (
                  <div
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 -mx-2 px-3 rounded-xl cursor-pointer transition-colors duration-150"
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
                        <p className="text-sm font-bold text-slate-800 truncate">{tx.title}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-medium text-slate-500">{cat?.name || 'Uncategorized'}</span>
                          <span>•</span>
                          <span>{formatDateDisplay(tx.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-bold tracking-tight ${
                          isExpense ? 'text-slate-900' : 'text-emerald-600'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatCurrency(tx.amount, settings.currency, settings.showDecimals)}
                      </p>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
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
        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Budget Progress</h3>
                <p className="text-xs text-slate-400 font-medium">Monthly category limit tracker</p>
              </div>
              <button
                onClick={() => onNavigateToTab('budgets')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all hover:translate-x-0.5"
              >
                <span>Manage</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {budgetStatusList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
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
                        <span className="font-bold text-slate-800 truncate">
                          {b.category?.name || 'Budget'}
                        </span>
                        <span className="text-slate-500 font-semibold">
                          {formatCurrency(b.spent, settings.currency, false)} / {formatCurrency(b.monthlyLimit, settings.currency, false)}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100/90 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
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

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{budgetStatusList.length} total active budget limits</span>
            <span className="font-semibold text-indigo-600">
              {overBudgets.length > 0 ? `${overBudgets.length} exceeded` : 'All healthy'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

