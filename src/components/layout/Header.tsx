import React, { useRef, useState } from 'react';
import { 
  Plus, 
  Wallet, 
  Download, 
  Upload, 
  Bell, 
  ChevronDown, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { CURRENCIES } from '../../constants/defaults';
import { formatCurrency } from '../../utils/formatters';

interface HeaderProps {
  onOpenAddModal: () => void;
  onNavigateToTab: (tab: string) => void;
  onOpenCsvModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddModal, onNavigateToTab, onOpenCsvModal }) => {
  const { 
    settings, 
    updateSettings, 
    recurring, 
    totalIncome, 
    totalExpenses,
    exportJSON, 
    exportCSV, 
    importJSON,
    resetData 
  } = useExpense();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check how many recurring bills are due today or overdue
  const today = new Date().toISOString().split('T')[0];
  const dueRecurring = recurring.filter(r => r.active && r.nextDueDate <= today);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const success = importJSON(content);
          if (success) {
            alert('Data imported successfully!');
          } else {
            alert('Failed to parse backup JSON file.');
          }
        }
      };
      reader.readAsText(file);
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 flex-shrink-0">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800">
                  TrackWise
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Expense & Wealth Intelligence
              </p>
            </div>
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Currency Indicator */}
            <div 
              className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-100/90 text-slate-700 rounded-xl text-[11px] sm:text-xs font-bold border border-slate-200/70 select-none"
              title="Current Currency: Indian Rupee (₹ INR)"
            >
              <span className="text-indigo-600 font-extrabold">₹</span>
              <span>INR</span>
            </div>

            {/* Recurring Due Alert Badge */}
            {dueRecurring.length > 0 && (
              <button
                onClick={() => onNavigateToTab('recurring')}
                className="relative flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] sm:text-xs font-semibold transition"
                title={`${dueRecurring.length} recurring item(s) due for payment`}
              >
                <Bell size={13} className="text-amber-600 animate-pulse" />
                <span className="hidden sm:inline">{dueRecurring.length} Due</span>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              </button>
            )}

            {/* Data Actions Dropdown (Export / Import) */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-transparent hover:border-slate-200"
                title="Backup & Export"
              >
                <Download size={18} />
              </button>

              {showExportMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 text-xs">
                    <button
                      onClick={() => {
                        exportCSV();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                    >
                      <Download size={14} className="text-slate-400" />
                      Export to CSV
                    </button>
                    <button
                      onClick={() => {
                        onOpenCsvModal();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                    >
                      <Upload size={14} className="text-emerald-600" />
                      Import Bank Statement (CSV)
                    </button>
                    <button
                      onClick={() => {
                        exportJSON();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                    >
                      <Download size={14} className="text-slate-400" />
                      Export Full Backup (JSON)
                    </button>
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                    >
                      <Upload size={14} className="text-slate-400" />
                      Restore Backup (JSON)
                    </button>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Quick Add Button */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300 transition active:scale-95"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

