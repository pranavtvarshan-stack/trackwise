import React, { useRef, useState } from 'react';
import { 
  Plus, 
  Wallet, 
  Download, 
  Upload, 
  Bell, 
  Sun,
  Moon,
  RefreshCw,
  Check,
  AlertTriangle,
  ExternalLink,
  LogOut,
  FileSpreadsheet
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { useGoogleAuth } from '../../context/GoogleAuthContext';

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
    toggleTheme,
    transactions,
    budgets,
    upiBalance,
    cashBalance,
    settings,
    setAllTransactions,
    setAllBudgets
  } = useExpense();

  const {
    user,
    syncInfo,
    reconnectSync,
    isTokenExpired,
    loginWithGoogle,
    logout,
    performSync
  } = useGoogleAuth();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleManualSync = async () => {
    setManualSyncing(true);
    await performSync(
      transactions,
      budgets,
      upiBalance,
      cashBalance,
      settings.currency.symbol,
      (pulled) => {
        if (pulled.transactions.length > 0) setAllTransactions(pulled.transactions);
        if (pulled.budgets.length > 0) setAllBudgets(pulled.budgets);
      }
    );
    setManualSyncing(false);
    setShowUserMenu(false);
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
            {/* Currency Indicator */}
            <div 
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] sm:text-xs font-bold border border-slate-200/70 dark:border-slate-700/70 select-none shadow-2xs transition"
              title="Default Currency: Indian Rupee (₹ INR)"
            >
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">₹</span>
              <span className="tracking-wide">INR</span>
            </div>

            {/* Google Sheets Sync Pill / Indicator */}
            {user ? (
              <>
                {syncInfo.syncState === 'syncing' || manualSyncing ? (
                  <div className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                    <RefreshCw size={12} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">Syncing...</span>
                  </div>
                ) : isTokenExpired || syncInfo.syncState === 'token_expired' ? (
                  <button
                    onClick={reconnectSync}
                    className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-[11px] font-bold shadow-2xs transition hover:bg-amber-100"
                    title="Google Token Expired. Tap to reconnect Google Sheets sync"
                  >
                    <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                    <span>Reconnect</span>
                  </button>
                ) : (
                  <div 
                    className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold"
                    title={`Google Sheet Synced at ${syncInfo.lastSyncedAt ? new Date(syncInfo.lastSyncedAt).toLocaleTimeString() : 'Recently'}`}
                  >
                    <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Synced</span>
                  </div>
                )}

                {/* User Profile Dropdown Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition bg-white/50 dark:bg-slate-800/50 shadow-2xs"
                    title={`${user.name} (${user.email})`}
                  >
                    {user.picture ? (
                      <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-lg object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>

                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 mt-2 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 py-2.5 z-50 text-xs animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
                        {/* User Identity Header */}
                        <div className="px-4 py-2">
                          <p className="font-bold text-slate-800 dark:text-white truncate">{user.name}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
                        </div>

                        {/* Actions */}
                        <div className="py-1">
                          {syncInfo.spreadsheetUrl && (
                            <a
                              href={syncInfo.spreadsheetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full text-left px-4 py-2 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium transition"
                            >
                              <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
                              <span>Open Google Sheet</span>
                              <ExternalLink size={12} className="text-slate-400 ml-auto" />
                            </a>
                          )}
                          <button
                            onClick={handleManualSync}
                            disabled={manualSyncing}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium transition"
                          >
                            <RefreshCw size={14} className={`text-indigo-600 dark:text-indigo-400 ${manualSyncing ? 'animate-spin' : ''}`} />
                            <span>Sync Now</span>
                          </button>
                        </div>

                        {/* Sign Out */}
                        <div className="py-1">
                          <button
                            onClick={() => {
                              logout();
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-medium transition"
                          >
                            <LogOut size={14} />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Offline Mode: Sign In to Backup Button */
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95"
                title="Sign in with Google to auto-sync with Google Sheets"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="hidden sm:inline">Sign in to Backup</span>
                <span className="sm:hidden">Backup</span>
              </button>
            )}

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
