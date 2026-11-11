import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Upload,
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  Tag as TagIcon,
  X,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { Transaction, PaymentMethod } from '../../types';
import { PAYMENT_METHODS } from '../../constants/defaults';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

interface TransactionListProps {
  onOpenAddModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenCsvModal: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  onOpenAddModal,
  onEditTransaction,
  onOpenCsvModal,
}) => {
  const { 
    filteredTransactions, 
    categories, 
    paymentMethods,
    settings, 
    filters, 
    setFilters, 
    resetFilters,
    deleteTransaction,
    exportCSV
  } = useExpense();

  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Group filtered transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      const dateKey = tx.date;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(tx);
    });

    return Object.entries(groups).map(([date, items]) => ({
      date,
      displayDate: formatDateDisplay(date),
      items,
      dayTotal: items.reduce((acc, curr) => {
        return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
      }, 0),
    }));
  }, [filteredTransactions]);

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteTransaction(id);
    }
  };

  const hasActiveFilters = 
    filters.searchQuery !== '' || 
    filters.categoryId !== 'all' || 
    filters.paymentMethod !== 'all' || 
    filters.type !== 'all' ||
    filters.dateRange !== 'this_month';

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Bar */}
      <div className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search by title, description, notes, or tags..."
              value={filters.searchQuery}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200/70 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCsvModal}
              className="px-3.5 py-2 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200/60 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95"
              title="Import bank statement CSV"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Import Statement</span>
            </button>

            <button
              onClick={exportCSV}
              className="px-3.5 py-2 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95"
              title="Export visible list to CSV"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-500/25 transition-all active:scale-95"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Period Filter */}
          <div>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value as any }))}
              className="w-full p-2 bg-indigo-50/70 border border-indigo-200/80 rounded-xl font-bold text-indigo-900 outline-none"
            >
              <option value="this_month">Period: This Month</option>
              <option value="last_month">Period: Last Month</option>
              <option value="last_30_days">Period: Last 30 Days</option>
              <option value="this_year">Period: This Year</option>
              <option value="all">Period: All Time</option>
              <option value="custom">Period: Custom Range</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as any }))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses Only</option>
              <option value="income">Income Only</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="all">All Payment Modes</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Filter */}
          <div>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as any }))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="amount_desc">Amount: Highest First</option>
              <option value="amount_asc">Amount: Lowest First</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Pickers if custom selected */}
        {filters.dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 animate-fade-in">
            <span className="text-slate-600 font-semibold">Custom Period Dates:</span>
            <input
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, customStartDate: e.target.value }))}
              className="p-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, customEndDate: e.target.value }))}
              className="p-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 outline-none"
            />
          </div>
        )}

        {/* Active Filters indicator */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            <span>
              Showing {filteredTransactions.length} transaction(s) matching filters
            </span>
            <button
              onClick={resetFilters}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Transaction Records List */}
      {groupedTransactions.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <p className="text-base font-semibold text-slate-700">No transactions match your current filters.</p>
          <p className="text-xs text-slate-400">Try adjusting your filters, date range, or add a new transaction.</p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groupedTransactions.map((group) => (
            <div key={group.date} className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.03)] overflow-hidden">
              {/* Date Group Header */}
              <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 tracking-wide">{group.displayDate}</span>
                <span
                  className={`font-semibold ${
                    group.dayTotal >= 0 ? 'text-emerald-600' : 'text-slate-600'
                  }`}
                >
                  Net: {formatCurrency(group.dayTotal, settings.currency, settings.showDecimals)}
                </span>
              </div>

              {/* Transactions in Date Group */}
              <div className="divide-y divide-slate-100">
                {group.items.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const isExpense = tx.type === 'expense';

                  return (
                    <div
                      key={tx.id}
                      className="p-3 sm:p-4 flex items-center justify-between gap-2.5 sm:gap-4 hover:bg-slate-50/50 transition group"
                    >
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        <div
                          className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: `${cat?.color || '#94a3b8'}20`,
                            color: cat?.color || '#64748b',
                          }}
                        >
                          <CategoryIcon name={cat?.icon || 'Tag'} size={18} className="sm:w-5 sm:h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {tx.title}
                            </h4>
                            {tx.receiptUrl && (
                              <button
                                onClick={() => setPreviewReceiptUrl(tx.receiptUrl || null)}
                                className="text-slate-400 hover:text-indigo-600 transition"
                                title="View attached receipt"
                              >
                                <ImageIcon size={13} />
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 mt-0.5 text-[11px] sm:text-xs text-slate-500">
                            <span className="font-medium text-slate-600">{cat?.name || 'Uncategorized'}</span>
                            <span>•</span>
                            <span className="capitalize">{tx.paymentMethod.replace('_', ' ')}</span>

                            {tx.notes && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400 truncate max-w-[110px] sm:max-w-[200px]" title={tx.notes}>
                                  {tx.notes}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Tags */}
                          {tx.tags && tx.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tx.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] sm:text-[10px] font-semibold rounded-md"
                                >
                                  <TagIcon size={8} className="text-slate-400" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-sm sm:text-base font-bold tracking-tight ${
                              isExpense ? 'text-slate-900' : 'text-emerald-600'
                            }`}
                          >
                            {isExpense ? '-' : '+'}
                            {formatCurrency(tx.amount, settings.currency, settings.showDecimals)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id, tx.title)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receipt Preview Lightbox Modal */}
      {previewReceiptUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div 
            className="relative max-w-xl max-h-[85vh] bg-white p-2 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition"
            >
              <X size={18} />
            </button>
            <img
              src={previewReceiptUrl}
              alt="Receipt Full Preview"
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

