import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleUser, GoogleSyncInfo, Transaction, Budget, RecurringTransaction, SyncResult } from '../types';
import {
  fetchGoogleUserInfo,
  findOrCreateTrackWiseSheet,
  pullDataFromSheet,
  pushIncrementalDataToSheet,
  mergeEntityCollections,
  areTransactionsEqual,
  areBudgetsEqual,
  areRecurringEqual,
  computeSplitWalletBalances,
  hasExpiredTombstones,
} from '../services/googleSheetsService';

const SYNC_LOCK_NAME = 'trackwise_sheets_sync';

// In-memory sequential fallback mutex when Web Locks API is unavailable
let fallbackSyncLockChain: Promise<void> = Promise.resolve();

async function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request(SYNC_LOCK_NAME, async () => {
      return task();
    });
  }

  const prev = fallbackSyncLockChain;
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  fallbackSyncLockChain = prev.then(() => next);

  try {
    await prev;
    return await task();
  } finally {
    release();
  }
}

export const AUTH_STORAGE_KEYS = {
  USER: 'trackwise_auth_user',
  TOKEN: 'trackwise_auth_token',
  EXPIRES_AT: 'trackwise_auth_expires_at',
  OFFLINE_MODE: 'trackwise_offline_mode',
  CUSTOM_CLIENT_ID: 'trackwise_custom_google_client_id',
  SHEET_ID: 'trackwise_sheet_id',
  SHEET_URL: 'trackwise_sheet_url',
  LAST_SYNC: 'trackwise_last_sync',
  OAUTH_STATE: 'trackwise_oauth_state',
};

// Request strictly drive.file scope + openid email profile (removing broad spreadsheets scope)
const OAUTH_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';

