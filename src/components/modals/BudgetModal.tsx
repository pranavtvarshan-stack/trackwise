import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { Budget } from '../../types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetToEdit?: Budget | null;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budgetToEdit,
}) => {
  const { categories, budgets, addBudget, updateBudget, settings } = useExpense();

  const [categoryId, setCategoryId] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [error, setError] = useState('');

  // Only expense categories, and filter out those that already have a budget (unless editing)
  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both');
  const usedCategoryIds = new Set(
    budgets
      .filter((b) => !budgetToEdit || b.id !== budgetToEdit.id)
      .map((b) => b.categoryId)
  );
  const availableCategories = expenseCategories.filter((c) => !usedCategoryIds.has(c.id));

  useEffect(() => {
    if (budgetToEdit) {
      setCategoryId(budgetToEdit.categoryId);
      setMonthlyLimit(budgetToEdit.monthlyLimit.toString());
      setAlertThreshold(budgetToEdit.alertThresholdPercentage.toString());
    } else {
      if (availableCategories.length > 0) {
        setCategoryId(availableCategories[0].id);
      } else {
        setCategoryId('');
      }
      setMonthlyLimit('');
      setAlertThreshold('80');
      setError('');
    }
  }, [budgetToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(monthlyLimit);
    const threshold = parseInt(alertThreshold, 10);

    if (!categoryId) {
      setError('Please select a category for this budget.');
      return;
    }
    if (isNaN(limit) || limit <= 0) {
      setError('Monthly limit must be greater than 0.');
      return;
    }
    if (isNaN(threshold) || threshold < 10 || threshold > 100) {
      setError('Alert threshold must be between 10% and 100%.');
      return;
    }

    if (budgetToEdit) {
      updateBudget(budgetToEdit.id, {
        categoryId,
        monthlyLimit: limit,
        alertThresholdPercentage: threshold,
      });
    } else {
      addBudget({
        categoryId,
        monthlyLimit: limit,
        alertThresholdPercentage: threshold,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-800 pb-safe sm:pb-0">
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">
            {budgetToEdit ? 'Edit Budget' : 'Set Category Budget'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Category *
            </label>
            {availableCategories.length === 0 && !budgetToEdit ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60">
                All existing expense categories already have a budget set!
              </p>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={Boolean(budgetToEdit)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white text-sm outline-none transition font-medium"
              >
                {budgetToEdit ? (
                  <option value={budgetToEdit.categoryId}>
                    {categories.find((c) => c.id === budgetToEdit.categoryId)?.name}
                  </option>
                ) : (
                  availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Monthly Budget Limit ({settings.currency.symbol}) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">
                {settings.currency.symbol}
              </span>
              <input
                type="number"
                step="any"
                placeholder="500.00"
                value={monthlyLimit}
                onChange={(e) => {
                  setMonthlyLimit(e.target.value);
                  setError('');
                }}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white font-semibold text-lg outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Alert Threshold: {alertThreshold}%
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">Notifies when spending reaches this level</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={availableCategories.length === 0 && !budgetToEdit}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-200 dark:shadow-none hover:shadow-lg transition"
            >
              {budgetToEdit ? 'Save Budget' : 'Set Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

