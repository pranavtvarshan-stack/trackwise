import React from 'react';
import { 
  Wallet, 
  ShieldCheck, 
  FileSpreadsheet, 
  WifiOff, 
  ArrowRight
} from 'lucide-react';
import { useGoogleAuth } from '../../context/GoogleAuthContext';

export const LoginPortal: React.FC = () => {
  const { loginWithGoogle, continueOffline } = useGoogleAuth();

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-['Plus_Jakarta_Sans',sans-serif] relative overflow-hidden transition-colors">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-transparent dark:from-indigo-600/25 dark:via-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Branding */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between z-10 pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-900 dark:from-white dark:to-indigo-300">
                TrackWise
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800 shadow-2xs">
                Pro
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8 z-10">
        <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 sm:p-8 text-center animate-fade-in">
          {/* Logo Badge */}
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mb-5 relative group">
            <div className="absolute inset-0 rounded-2xl bg-indigo-400 blur-lg opacity-40 group-hover:opacity-75 transition-opacity" />
            <Wallet className="w-8 h-8 relative z-10" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
            Welcome to TrackWise
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed">
            Your personal wealth manager with real-time Google Sheets backup & offline capabilities.
          </p>

          {/* Feature Highlights */}
          <div className="space-y-2.5 mb-7 text-left">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <FileSpreadsheet size={15} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-200">Google Sheets Sync</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Automatic backup to your private Google Drive</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                <ShieldCheck size={15} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-200">100% Client-Side Privacy</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">No 3rd-party servers; direct browser-to-Drive sync</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex-shrink-0">
                <WifiOff size={15} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-200">Offline-First Engine</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Track expenses anytime, syncs when reconnected</p>
              </div>
            </div>
          </div>

          {/* Primary Action: Google Sign In */}
          <div className="space-y-3">
            <button
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-white font-bold text-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all active:scale-98 group cursor-pointer"
            >
              {/* Google G Logo */}
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
              <ArrowRight size={15} className="text-slate-400 group-hover:translate-x-1 transition-transform ml-auto" />
            </button>

            {/* Secondary Action: Continue Offline */}
            <button
              onClick={continueOffline}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
            >
              Continue Offline (Local Storage Only)
            </button>
          </div>
        </div>
      </div>

      {/* Footer Security Guarantee */}
      <div className="max-w-md w-full mx-auto text-center z-10 pb-safe">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Local-First Architecture • You control 100% of your data</span>
        </p>
      </div>
    </div>
  );
};