let gisLoadPromise: Promise<void> | null = null;
function loadGIS(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

interface GoogleAuthContextType {
  user: GoogleUser | null;
  accessToken: string | null;
  isTokenExpired: boolean;
  isOfflineMode: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  clearAuthError: () => void;
  syncInfo: GoogleSyncInfo;
  effectiveClientId: string;
  isConfigured: boolean;
  loginWithGoogle: () => void;
  logout: () => void;
  continueOffline: () => void;
  setCustomClientId: (id: string) => void;
  reconnectSync: () => void;
  getValidAccessToken: () => Promise<string | null>;
  exportPairingToken: () => Promise<string>;
  pairWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  performSync: (
    transactions: Transaction[],
    budgets: Budget[],
    recurring: RecurringTransaction[],
    upiBalance: number,
    cashBalance: number,
    currencySymbol: string
  ) => Promise<SyncResult>;
  pullFromSheet: () => Promise<{ transactions: Transaction[]; budgets: Budget[]; recurring: RecurringTransaction[] } | null>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envClientId = String((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const [customClientId, setCustomClientIdState] = useState<string>(() => {
    return String(localStorage.getItem(AUTH_STORAGE_KEYS.CUSTOM_CLIENT_ID) || '')
      .trim()
      .replace(/^["']|["']$/g, '');
  });

  const effectiveClientId = envClientId || customClientId;
  const isConfigured = Boolean(effectiveClientId);

  const [user, setUser] = useState<GoogleUser | null>(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN) || null;
  });

  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.EXPIRES_AT);
    return raw ? parseInt(raw, 10) : null;
  });

  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_STORAGE_KEYS.OFFLINE_MODE) === 'true';
  });

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [syncInfo, setSyncInfo] = useState<GoogleSyncInfo>(() => {
    return {
      spreadsheetId: localStorage.getItem(AUTH_STORAGE_KEYS.SHEET_ID) || null,
      spreadsheetUrl: localStorage.getItem(AUTH_STORAGE_KEYS.SHEET_URL) || null,
      lastSyncedAt: localStorage.getItem(AUTH_STORAGE_KEYS.LAST_SYNC) || null,
      syncState: 'idle',
      pendingCount: 0,
    };
  });

  // Always-fresh token accessor: calls /api/auth/refresh silently whenever expiring within 60 seconds
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
      return accessToken;
    }

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          const freshToken = data.access_token;
          const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          setAccessToken(freshToken);
          setTokenExpiresAt(expiresAt);
          localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, freshToken);
          localStorage.setItem(AUTH_STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
          return freshToken;
        }
      }
    } catch (e) {
      console.warn('[TrackWise Auth] Silent token refresh attempt failed:', e);
    }

    return accessToken;
  }, [accessToken, tokenExpiresAt]);

  // Try silent session restoration on initial mount via HttpOnly refresh cookie
  useEffect(() => {
    let mounted = true;
    const trySilentRestore = async () => {
      // If we already have a valid token in memory, nothing to do
      if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
        return;
      }
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.access_token) {
            const freshToken = data.access_token;
            const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
            setAccessToken(freshToken);
            setTokenExpiresAt(expiresAt);
            localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, freshToken);
            localStorage.setItem(AUTH_STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());

            if (!user) {
              const profile = await fetchGoogleUserInfo(freshToken);
              if (mounted) {
                setUser(profile);
                localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(profile));
                setIsOfflineMode(false);
                localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'false');
              }
            }
          }
        }
      } catch {
        // Silently ignore if no refresh cookie exists yet
      }
    };

    trySilentRestore();
    return () => {
      mounted = false;
    };
  }, []);

  const isTokenExpired = Boolean(
    accessToken && tokenExpiresAt && Date.now() > tokenExpiresAt - 60000
  );

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const setCustomClientId = useCallback((id: string) => {
    const cleaned = id.trim().replace(/^["']|["']$/g, '');
    setCustomClientIdState(cleaned);
    if (cleaned) {
      localStorage.setItem(AUTH_STORAGE_KEYS.CUSTOM_CLIENT_ID, cleaned);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.CUSTOM_CLIENT_ID);
    }
  }, []);

  /**
   * Launch XSS-Proof OAuth Authorization Code Flow via Google Identity Services (GIS)
   * Uses initCodeClient (popup mode with postmessage redirect) so it works cleanly without
   * redirect_uri_mismatch errors, and stores the refresh token in an HttpOnly cookie.
   */
  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);

    if (!effectiveClientId) {
      setAuthError('Google Client ID is not configured. Please check VITE_GOOGLE_CLIENT_ID.');
      return;
    }

    setIsAuthenticating(true);

    try {
      await loadGIS();

      if (!(window as any).google?.accounts?.oauth2?.initCodeClient) {
        throw new Error('Google Identity Services failed to initialize. Please check your internet connection.');
      }

      const client = (window as any).google.accounts.oauth2.initCodeClient({
        client_id: effectiveClientId,
        scope: OAUTH_SCOPES,
        ux_mode: 'popup',
        access_type: 'offline',
        prompt: 'consent',
        callback: async (response: { code?: string; error?: string }) => {
          if (response.error) {
            setIsAuthenticating(false);
            if (response.error === 'access_denied') {
              setAuthError('Google Sign-In was cancelled or access was denied.');
            } else {
              setAuthError(`Google Sign-In error: ${response.error}`);
            }
            return;
          }

          if (!response.code) {
            setIsAuthenticating(false);
            setAuthError('No authorization code was returned by Google.');
            return;
          }

          try {
            // Exchange authorization code for tokens via backend serverless route
            const exchangeRes = await fetch('/api/auth/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                code: response.code,
                redirect_uri: 'postmessage',
              }),
            });

            const exchangeData = await exchangeRes.json();
            if (!exchangeRes.ok || exchangeData.error) {
              throw new Error(exchangeData.error || 'Failed to exchange authorization code.');
            }

            const freshToken = exchangeData.access_token;
            const expiresIn = exchangeData.expires_in || 3600;
            const expiresAt = Date.now() + expiresIn * 1000;

            setAccessToken(freshToken);
            setTokenExpiresAt(expiresAt);
            localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, freshToken);
            localStorage.setItem(AUTH_STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
            localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'false');

            // Fetch user identity profile
            const profile = await fetchGoogleUserInfo(freshToken);
            setUser(profile);
            localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(profile));
            setIsOfflineMode(false);
            setIsAuthenticating(false);

            // Discover or create Google Sheet
            setSyncInfo((prev) => ({ ...prev, syncState: 'syncing', errorMessage: undefined }));
            const sheet = await findOrCreateTrackWiseSheet(freshToken);
            setSyncInfo((prev) => ({
              ...prev,
              spreadsheetId: sheet.spreadsheetId,
              spreadsheetUrl: sheet.spreadsheetUrl,
              syncState: 'idle',
            }));
            localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_ID, sheet.spreadsheetId);
            localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_URL, sheet.spreadsheetUrl);
          } catch (err: any) {
            console.error('Auth code exchange error:', err);
            setIsAuthenticating(false);
            setAuthError(err.message || 'Failed to complete Google Sign-In exchange.');
          }
        },
        error_callback: (err: any) => {
          setIsAuthenticating(false);
          if (err?.type === 'popup_closed') {
            setAuthError('Google Sign-In cancelled (popup was closed).');
          } else if (err?.type === 'popup_failed_to_open') {
            setAuthError('Sign-in popup blocked by browser. Please allow popups for TrackWise and retry.');
          } else {
            setAuthError(err?.message || 'Google Sign-In popup failed to open.');
          }
        },
      });

      client.requestCode();
    } catch (err: any) {
      setIsAuthenticating(false);
      setAuthError(err.message || 'Failed to start Google Sign-In.');
    }
  }, [effectiveClientId]);

  const reconnectSync = useCallback(() => {
    loginWithGoogle();
  }, [loginWithGoogle]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue client cleanup even if network request fails
    }

    setUser(null);
    setAccessToken(null);
    setTokenExpiresAt(null);
    setIsOfflineMode(false);
    setAuthError(null);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(AUTH_STORAGE_KEYS.OFFLINE_MODE);
    localStorage.removeItem(AUTH_STORAGE_KEYS.SHEET_ID);
    localStorage.removeItem(AUTH_STORAGE_KEYS.SHEET_URL);
  }, []);

  const continueOffline = useCallback(() => {
    setIsOfflineMode(true);
    setAuthError(null);
    localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'true');
  }, []);

  /**
   * Stateless Encrypted iOS PWA Pairing: Export pairing token from Safari
   */
  const exportPairingToken = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/auth/handoff', {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to generate iOS PWA pairing token');
    }
    return data.pairingToken;
  }, []);

  /**
   * Stateless Encrypted iOS PWA Pairing: Import pairing token inside installed PWA
   */
  const pairWithToken = useCallback(
    async (pairingToken: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pairingToken }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.error || 'Pairing token verification failed' };
        }

        const freshToken = await getValidAccessToken();
        if (freshToken) {
          const profile = await fetchGoogleUserInfo(freshToken);
          setUser(profile);
          localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(profile));
          setIsOfflineMode(false);
          localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'false');
          return { success: true };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Pairing request failed' };
      }
    },
    [getValidAccessToken]
  );

  /**
   * Execute mutex-protected Live-Index Incremental Sync cycle:
   * 1. Acquires navigator.locks 'trackwise_sheets_sync' mutex.
   * 2. Pulls remote rows and builds live row index map Map<id, actualSheetRowNumber>.
   * 3. Deterministically reconciles local + remote per ID (monotonic rev -> updatedAt).
   * 4. If nothing changed remotely, skips all write calls completely.
   * 5. If 30-day tombstone purge occurred: values:batchClear + full rewrite.
   *    Otherwise: updates modified rows via values:batchUpdate and appends brand-new rows via values:append.
   */
  const performSync = useCallback(
    async (
      transactions: Transaction[],
      budgets: Budget[],
      recurring: RecurringTransaction[],
      _upiBalance: number,
      _cashBalance: number,
      currencySymbol: string
    ): Promise<SyncResult> => {
      if (!user || !navigator.onLine) {
        return { success: false };
      }

      // Auto-refresh token if needed before syncing
      const activeToken = await getValidAccessToken();
      if (!activeToken) {
        setSyncInfo((prev) => ({ ...prev, syncState: 'token_expired' }));
        return { success: false };
      }

      return withSyncLock(async (): Promise<SyncResult> => {
        if (!navigator.onLine) {
          return { success: false };
        }

        setSyncInfo((prev) => ({ ...prev, syncState: 'syncing', errorMessage: undefined }));

        try {
          let sheetId = syncInfo.spreadsheetId || localStorage.getItem(AUTH_STORAGE_KEYS.SHEET_ID);
          if (!sheetId) {
            const sheet = await findOrCreateTrackWiseSheet(activeToken);
            sheetId = sheet.spreadsheetId;
            setSyncInfo((prev) => ({
              ...prev,
              spreadsheetId: sheet.spreadsheetId,
              spreadsheetUrl: sheet.spreadsheetUrl,
            }));
            localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_ID, sheet.spreadsheetId);
            localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_URL, sheet.spreadsheetUrl);
          }

          // Step 1: Pull latest remote rows + build live row index map
          const remoteData = await pullDataFromSheet(activeToken, sheetId);

          // Step 2: Deterministic per-ID reconciliation + 30-day tombstone check
          const nowMs = Date.now();
          const tombstonePurged =
            hasExpiredTombstones(transactions, remoteData.transactions, nowMs) ||
            hasExpiredTombstones(budgets, remoteData.budgets, nowMs) ||
            hasExpiredTombstones(recurring, remoteData.recurring, nowMs);

          const mergedTransactions = mergeEntityCollections(transactions, remoteData.transactions, nowMs);
          const mergedBudgets = mergeEntityCollections(budgets, remoteData.budgets, nowMs);
          const mergedRecurring = mergeEntityCollections(recurring, remoteData.recurring, nowMs);

          // Step 3: Compute live split balances
          const { upiBalance: mergedUpiBalance, cashBalance: mergedCashBalance } =
            computeSplitWalletBalances(mergedTransactions);

          // Step 4: Incremental push (skips write calls if !remoteChanged)
          await pushIncrementalDataToSheet(
            activeToken,
            sheetId,
            mergedTransactions,
            mergedBudgets,
            mergedRecurring,
            remoteData,
            tombstonePurged,
            mergedUpiBalance,
            mergedCashBalance,
            currencySymbol
          );

          const nowIso = new Date().toISOString();
          setSyncInfo((prev) => ({
            ...prev,
            syncState: 'synced',
            lastSyncedAt: nowIso,
            pendingCount: 0,
          }));
          localStorage.setItem(AUTH_STORAGE_KEYS.LAST_SYNC, nowIso);

          return {
            success: true,
            mergedTransactions,
            mergedBudgets,
            mergedRecurring,
            localChanged: {
              transactions: !areTransactionsEqual(transactions, mergedTransactions),
              budgets: !areBudgetsEqual(budgets, mergedBudgets),
              recurring: !areRecurringEqual(recurring, mergedRecurring),
            },
          };
        } catch (err: any) {
          console.error('TrackWise Sheets Sync Error:', err);
          const isExp = err?.message === 'TOKEN_EXPIRED';
          setSyncInfo((prev) => ({
            ...prev,
            syncState: isExp ? 'token_expired' : 'error',
            errorMessage: isExp ? 'Token expired. Please reconnect Google.' : err?.message || 'Sync failed.',
          }));
          return { success: false };
        }
      });
    },
    [user, syncInfo.spreadsheetId, getValidAccessToken]
  );

  const pullFromSheet = useCallback(
    async (): Promise<{ transactions: Transaction[]; budgets: Budget[]; recurring: RecurringTransaction[] } | null> => {
      const activeToken = await getValidAccessToken();
      if (!activeToken) return null;
      const sheetId = syncInfo.spreadsheetId || localStorage.getItem(AUTH_STORAGE_KEYS.SHEET_ID);
      if (!sheetId) return null;
      try {
        const data = await pullDataFromSheet(activeToken, sheetId);
        return {
          transactions: data.transactions,
          budgets: data.budgets,
          recurring: data.recurring,
        };
      } catch {
        return null;
      }
    },
    [getValidAccessToken, syncInfo.spreadsheetId]
  );

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        accessToken,
        isTokenExpired,
        isOfflineMode,
        isAuthenticating,
        authError,
        clearAuthError,
        syncInfo,
        effectiveClientId,
        isConfigured,
        loginWithGoogle,
        logout,
        continueOffline,
        setCustomClientId,
        reconnectSync,
        getValidAccessToken,
        exportPairingToken,
        pairWithToken,
        performSync,
        pullFromSheet,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
};
