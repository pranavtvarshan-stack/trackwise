import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  X, 
  Calendar, 
  FileSpreadsheet, 
  Check,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { formatCurrency } from '../../utils/formatters';
import { exportTransactionsAsCSV } from '../../utils/storage';
import { DateRangePreset } from '../../types';
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear, 
  subDays, 
  parseISO, 
  isWithinInterval, 
  format 
} from 'date-fns';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { 
    transactions, 
    categories, 
    paymentMethods, 
    settings, 
    filters 
  } = useExpense();

  const [selectedPeriod, setSelectedPeriod] = useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Sync initial period from global filters whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPeriod(filters.dateRange || 'this_month');
      setCustomStart(filters.customStartDate || format(subDays(new Date(), 30), 'yyyy-MM-dd'));
      setCustomEnd(filters.customEndDate || format(new Date(), 'yyyy-MM-dd'));
      setSelectedType(filters.type || 'all');
    }
  }, [isOpen, filters]);

  // Compute matching transactions for the selected export period
  const { matchingTransactions, periodLabel, dateRangeDescription, fileSlug, totalExpenses, totalIncome } = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let pLabel = 'This Month';
    let rangeDesc = '';
    let slug = 'this_month';

    switch (selectedPeriod) {
      case 'this_month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        pLabel = `This Month (${format(now, 'MMMM yyyy')})`;
        rangeDesc = `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`;
        slug = `this_month_${format(now, 'yyyy-MM')}`;
        break;
      case 'last_month': {
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        pLabel = `Last Month (${format(lastMonth, 'MMMM yyyy')})`;
        rangeDesc = `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`;
        slug = `last_month_${format(lastMonth, 'yyyy-MM')}`;
        break;
      }
      case 'last_30_days':
        startDate = subDays(now, 30);
        endDate = now;
        pLabel = 'Last 30 Days';
        rangeDesc = `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`;
        slug = 'last_30_days';
        break;
      case 'this_year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        pLabel = `This Year (${format(now, 'yyyy')})`;
        rangeDesc = `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`;
        slug = `year_${format(now, 'yyyy')}`;
        break;
      case 'custom':
        if (customStart) startDate = parseISO(customStart);
        if (customEnd) endDate = parseISO(customEnd);
        pLabel = 'Custom Period';
        rangeDesc = `${customStart || 'Start'} to ${customEnd || 'End'}`;
        slug = `custom_${customStart || 'start'}_to_${customEnd || 'end'}`;
        break;
      case 'all':
      default:
        startDate = null;
        endDate = null;
        pLabel = 'All Time';
        rangeDesc = 'All Recorded Transactions';
        slug = 'all_time';
        break;
    }

    const matched = transactions.filter((tx) => {
      // Filter by type
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // Filter by date interval
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
      return true;
    });

    let expenseSum = 0;
    let incomeSum = 0;
    matched.forEach((tx) => {
      if (tx.type === 'income') incomeSum += tx.amount;
      else expenseSum += tx.amount;
    });

    return {
      matchingTransactions: matched,
      periodLabel: pLabel,
      dateRangeDescription: rangeDesc,
      fileSlug: slug,
      totalExpenses: expenseSum,
      totalIncome: incomeSum,
    };
  }, [transactions, selectedPeriod, customStart, customEnd, selectedType]);

  const handleDownload = () => {
    setIsExporting(true);

    try {
      const csv = exportTransactionsAsCSV(
        matchingTransactions,
        categories,
        paymentMethods,
        {
          periodName: periodLabel,
          dateRangeDescription,
          currencySymbol: settings.currency.symbol,
        }
      );

      // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel and Google Sheets INR currency support
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trackwise_transactions_${fileSlug}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 350);
    } catch (err) {
      console.error('Failed to export CSV', err);
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const PERIOD_OPTIONS: { id: DateRangePreset; label: string; desc: string }[] = [
    { id: 'this_month', label: 'This Month', desc: 'Current month transactions' },
    { id: 'last_month', label: 'Last Month', desc: 'Previous calendar month' },
    { id: 'last_30_days', label: 'Last 30 Days', desc: 'Recent 30 days rolling window' },
    { id: 'this_year', label: 'This Year', desc: 'January to present year' },
    { id: 'all', label: 'All Time', desc: 'Complete historical database' },
    { id: 'custom', label: 'Custom Range', desc: 'Choose exact start & end dates' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 pb-safe sm:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileSpreadsheet size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Export Transactions (CSV)</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">Select the time period you want to export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {/* Period Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-600 dark:text-indigo-400" />
              Select Period
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERIOD_OPTIONS.map((opt) => {
                const isSelected = selectedPeriod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedPeriod(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold">{opt.label}</span>
                      {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Pickers if custom selected */}
          {selectedPeriod === 'custom' && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-2.5 animate-fade-in">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom Date Range</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Transaction Type Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600 dark:text-indigo-400" />
              Transaction Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All Transactions' },
                { id: 'expense', label: 'Expenses Only' },
                { id: 'income', label: 'Income Only' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id as any)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    selectedType === t.id
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Preview Box */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Period:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{periodLabel}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Date Range:</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{dateRangeDescription}</span>
            </div>
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Records to Export:</span>
                <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {matchingTransactions.length} transaction{matchingTransactions.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-right text-xs space-y-0.5">
                {selectedType !== 'income' && (
                  <div className="text-slate-500 dark:text-slate-400">
                    Spent: <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(totalExpenses, settings.currency)}</span>
                  </div>
                )}
                {selectedType !== 'expense' && (
                  <div className="text-slate-500 dark:text-slate-400">
                    Income: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncome, settings.currency)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={matchingTransactions.length === 0 || isExporting}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-white shadow-sm transition ${
              matchingTransactions.length === 0 || isExporting
                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500 dark:text-slate-400'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none active:scale-95'
            }`}
          >
            <Download size={15} />
            <span>{isExporting ? 'Preparing CSV...' : `Export ${matchingTransactions.length} Transaction(s)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

