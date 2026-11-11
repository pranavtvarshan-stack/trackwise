import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Coins, 
  Tags, 
  CreditCard,
  Database, 
  Download, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Plus,
  Sparkles,
  Check,
  Edit2,
  X
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { CURRENCIES } from '../../constants/defaults';
import { Category, TransactionType, PaymentMethodItem } from '../../types';
import { CategoryIcon } from '../common/CategoryIcon';

const AVAILABLE_ICONS = [
  'Utensils', 'ShoppingCart', 'Home', 'Car', 'Zap', 'Film', 'ShoppingBag',
  'Activity', 'Plane', 'BookOpen', 'Smile', 'Briefcase', 'Laptop',
  'TrendingUp', 'Gift', 'Coffee', 'Heart', 'Music', 'Camera', 'Wifi',
  'Fuel', 'Shirt', 'Smartphone', 'Tool'
];

const PAYMENT_METHOD_ICONS = [
  'Smartphone', 'CreditCard', 'Building2', 'Banknote', 'Wallet', 'Coins', 'Tag', 'HelpCircle'
];

const PRESET_COLORS = [
  '#f97316', '#10b981', '#6366f1', '#06b6d4', '#eab308', '#ec4899',
  '#8b5cf6', '#ef4444', '#14b8a6', '#3b82f6', '#f43f5e', '#84cc16'
];

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    categories, 
    paymentMethods,
    addCategory, 
    updateCategory,
    deleteCategory, 
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    resetData, 
    clearData, 
    exportJSON, 
    exportCSV, 
    importJSON 
  } = useExpense();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [newCatIcon, setNewCatIcon] = useState(AVAILABLE_ICONS[0]);

  // Edit Category State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // New Payment Method Form State
  const [newPmLabel, setNewPmLabel] = useState('');
  const [newPmIcon, setNewPmIcon] = useState(PAYMENT_METHOD_ICONS[0]);

  // Edit Payment Method State
  const [editingPm, setEditingPm] = useState<PaymentMethodItem | null>(null);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    addCategory({
      name: newCatName.trim(),
      type: newCatType,
      color: newCatColor,
      icon: newCatIcon,
    });

    setNewCatName('');
    showNotification('Category created successfully!');
  };

  const handleUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;

    updateCategory(editingCategory.id, {
      name: editingCategory.name.trim(),
      type: editingCategory.type,
      color: editingCategory.color,
      icon: editingCategory.icon,
    });

    setEditingCategory(null);
    showNotification('Category updated successfully!');
  };

  const handleDeleteCategory = (cat: Category) => {
    if (categories.length <= 1) {
      alert('Cannot delete the only remaining category. You must keep at least one category.');
      return;
    }
    if (confirm(`Delete category "${cat.name}"? It will no longer appear when recording transactions.`)) {
      const ok = deleteCategory(cat.id);
      if (ok) {
        showNotification(`Category "${cat.name}" deleted.`);
      }
    }
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPmLabel.trim()) return;

    addPaymentMethod({
      label: newPmLabel.trim(),
      icon: newPmIcon,
    });

    setNewPmLabel('');
    showNotification('Payment method added successfully!');
  };

  const handleUpdatePaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPm || !editingPm.label.trim()) return;

    updatePaymentMethod(editingPm.id, {
      label: editingPm.label.trim(),
      icon: editingPm.icon,
    });

    setEditingPm(null);
    showNotification('Payment method updated successfully!');
  };

  const handleDeletePaymentMethod = (pm: PaymentMethodItem) => {
    if (paymentMethods.length <= 1) {
      alert('Cannot delete the only remaining payment method. You must keep at least one.');
      return;
    }
    if (confirm(`Delete payment method "${pm.label}"? It will no longer appear when recording transactions.`)) {
      const ok = deletePaymentMethod(pm.id);
      if (ok) {
        showNotification(`Payment method "${pm.label}" deleted.`);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content && importJSON(content)) {
          showNotification('Backup restored successfully!');
        } else {
          alert('Failed to parse backup JSON file.');
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Preferences & Settings</h2>
        <p className="text-xs text-slate-500">
          Customize currency, manage expense categories, and backup or restore data
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check size={16} className="text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. General Preferences */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Coins className="text-indigo-600" size={18} />
          <h3 className="text-sm font-bold text-slate-800">Currency & Formatting</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Default Currency
            </label>
            <div className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="font-bold text-indigo-600">₹</span>
                <span>Indian Rupee (INR)</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Active Default
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Decimals Display
            </label>
            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showDecimals}
                  onChange={(e) => updateSettings({ showDecimals: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Show paise / decimals (e.g. ₹10.50 vs ₹10)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Custom Category Manager */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Tags className="text-indigo-600" size={18} />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Categories Management</h3>
            <p className="text-xs text-slate-400">Add custom categories to label your finances</p>
          </div>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="p-4 bg-slate-50 rounded-xl space-y-3.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Create Custom Category
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Name</label>
              <input
                type="text"
                placeholder="e.g. Freelance, Pets, Gaming"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none"
              >
                <option value="expense">Expense (-)</option>
                <option value="income">Income (+)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Icon</label>
              <select
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none"
              >
                {AVAILABLE_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Picker palette */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Color Accent</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((col) => (
                <button
                  type="button"
                  key={col}
                  onClick={() => setNewCatColor(col)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newCatColor === col ? 'scale-125 ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={14} />
            <span>Add Category</span>
          </button>
        </form>

        {/* Existing Categories List */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Active Categories ({categories.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 bg-white"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    <CategoryIcon name={cat.icon} size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{cat.name}</p>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      {cat.type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCategory(cat)}
                    className="p-1 text-slate-400 hover:text-indigo-600 transition"
                    title="Edit category"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                    title="Delete category"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Payment Methods Manager */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <CreditCard className="text-indigo-600" size={18} />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Payment Methods Management</h3>
            <p className="text-xs text-slate-400">Add or remove payment options like UPI, Cards, GPay, or Cash</p>
          </div>
        </div>

        {/* Add Payment Method Form */}
        <form onSubmit={handleAddPaymentMethod} className="p-4 bg-slate-50 rounded-xl space-y-3.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Add New Payment Mode
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Method Name</label>
              <input
                type="text"
                placeholder="e.g. PhonePe, Google Pay, HDFC Card, Paytm"
                value={newPmLabel}
                onChange={(e) => setNewPmLabel(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Icon</label>
              <select
                value={newPmIcon}
                onChange={(e) => setNewPmIcon(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none"
              >
                {PAYMENT_METHOD_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={14} />
            <span>Add Payment Method</span>
          </button>
        </form>

        {/* Active Payment Methods List */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Active Payment Options ({paymentMethods.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 bg-white hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <CategoryIcon name={pm.icon} size={15} />
                  </div>
                  <span className="text-xs font-bold text-slate-800 truncate">{pm.label}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingPm(pm)}
                    className="p-1 text-slate-400 hover:text-indigo-600 transition"
                    title="Edit payment method"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDeletePaymentMethod(pm)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                    title="Delete payment method"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4 pb-safe sm:pb-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Edit Category</h3>
              <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateCategory} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
                <select
                  value={editingCategory.type}
                  onChange={(e) => setEditingCategory({ ...editingCategory, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none"
                >
                  <option value="expense">Expense (-)</option>
                  <option value="income">Income (+)</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Icon</label>
                <select
                  value={editingCategory.icon}
                  onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none"
                >
                  {AVAILABLE_ICONS.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setEditingCategory({ ...editingCategory, color: col })}
                      className={`w-6 h-6 rounded-full ${
                        editingCategory.color === col ? 'scale-125 ring-2 ring-offset-2 ring-indigo-500' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Method Modal */}
      {editingPm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4 pb-safe sm:pb-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Edit Payment Method</h3>
              <button onClick={() => setEditingPm(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdatePaymentMethod} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Label</label>
                <input
                  type="text"
                  value={editingPm.label}
                  onChange={(e) => setEditingPm({ ...editingPm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Icon</label>
                <select
                  value={editingPm.icon}
                  onChange={(e) => setEditingPm({ ...editingPm, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none"
                >
                  {PAYMENT_METHOD_ICONS.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPm(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Data Backup, Restore & Danger Zone */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Database className="text-indigo-600" size={18} />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Data Storage & Backup</h3>
            <p className="text-xs text-slate-400">Your data is stored securely in your browser's local storage</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={exportCSV}
            className="p-3.5 border border-slate-200 rounded-xl hover:bg-slate-50 flex flex-col items-center justify-center text-center gap-1.5 transition"
          >
            <Download size={18} className="text-slate-600" />
            <span className="text-xs font-bold text-slate-800">Export CSV</span>
            <span className="text-[10px] text-slate-400">Transactions spreadsheet</span>
          </button>

          <button
            onClick={exportJSON}
            className="p-3.5 border border-slate-200 rounded-xl hover:bg-slate-50 flex flex-col items-center justify-center text-center gap-1.5 transition"
          >
            <Download size={18} className="text-slate-600" />
            <span className="text-xs font-bold text-slate-800">Backup All (JSON)</span>
            <span className="text-[10px] text-slate-400">Full data snapshot</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3.5 border border-slate-200 rounded-xl hover:bg-slate-50 flex flex-col items-center justify-center text-center gap-1.5 transition"
          >
            <Upload size={18} className="text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">Restore from JSON</span>
            <span className="text-[10px] text-slate-400">Import backup file</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-rose-700">Clear All Transactions</h4>
            <p className="text-[11px] text-slate-500">
              Permanently wipe all recorded transactions and start completely fresh.
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete ALL transactions? This cannot be undone.')) {
                clearData();
                showNotification('All transactions cleared.');
              }
            }}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
          >
            <Trash2 size={14} />
            <span>Wipe Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};

