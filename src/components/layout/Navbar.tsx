import React from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  PiggyBank, 
  Repeat, 
  BarChart3, 
  Settings 
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { recurring, budgets, transactions } = useExpense();

  const today = new Date().toISOString().split('T')[0];
  const dueBillsCount = recurring.filter(r => r.active && r.nextDueDate <= today).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText, count: transactions.length },
    { id: 'budgets', label: 'Budgets', icon: PiggyBank },
    { id: 'recurring', label: 'Subscriptions & Bills', icon: Repeat, badge: dueBillsCount > 0 ? dueBillsCount : null },
    { id: 'analytics', label: 'Analytics & Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const mobileNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Ledger', icon: ReceiptText },
    { id: 'budgets', label: 'Budgets', icon: PiggyBank },
    { id: 'recurring', label: 'Bills', icon: Repeat, badge: dueBillsCount > 0 ? dueBillsCount : null },
    { id: 'analytics', label: 'Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop / Tablet Sub-Navbar */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 hidden md:block transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1.5 overflow-x-auto py-2.5 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-xs ring-1 ring-black/5 dark:ring-white/10 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full shadow-2xs">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (iOS & Android) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/70 dark:border-slate-800/80 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
        <nav className="flex items-center justify-around px-2 py-1.5">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 min-h-[48px] relative transition-all duration-150 active:scale-90 ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-indigo-50/80 dark:bg-indigo-950/60 shadow-2xs' : ''}`}>
                  <Icon size={19} className={isActive ? 'text-indigo-600 dark:text-indigo-400 stroke-[2.4]' : 'text-slate-400 dark:text-slate-500'} />
                  {item.badge ? (
                    <span className="absolute -top-0.5 right-2 min-w-4 h-4 px-1 text-[9px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center shadow-xs">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] mt-0.5 leading-tight tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

