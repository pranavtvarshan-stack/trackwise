import React, { useState, useEffect } from 'react';
import { X, Smartphone, Banknote } from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { PaymentMethod, RecurringTransaction, TransactionType } from '../../types';
import { PAYMENT_METHODS } from '../../constants/defaults';
import { format } from 'date-fns';
import { normalizePaymentMethod } from '../../utils/formatters';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringToEdit?: RecurringTransaction | null;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({
  isOpen,
  onClose,
  recurringToEdit,
}) => {
  const { categories, paymentMethods, addRecurring, updateRecurring, settings } = useExpense();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(paymentMethods[0]?.id || 'upi');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [nextDueDate, setNextDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const availableCategories = categories.filter(
    (c) => c.type === 'both' || c.type === type
  );

  useEffect(() => {
    if (recurringToEdit) {
      setTitle(recurringToEdit.title);
      setAmount(recurringToEdit.amount.toString());
      setType(recurringToEdit.type);
      setCategoryId(recurringToEdit.categoryId);
      setPaymentMethod(normalizePaymentMethod(recurringToEdit.paymentMethod));
      setFrequency(recurringToEdit.frequency);
      setNextDueDate(recurringToEdit.nextDueDate);
      setNotes(recurringToEdit.notes || '');
    } else {
      setTitle('');
      setAmount('');
      setType('expense');
      setPaymentMethod('UPI');
      setFrequency('monthly');
      setNextDueDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
      setError('');
    }
  }, [recurringToEdit, isOpen, paymentMethods]);

  useEffect(() => {
    if (!categoryId || !availableCategories.some((c) => c.id === categoryId)) {
      if (availableCategories.length > 0) {
        setCategoryId(availableCategories[0].id);
      }
    }
  }, [type, availableCategories, categoryId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim()) {
      setError('Please provide a name or subscription title.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (!categoryId) {
      setError('Please choose a category.');
      return;
    }

    if (recurringToEdit) {
      updateRecurring(recurringToEdit.id, {
        title: title.trim(),
        amount: numAmount,
        type,
        categoryId,
        paymentMethod,
        frequency,
        nextDueDate,
        notes: notes.trim(),
      });
    } else {
      addRecurring({
        title: title.trim(),
        amount: numAmount,
        type,
        categoryId,
        paymentMethod,
        frequency,
        nextDueDate,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        active: true,
        notes: notes.trim(),
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 pb-safe sm:pb-0">
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base sm:text-xl font-bold text-slate-800 dark:text-white">
            {recurringToEdit ? 'Edit Recurring / Subscription' : 'Add Recurring Payment / Income'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl">
              {error}
            </div>
          )}

          {/* Type Toggle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                  type === 'expense'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Recurring Bill (-)
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                  type === 'income'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Recurring Income (+)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Title / Subscription Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Netflix, Rent, Gym, Cloud Hosting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium text-sm outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Amount ({settings.currency.symbol}) *
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold text-base outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Frequency *
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm outline-none font-medium"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm outline-none font-medium"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Next Due Date *
              </label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm outline-none font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Payment Method / Wallet *
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'UPI'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60 ring-2 ring-indigo-500/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone size={15} className={paymentMethod === 'UPI' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                <span>UPI / Online</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'Cash'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60 ring-2 ring-emerald-500/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Banknote size={15} className={paymentMethod === 'Cash' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                <span>Liquid Cash</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Account number, contract expiration date"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-xs outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500"
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
              className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 dark:shadow-none hover:shadow-lg transition"
            >
              {recurringToEdit ? 'Save Changes' : 'Add Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
