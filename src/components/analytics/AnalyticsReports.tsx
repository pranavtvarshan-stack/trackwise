import React, { useMemo } from 'react';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  FileDown
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { formatCurrency, formatPercentage, normalizePaymentMethod } from '../../utils/formatters';
import { PAYMENT_METHODS } from '../../constants/defaults';
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
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { format, parseISO, getDay } from 'date-fns';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AnalyticsReports: React.FC = () => {
  const { filteredTransactions, categories, paymentMethods, settings, totalExpenses, totalIncome, exportCSV, isDark } = useExpense();

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Category detailed breakdown stats
  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        if (!map[t.categoryId]) {
          map[t.categoryId] = { count: 0, total: 0 };
        }
        map[t.categoryId].count++;
        map[t.categoryId].total += t.amount;
      });

    return Object.entries(map)
      .map(([catId, data]) => {
        const cat = categoryMap.get(catId);
        const percent = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
        return {
          catId,
          name: cat?.name || 'Other',
          icon: cat?.icon || 'Tag',
          color: cat?.color || '#64748b',
          total: data.total,
          count: data.count,
          average: data.total / data.count,
          percentage: percent,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, categoryMap, totalExpenses]);

  // Payment method distribution (Split UPI vs Cash)
  const paymentMethodData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const pmKey = normalizePaymentMethod(t.paymentMethod);
        map[pmKey] = (map[pmKey] || 0) + t.amount;
      });

    const pmColorMap: Record<string, string> = {
      UPI: '#6366f1',
      Cash: '#10b981',
    };

    return Object.entries(map)
      .map(([pmId, amount]) => {
        const label = pmId === 'UPI' ? 'UPI / Online' : pmId === 'Cash' ? 'Liquid Cash' : pmId;
        return {
          name: label,
          value: Math.round(amount * 100) / 100,
          color: pmColorMap[pmId] || '#64748b',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Day of week spending analysis
  const dayOfWeekData = useMemo(() => {
    const daysTotal = [0, 0, 0, 0, 0, 0, 0];
    const daysCount = [0, 0, 0, 0, 0, 0, 0];

    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        try {
          const dayIdx = getDay(parseISO(t.date));
          daysTotal[dayIdx] += t.amount;
          daysCount[dayIdx]++;
        } catch {
          // ignore
        }
      });

    return DAYS_OF_WEEK.map((name, idx) => ({
      day: name,
      amount: Math.round(daysTotal[idx] * 100) / 100,
      count: daysCount[idx],
    }));
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Financial Insights & Reports</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            Deep dive into spending behaviors, payment channels, and weekday patterns
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700/70 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs transition active:scale-95 self-start sm:self-auto"
        >
          <FileDown size={15} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Top 2 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Channels Pie */}
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Payment Methods Breakdown</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Distribution across cards, transfers & cash</p>
            </div>
            <CreditCard size={18} className="text-slate-400 dark:text-slate-500" />
          </div>

          {paymentMethodData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              No expense transactions to show
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-52 w-52 relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-pm-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val, settings.currency, settings.showDecimals)}
                      contentStyle={
                        isDark
                          ? {
                              borderRadius: '16px',
                              background: 'rgba(15, 23, 42, 0.96)',
                              backdropFilter: 'blur(16px)',
                              border: '1px solid rgba(51, 65, 85, 0.8)',
                              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.5)',
                              color: '#f8fafc',
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

              <div className="flex-1 w-full space-y-2">
                {paymentMethodData.map((pm) => (
                  <div key={pm.name} className="flex items-center justify-between text-xs p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs" style={{ backgroundColor: pm.color }} />
                      <span className="text-slate-700 dark:text-slate-300 font-bold truncate">{pm.name}</span>
                    </div>
                    <span className="text-slate-900 dark:text-white font-extrabold ml-2">
                      {formatCurrency(pm.value, settings.currency, false)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Day of the Week Pattern */}
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Weekday Spending Heat</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Identify which days of the week incur the most cost</p>
            </div>
            <Calendar size={18} className="text-slate-400 dark:text-slate-500" />
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <XAxis dataKey="day" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: number) => formatCurrency(val, settings.currency, settings.showDecimals)}
                  contentStyle={
                    isDark
                      ? {
                          borderRadius: '16px',
                          background: 'rgba(15, 23, 42, 0.96)',
                          backdropFilter: 'blur(16px)',
                          border: '1px solid rgba(51, 65, 85, 0.8)',
                          boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.5)',
                          color: '#f8fafc',
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
                <Bar dataKey="amount" name="Total Spent" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comprehensive Category Breakdown Table */}
      <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Category Analytics Matrix</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Totals, volume, and average order value per category</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {categoryStats.length} Categories Active
          </span>
        </div>

        {categoryStats.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            No expenses found in the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-4 text-right">Transactions</th>
                  <th className="py-3 px-4 text-right">Total Spent</th>
                  <th className="py-3 px-4 text-right">Average / Tx</th>
                  <th className="py-3 px-5 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {categoryStats.map((item) => (
                  <tr key={item.catId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: `${item.color}20`,
                            color: item.color,
                          }}
                        >
                          <CategoryIcon name={item.icon} size={15} />
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-400 font-medium">
                      {item.count}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.total, settings.currency, settings.showDecimals)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-400 font-medium">
                      {formatCurrency(item.average, settings.currency, settings.showDecimals)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="inline-block px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-md">
                        {formatPercentage(item.percentage)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

