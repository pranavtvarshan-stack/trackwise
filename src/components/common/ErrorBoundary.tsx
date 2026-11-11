import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TrackWise Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleClearData = () => {
    if (window.confirm('Reset all local data? This will clear local storage and reload the app.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              TrackWise encountered an unexpected issue while rendering. Your data in local storage is safe.
            </p>

            {this.state.error && (
              <div className="text-left bg-slate-100 dark:bg-slate-800/80 rounded-xl p-3 mb-6 overflow-auto max-h-32 text-xs font-mono text-slate-600 dark:text-slate-300">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-md transition"
              >
                <RefreshCw size={16} />
                <span>Reload Application</span>
              </button>
              
              <button
                onClick={this.handleClearData}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-xl transition"
                title="If persistent corruption occurs, clear storage"
              >
                <Trash2 size={14} className="text-rose-500" />
                <span>Clear Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

