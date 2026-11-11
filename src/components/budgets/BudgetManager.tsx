import React, { useMemo, useState } from 'react';
import { 
  PiggyBank, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { Budget } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { format } from 'date-fns';
import { BudgetModal } from '../modals/BudgetModal';

export const BudgetManager: React.FC = () => {
  const { budgets, categories, transactions, settings, deleteBudget } = useExpense();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Current month spending per category
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const currentMonthSpends = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(currentMonthKey))
      .forEach((t) => {
        map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
      });
    return map;
  }, [transactions, currentMonthKey]);

  // Calculate totals
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpentInBudgets = budgets.reduce((sum, b) => sum + (currentMonthSpends[b.categoryId] || 0), 0);
  const totalRemaining = Math.max(0, totalBudgeted - totalSpentInBudgets);

  const budgetStats = useMemo(() => {
    return budgets.map((b) => {
      const category = categoryMap.get(b.categoryId);
      const spent = currentMonthSpends[b.categoryId] || 0;
      const limit = b.monthlyLimit;
      const percentage = Math.round((spent / limit) * 100);
      const remaining = limit - spent;
      const isOver = spent >= limit;
      const isWarning = spent >= (limit * b.alertThresholdPercentage) / 100 && !isOver;

      return {
        ...b,
        category,
        spent,
        percentage,
        remaining,
        isOver,
        isWarning,
      };
    });
  }, [budgets, currentMonthSpends, categoryMap]);

  const overCount = budgetStats.filter((b) => b.isOver).length;

  const handleEdit = (budget: Budget) => {
    setBudgetToEdit(budget);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, categoryName: string) => {
    if (confirm(`Remove the budget limit for ${categoryName}?`)) {
      deleteBudget(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Monthly Budget Limits</h2>
          <p className="text-xs text-slate-500">
            Set spending targets per category to stay in control of your finances
          </p>
        </div>
        <button
          onClick={() => {
            setBudgetToEdit(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm shadow-indigo-200 transition active:scale-95 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Set New Budget</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Monthly Budget
          </span>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(totalBudgeted, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Across {budgets.length} assigned categories
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Spent This Month
          </span>
          <div className="text-2xl font-bold text-indigo-600">
            {formatCurrency(totalSpentInBudgets, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {totalBudgeted > 0 ? formatPercentage((totalSpentInBudgets / totalBudgeted) * 100) : '0%'} of overall budget utilized
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Budget Health
          </span>
          <div className="text-2xl font-bold flex items-center gap-2">
            {overCount > 0 ? (
              <span className="text-rose-600 flex items-center gap-1.5">
                <AlertCircle size={22} />
                {overCount} Exceeded
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 size={22} />
                On Track
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {formatCurrency(totalRemaining, settings.currency, false)} safe to spend
          </div>
        </div>
      </div>

      {/* Budgets Grid */}
      {budgetStats.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <PiggyBank size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No category budgets created yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Establish category limits (like Groceries, Dining, Entertainment) to prevent overspending.
          </p>
          <button
            onClick={() => {
              setBudgetToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
          >
            Create Your First Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetStats.map((item) => {
            const cat = item.category;
            let barColor = 'bg-emerald-500';
            let statusBadge = (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">
                Remaining: {formatCurrency(item.remaining, settings.currency, false)}
              </span>
            );

            if (item.isOver) {
              barColor = 'bg-rose-500';
              statusBadge = (
                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1">
                  <AlertCircle size={12} />
                  Over by {formatCurrency(Math.abs(item.remaining), settings.currency, false)}
                </span>
              );
            } else if (item.isWarning) {
              barColor = 'bg-amber-500';
              statusBadge = (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg">
                  Near Limit ({item.percentage}%)
                </span>
              );
            }

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: `${cat?.color || '#6366f1'}20`,
                        color: cat?.color || '#4f46e5',
                      }}
                    >
                      <CategoryIcon name={cat?.icon || 'Tag'} size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {cat?.name || 'Category'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Monthly Cap: {formatCurrency(item.monthlyLimit, settings.currency, false)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                      title="Edit Budget"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, cat?.name || 'this category')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                      title="Delete Budget"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Numbers */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-bold text-slate-900">
                      {formatCurrency(item.spent, settings.currency, settings.showDecimals)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1 font-medium">
                      spent of {formatCurrency(item.monthlyLimit, settings.currency, false)}
                    </span>
                  </div>
                  <div>{statusBadge}</div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>{item.percentage}% used</span>
                    <span>Alert threshold at {item.alertThresholdPercentage}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget Modal */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        budgetToEdit={budgetToEdit}
      />
    </div>
  );
};

