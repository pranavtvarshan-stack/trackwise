import React, { useState } from 'react';
import { 
  Upload, 
  X, 
  Check, 
  FileSpreadsheet, 
  AlertCircle, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { formatCurrency } from '../../utils/formatters';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const { categories, paymentMethods, addTransaction, settings } = useExpense();

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  // Mapping state
  const [titleCol, setTitleCol] = useState<number>(0);
  const [amountCol, setAmountCol] = useState<number>(1);
  const [dateCol, setDateCol] = useState<number>(2);
  const [defaultCategory, setDefaultCategory] = useState<string>(categories[0]?.id || '');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<string>(paymentMethods[0]?.id || '');
  const [defaultType, setDefaultType] = useState<'expense' | 'income'>('expense');

  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportSummary(null);
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setError('The CSV file is empty.');
        return;
      }

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        setError('The CSV file must have a header row and at least one data row.');
        return;
      }

      const parsedHeaders = parseCSVLine(lines[0]);
      const dataRows = lines.slice(1).map(parseCSVLine).filter((r) => r.length === parsedHeaders.length || r.length > 1);

      setHeaders(parsedHeaders);
      setRawRows(dataRows);

      // Auto-detect columns intelligently
      parsedHeaders.forEach((h, idx) => {
        const lower = h.toLowerCase();
        if (lower.includes('desc') || lower.includes('title') || lower.includes('particular') || lower.includes('remark') || lower.includes('narration') || lower.includes('payee')) {
          setTitleCol(idx);
        } else if (lower.includes('amount') || lower.includes('withdrawal') || lower.includes('debit') || lower.includes('sum') || lower.includes('val')) {
          setAmountCol(idx);
        } else if (lower.includes('date') || lower.includes('time') || lower.includes('txn')) {
          setDateCol(idx);
        }
      });
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (rawRows.length === 0) return;

    let importedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    rawRows.forEach((row) => {
      const rawTitle = row[titleCol]?.trim();
      const rawAmount = row[amountCol]?.replace(/[^\d.-]/g, '');
      const numAmount = parseFloat(rawAmount);

      if (!rawTitle || isNaN(numAmount) || numAmount <= 0) {
        return; // skip blank/invalid rows
      }

      let parsedDate = today;
      const rawDate = row[dateCol]?.trim();
      if (rawDate) {
        // Try parsing common formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          parsedDate = rawDate;
        } else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(rawDate)) {
          const parts = rawDate.split(/[/-]/);
          // Assuming DD/MM/YYYY
          parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      addTransaction({
        title: rawTitle,
        amount: Math.abs(numAmount),
        type: defaultType,
        categoryId: defaultCategory || categories[0]?.id || 'cat_food',
        date: parsedDate,
        paymentMethod: defaultPaymentMethod || paymentMethods[0]?.id || 'upi',
        notes: `Imported from ${csvFile?.name || 'CSV Statement'}`,
      });
      importedCount++;
    });

    setImportSummary(`Successfully imported ${importedCount} transactions!`);
    setTimeout(() => {
      onClose();
      setCsvFile(null);
      setRawRows([]);
      setImportSummary(null);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 pb-safe sm:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileSpreadsheet size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Import CSV Bank Statement</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">Batch-import transactions from banks, UPI apps, or spreadsheets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={19} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {error && (
            <div className="p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {importSummary && (
            <div className="p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2">
              <Check size={16} />
              <span>{importSummary}</span>
            </div>
          )}

          {!csvFile ? (
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <Upload size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Click to upload statement CSV</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Supports HDFC, SBI, ICICI, Google Pay, or custom sheets</p>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="text-indigo-600 dark:text-indigo-400" size={16} />
                  <span className="font-bold text-slate-800 dark:text-slate-200">{csvFile.name}</span>
                  <span className="text-slate-400 dark:text-slate-500">({rawRows.length} data rows found)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCsvFile(null);
                    setRawRows([]);
                    setHeaders([]);
                  }}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                >
                  Change File
                </button>
              </div>

              {/* Column Mapping Selectors */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                  Map CSV Columns
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Title / Description Column
                    </label>
                    <select
                      value={titleCol}
                      onChange={(e) => setTitleCol(Number(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white outline-none"
                    >
                      {headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Amount Column
                    </label>
                    <select
                      value={amountCol}
                      onChange={(e) => setAmountCol(Number(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white outline-none"
                    >
                      {headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Date Column
                    </label>
                    <select
                      value={dateCol}
                      onChange={(e) => setDateCol(Number(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white outline-none"
                    >
                      {headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Assign Type
                    </label>
                    <select
                      value={defaultType}
                      onChange={(e) => setDefaultType(e.target.value as any)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white outline-none"
                    >
                      <option value="expense">Expense (-)</option>
                      <option value="income">Income (+)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Assign Category
                    </label>
                    <select
                      value={defaultCategory}
                      onChange={(e) => setDefaultCategory(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white outline-none"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={defaultPaymentMethod}
                      onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white outline-none"
                    >
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Preview Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Preview (First 4 Rows)
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Title / Payee</th>
                        <th className="p-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {rawRows.slice(0, 4).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 text-slate-500 dark:text-slate-400">{row[dateCol] || 'Today'}</td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                            {row[titleCol] || 'Transaction'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                            {formatCurrency(parseFloat(row[amountCol]?.replace(/[^\d.-]/g, '') || '0'), settings.currency, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          {csvFile && (
            <button
              type="button"
              onClick={handleImport}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 dark:shadow-none transition flex items-center gap-1.5"
            >
              <span>Import {rawRows.length} Transactions</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

