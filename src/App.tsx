import React, { useState, useEffect } from 'react';
import { ExpenseProvider, useExpense } from './context/ExpenseContext';
import { Header } from './components/layout/Header';
import { Navbar } from './components/layout/Navbar';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { TransactionList } from './components/transactions/TransactionList';
import { BudgetManager } from './components/budgets/BudgetManager';
import { RecurringManager } from './components/recurring/RecurringManager';
import { AnalyticsReports } from './components/analytics/AnalyticsReports';
import { SettingsView } from './components/settings/SettingsView';
import { TransactionModal } from './components/modals/TransactionModal';
import { CsvImportModal } from './components/modals/CsvImportModal';
import { ExportModal } from './components/modals/ExportModal';
import { Transaction } from './types';
import { Plus } from 'lucide-react';

const MainApp: React.FC = () => {
  const { isExportModalOpen, closeExportModal } = useExpense();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      // 'N' or Ctrl/Cmd + K opens Add Transaction
      if (e.key === 'n' || e.key === 'N' || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
        e.preventDefault();
        setTransactionToEdit(null);
        setIsAddModalOpen(true);
      }

      // Escape key closes modals
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsCsvModalOpen(false);
        closeExportModal();
        setTransactionToEdit(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEditTransaction = (tx: Transaction) => {
    setTransactionToEdit(tx);
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setTransactionToEdit(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-indigo-100 dark:selection:bg-indigo-900/40 selection:text-indigo-900 dark:selection:text-indigo-200 relative transition-colors duration-200">
      {/* Subtle Ambient Background Glow for Modern Fintech Depth */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 bg-gradient-to-b from-indigo-50/50 via-purple-50/20 to-transparent dark:from-indigo-950/25 dark:via-purple-950/10 dark:to-transparent pointer-events-none -z-10" />

      {/* Top Header */}
      <Header
        onOpenAddModal={() => {
          setTransactionToEdit(null);
          setIsAddModalOpen(true);
        }}
        onNavigateToTab={(tab) => setActiveTab(tab)}
        onOpenCsvModal={() => setIsCsvModalOpen(true)}
      />

      {/* Navigation Sub-bar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-28 md:pb-8">
        {activeTab === 'dashboard' && (
          <OverviewDashboard
            onOpenAddModal={() => {
              setTransactionToEdit(null);
              setIsAddModalOpen(true);
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionList
            onOpenAddModal={() => {
              setTransactionToEdit(null);
              setIsAddModalOpen(true);
            }}
            onEditTransaction={handleEditTransaction}
            onOpenCsvModal={() => setIsCsvModalOpen(true)}
          />
        )}

        {activeTab === 'budgets' && <BudgetManager />}

        {activeTab === 'recurring' && <RecurringManager />}

        {activeTab === 'analytics' && <AnalyticsReports />}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        onClick={() => {
          setTransactionToEdit(null);
          setIsAddModalOpen(true);
        }}
        className="md:hidden fixed bottom-20 right-4 z-30 w-13 h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-lg shadow-indigo-300/80 dark:shadow-indigo-950/60 flex items-center justify-center transition-all p-3.5 focus:outline-none"
        aria-label="Add Transaction"
      >
        <Plus size={24} />
      </button>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 py-5 text-center text-xs text-slate-400 dark:text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} TrackWise — Private, Fast, Client-Side Expense Tracker</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
            <span>Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-[10px] text-slate-600 dark:text-slate-300">N</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-[10px] text-slate-600 dark:text-slate-300">Ctrl+K</kbd> for quick transaction</span>
          </div>
        </div>
      </footer>

      {/* Global Transaction Modal */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        transactionToEdit={transactionToEdit}
      />

      {/* CSV Bank Statement Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
      />

      {/* CSV Period Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={closeExportModal}
      />
    </div>
  );
};

export function App() {
  return (
    <ExpenseProvider>
      <MainApp />
    </ExpenseProvider>
  );
}

export default App;

