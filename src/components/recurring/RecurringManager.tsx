import React, { useState, useMemo } from 'react';
import { 
  Repeat, 
  Plus, 
  Check, 
  Clock, 
  Calendar, 
  Edit3, 
  Trash2, 
  ArrowDownRight, 
  ArrowUpRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { RecurringTransaction } from '../../types';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { RecurringModal } from '../modals/RecurringModal';
import { differenceInDays, parseISO, format } from 'date-fns';

export const RecurringManager: React.FC = () => {
  const { 
    recurring, 
    categories, 
    settings, 
    updateRecurring, 
    deleteRecurring, 
    processDueRecurring 
  } = useExpense();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recurringToEdit, setRecurringToEdit] = useState<RecurringTransaction | null>(null);
  const [processMessage, setProcessMessage] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Compute monthly normalized amounts
  const monthlyRecurringExpense = useMemo(() => {
    return recurring
      .filter((r) => r.active && r.type === 'expense')
      .reduce((sum, r) => {
        if (r.frequency === 'daily') return sum + r.amount * 30;
        if (r.frequency === 'weekly') return sum + r.amount * 4.33;
        if (r.frequency === 'yearly') return sum + r.amount / 12;
        return sum + r.amount;
      }, 0);
  }, [recurring]);

  const monthlyRecurringIncome = useMemo(() => {
    return recurring
      .filter((r) => r.active && r.type === 'income')
      .reduce((sum, r) => {
        if (r.frequency === 'daily') return sum + r.amount * 30;
        if (r.frequency === 'weekly') return sum + r.amount * 4.33;
        if (r.frequency === 'yearly') return sum + r.amount / 12;
        return sum + r.amount;
      }, 0);
  }, [recurring]);

  // Items due now or in the past
  const dueItems = recurring.filter((r) => r.active && r.nextDueDate <= todayStr);

  const handleProcessDue = () => {
    const count = processDueRecurring();
    if (count > 0) {
      setProcessMessage(`Successfully logged ${count} due payment(s) to your transactions!`);
      setTimeout(() => setProcessMessage(null), 4000);
    } else {
      setProcessMessage('No payments are currently due.');
      setTimeout(() => setProcessMessage(null), 3000);
    }
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    updateRecurring(id, { active: !currentStatus });
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete recurring item "${title}"?`)) {
      deleteRecurring(id);
    }
  };

  const handleEdit = (item: RecurringTransaction) => {
    setRecurringToEdit(item);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Subscriptions & Recurring Bills</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track fixed commitments, software subscriptions, rent, and scheduled income
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {dueItems.length > 0 && (
            <button
              onClick={handleProcessDue}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm shadow-amber-200 dark:shadow-none transition active:scale-95"
            >
              <Zap size={16} />
              <span>Process Due Bills ({dueItems.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setRecurringToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm shadow-indigo-200 dark:shadow-none transition active:scale-95"
          >
            <Plus size={16} />
            <span>Add Subscription</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {processMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span>{processMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
            Monthly Fixed Expenses
          </span>
          <div className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
            {formatCurrency(monthlyRecurringExpense, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Projected monthly subscription burn
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
            Monthly Recurring Income
          </span>
          <div className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatCurrency(monthlyRecurringIncome, settings.currency, settings.showDecimals)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Expected salary & recurring cash inflow
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
            Due & Upcoming
          </span>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>{dueItems.length} Due</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {recurring.filter((r) => r.active).length} total active recurring entries
          </div>
        </div>
      </div>

      {/* Due Now Alert Banner */}
      {dueItems.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                You have {dueItems.length} recurring item(s) due!
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Clicking "Process Due Bills" logs them into your transactions list and updates next due dates.
              </p>
            </div>
          </div>
          <button
            onClick={handleProcessDue}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition self-start sm:self-auto"
          >
            Process Now
          </button>
        </div>
      )}

      {/* Recurring Cards List */}
      {recurring.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/80 p-12 text-center rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <Repeat size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">No subscriptions or recurring bills</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Keep track of monthly subscriptions like Netflix, Spotify, gym memberships, and rent payments.
          </p>
          <button
            onClick={() => {
              setRecurringToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
          >
            Add First Subscription
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurring.map((item) => {
            const cat = categoryMap.get(item.categoryId);
            const isExpense = item.type === 'expense';
            const diffDays = differenceInDays(parseISO(item.nextDueDate), new Date());

            let dueBadge = (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Due in {diffDays} day{diffDays !== 1 ? 's' : ''} ({formatDateDisplay(item.nextDueDate)})
              </span>
            );

            if (diffDays < 0) {
              dueBadge = (
                <span className="text-xs text-rose-600 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                  Overdue by {Math.abs(diffDays)} day{Math.abs(diffDays) !== 1 ? 's' : ''}
                </span>
              );
            } else if (diffDays === 0) {
              dueBadge = (
                <span className="text-xs text-amber-600 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md animate-pulse">
                  Due Today!
                </span>
              );
            }

            return (
              <div
                key={item.id}
                className={`bg-white/90 dark:bg-slate-900/80 p-5 rounded-2xl border transition-all ${
                  item.active ? 'border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md' : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${cat?.color || '#6366f1'}20`,
                        color: cat?.color || '#4f46e5',
                      }}
                    >
                      <CategoryIcon name={cat?.icon || 'Tag'} size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="capitalize">{item.frequency}</span>
                        <span>•</span>
                        <span>{cat?.name || 'Category'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-base font-bold ${
                        isExpense ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatCurrency(item.amount, settings.currency, settings.showDecimals)}
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                      {item.paymentMethod.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                    {dueBadge}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active toggle */}
                    <button
                      onClick={() => handleToggleActive(item.id, item.active)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                        item.active
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item.active ? 'Active' : 'Paused'}
                    </button>

                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <RecurringModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recurringToEdit={recurringToEdit}
      />
    </div>
  );
};

