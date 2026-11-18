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
const OAUTH_PKCE_STORAGE_KEY = 'trackwise_oauth_pkce';

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

// Request strictly drive.file scope + openid email profile
const OAUTH_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';

interface StoredPKCE {
  state: string;
  verifier: string;
  expiresAt: number;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string } | null> {
  if (typeof window === 'undefined' || !window.crypto) {
    return null;
  }
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array.buffer);

  if (window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      const challenge = base64UrlEncode(digest);
      return { verifier, challenge };
    } catch {
      return null;
    }
  }
  return null;
}

interface InitialRedirectResult {
  code: string | null;
  state: string | null;
  error: string | null;
  codeVerifier: string | null;
}

/**
 * StrictMode-Safe Single-Use Code Consumption:
 * Consumes and scrubs ?code=...&state=... from the URL bar immediately at module load
 * so React 18 <StrictMode> double-mounting or page refreshes can NEVER replay the same code.
 */
function consumeRedirectUrlParams(): InitialRedirectResult {
  if (typeof window === 'undefined' || !window.location.search) {
    return { code: null, state: null, error: null, codeVerifier: null };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const error = searchParams.get('error');

  if (!code && !error) {
    return { code: null, state: null, error: null, codeVerifier: null };
  }

  // Always scrub ?code=...&state=... from the URL bar immediately
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {}

  if (error) {
    return {
      code: null,
      state: returnedState,
      error:
        error === 'access_denied'
          ? 'Google Sign-In was cancelled or access was denied.'
          : `Google Sign-In error: ${error}`,
      codeVerifier: null,
    };
  }

  if (!code) {
    return { code: null, state: null, error: null, codeVerifier: null };
  }

  // Validate CSRF state & retrieve PKCE code_verifier from localStorage (with 10-minute expiry)
  const rawPKCE = localStorage.getItem(OAUTH_PKCE_STORAGE_KEY);
  localStorage.removeItem(OAUTH_PKCE_STORAGE_KEY);

  let codeVerifier: string | null = null;
  if (rawPKCE) {
    try {
      const parsed: StoredPKCE = JSON.parse(rawPKCE);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        return {
          code: null,
          state: returnedState,
          error: 'Sign-in session expired (10-minute timeout). Please sign in again.',
          codeVerifier: null,
        };
      }
      if (parsed.state !== returnedState) {
        return {
          code: null,
          state: returnedState,
          error: 'OAuth security state mismatch (possible CSRF attack). Authentication blocked.',
          codeVerifier: null,
        };
      }
      codeVerifier = parsed.verifier;
    } catch {
      return {
        code: null,
        state: returnedState,
        error: 'Corrupt authentication session state. Please sign in again.',
        codeVerifier: null,
      };
    }
  } else {
    return {
      code: null,
      state: returnedState,
      error: 'Missing security session. Please initiate sign-in directly from TrackWise.',
      codeVerifier: null,
    };
  }

  return { code, state: returnedState, error: null, codeVerifier };
}

const initialRedirectResult = consumeRedirectUrlParams();
const redeemedCodeSet = new Set<string>();

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
  loginWithRedirect: () => void;
  logout: () => void;
  continueOffline: () => void;
  setCustomClientId: (id: string) => void;
  reconnectSync: () => void;
  getValidAccessToken: () => Promise<string | null>;
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

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(() => {
    return Boolean(initialRedirectResult.code && !initialRedirectResult.error);
  });
  const [authError, setAuthError] = useState<string | null>(() => initialRedirectResult.error);

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

  // Shared authorization code processing function with exact redirect_uri and PKCE verifier
  const processAuthCode = useCallback(
    async (code: string, redirectUri: string, codeVerifier: string | null) => {
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        const exchangeRes = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier || undefined,
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
        setIsOfflineMode(false);
        localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'false');

        // Fetch user identity profile
        const profile = await fetchGoogleUserInfo(freshToken);
        setUser(profile);
        localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(profile));
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
    []
  );

  // Single-use execution of initial redirect result (StrictMode-safe guard)
  useEffect(() => {
    if (initialRedirectResult.code && !redeemedCodeSet.has(initialRedirectResult.code)) {
      redeemedCodeSet.add(initialRedirectResult.code);
      const exactOrigin = window.location.origin; // Strictly window.location.origin without trailing slash
      processAuthCode(
        initialRedirectResult.code,
        exactOrigin,
        initialRedirectResult.codeVerifier
      );
    }
  }, [processAuthCode]);

  // Try silent session restoration on initial mount via HttpOnly refresh cookie
  useEffect(() => {
    let mounted = true;
    const trySilentRestore = async () => {
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
   * Primary Sign-In Method: Direct Redirect Flow (response_type=code) with PKCE (S256) & CSRF state.
   * Stores PKCE verifier + state in localStorage with 10-minute expiry (mobile PWA safe).
   * Strictly matches window.location.origin (no trailing slash).
   */
  const loginWithRedirect = useCallback(async () => {
    setAuthError(null);
    if (!effectiveClientId) {
      setAuthError('Google Client ID is not configured. Please check VITE_GOOGLE_CLIENT_ID.');
      return;
    }

    const redirectUri = window.location.origin;

    const state =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    let challenge = '';
    let verifier = '';
    try {
      const pkce = await generatePKCE();
      if (pkce) {
        verifier = pkce.verifier;
        challenge = pkce.challenge;
      }
    } catch (e) {
      console.warn('PKCE generation failed:', e);
    }

    // Save PKCE session to localStorage with 10-minute expiry
    const pkceSession: StoredPKCE = {
      state,
      verifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    localStorage.setItem(OAUTH_PKCE_STORAGE_KEY, JSON.stringify(pkceSession));

    const params = new URLSearchParams({
      client_id: effectiveClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: OAUTH_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    if (challenge) {
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }

    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }, [effectiveClientId]);

  // Primary entrypoint is now Direct Redirect
  const loginWithGoogle = useCallback(() => {
    loginWithRedirect();
  }, [loginWithRedirect]);

  const reconnectSync = useCallback(() => {
    loginWithRedirect();
  }, [loginWithRedirect]);

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
    localStorage.removeItem(OAUTH_PKCE_STORAGE_KEY);
  }, []);

  const continueOffline = useCallback(() => {
    setIsOfflineMode(true);
    setAuthError(null);
    localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'true');
  }, []);

  /**
   * Execute mutex-protected Live-Index Incremental Sync cycle
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
        loginWithRedirect,
        logout,
        continueOffline,
        setCustomClientId,
        reconnectSync,
        getValidAccessToken,
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
