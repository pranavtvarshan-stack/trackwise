import React, { useRef, useState } from 'react';
import { 
  Plus, 
  Wallet, 
  Download, 
  Upload, 
  Bell, 
  Sun,
  Moon
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';

interface HeaderProps {
  onOpenAddModal: () => void;
  onNavigateToTab: (tab: string) => void;
  onOpenCsvModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddModal, onNavigateToTab, onOpenCsvModal }) => {
  const { 
    recurring, 
    exportJSON, 
    exportCSV, 
    importJSON,
    isDark,
    toggleTheme
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
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] pt-safe transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        <div className="flex items-center justify-between min-h-[40px] sm:min-h-[46px]">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 ring-1 ring-black/5 flex-shrink-0 transition-transform active:scale-95">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-950 via-slate-800 to-indigo-900 dark:from-white dark:via-slate-200 dark:to-indigo-300">
                  TrackWise
                </span>
                <span className="hidden sm:inline-flex text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-100/80 dark:border-indigo-800/70 shadow-2xs">
                  Pro
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 hidden sm:block tracking-tight">
                Personal Wealth & Expense Manager
              </p>
            </div>
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Currency Indicator (Shown on tablet/desktop, hidden on crowded mobile) */}
            <div 
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] sm:text-xs font-bold border border-slate-200/70 dark:border-slate-700/70 select-none shadow-2xs transition"
              title="Default Currency: Indian Rupee (₹ INR)"
            >
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">₹</span>
              <span className="tracking-wide">INR</span>
            </div>

            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 sm:w-auto sm:h-auto p-2 sm:px-2.5 sm:py-2 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-xl transition border border-slate-200/60 dark:border-slate-800 shadow-2xs"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={17} className="text-amber-400 animate-fade-in" /> : <Moon size={17} className="text-slate-600 dark:text-slate-300 animate-fade-in" />}
            </button>

            {/* Recurring Due Alert Badge */}
            {dueRecurring.length > 0 && (
              <button
                onClick={() => onNavigateToTab('recurring')}
                className="relative flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto p-2 sm:px-2.5 sm:py-2 bg-amber-50/90 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/80 rounded-xl text-[11px] sm:text-xs font-semibold shadow-2xs transition active:scale-95"
                title={`${dueRecurring.length} bill(s) due for payment`}
              >
                <Bell size={16} className="text-amber-600 dark:text-amber-400 animate-pulse" />
                <span className="hidden sm:inline font-bold">{dueRecurring.length} Due</span>
                <span className="absolute -top-1 -right-1 sm:static w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              </button>
            )}

            {/* Data Actions Dropdown (Export / Import) */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-9 h-9 sm:w-auto sm:h-auto p-2 sm:px-2.5 sm:py-2 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80 active:bg-slate-200/70 rounded-xl transition border border-slate-200/60 dark:border-slate-800 shadow-2xs"
                title="Backup & Export Actions"
              >
                <Download size={17} />
              </button>

              {showExportMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 py-2 z-50 text-xs animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          exportCSV();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium transition"
                      >
                        <Download size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Export to CSV</span>
                      </button>
                      <button
                        onClick={() => {
                          onOpenCsvModal();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium transition"
                      >
                        <Upload size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Import Bank Statement (CSV)</span>
                      </button>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          exportJSON();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium transition"
                      >
                        <Download size={14} className="text-slate-400" />
                        <span>Export Full Backup (JSON)</span>
                      </button>
                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium transition"
                      >
                        <Upload size={14} className="text-slate-400" />
                        <span>Restore Backup (JSON)</span>
                      </button>
                    </div>
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
              className="flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto p-2 sm:px-4 sm:py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all active:scale-95"
              title="Add Transaction"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline text-xs sm:text-sm">Add Transaction</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
