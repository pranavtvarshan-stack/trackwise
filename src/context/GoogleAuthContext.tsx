import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleUser, GoogleSyncInfo, Transaction, Budget, RecurringTransaction } from '../types';
import {
  fetchGoogleUserInfo,
  findOrCreateTrackWiseSheet,
  pullDataFromSheet,
  pushDataToSheet,
} from '../services/googleSheetsService';

const AUTH_STORAGE_KEYS = {
  USER: 'trackwise_google_user',
  TOKEN: 'trackwise_google_token',
  EXPIRES_AT: 'trackwise_google_expires_at',
  OFFLINE_MODE: 'trackwise_offline_mode',
  CUSTOM_CLIENT_ID: 'trackwise_custom_client_id',
  SHEET_ID: 'trackwise_sheet_id',
  SHEET_URL: 'trackwise_sheet_url',
  LAST_SYNC: 'trackwise_last_sync',
  OAUTH_STATE: 'trackwise_oauth_state',
};

const OAUTH_SCOPES =
  'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

/**
 * Parse OAuth 2.0 redirect callback from window.location.hash ONCE at module load.
 * Running outside React effects prevents React 18 StrictMode double-mount from
 * losing the access token after scrubbing the URL hash.
 */
interface OAuthRedirectResult {
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
}

function consumeOAuthRedirectHash(): OAuthRedirectResult {
  if (typeof window === 'undefined' || !window.location.hash) {
    return { accessToken: null, expiresAt: null, error: null };
  }

  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  // Only handle hashes that look like an OAuth2 response
  if (!rawHash.includes('access_token=') && !rawHash.includes('error=')) {
    return { accessToken: null, expiresAt: null, error: null };
  }

  const params = new URLSearchParams(rawHash);
  const accessToken = params.get('access_token');
  const expiresInRaw = params.get('expires_in');
  const returnedState = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  // Always scrub sensitive OAuth parameters from the URL bar immediately
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // Ignore history API restrictions
  }

  // Validate CSRF state if we saved one prior to redirecting
  const savedState = sessionStorage.getItem(AUTH_STORAGE_KEYS.OAUTH_STATE);
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.OAUTH_STATE);

  if (error) {
    if (error === 'access_denied') {
      return {
        accessToken: null,
        expiresAt: null,
        error:
          'Google Sign-In was cancelled or access was denied. If your OAuth app is in Testing mode, make sure your Gmail is added under Test Users in Google Cloud Console.',
      };
    }
    return {
      accessToken: null,
      expiresAt: null,
      error: errorDescription || error,
    };
  }

  if (savedState && returnedState && savedState !== returnedState) {
    return {
      accessToken: null,
      expiresAt: null,
      error: 'OAuth security state mismatch. Please try signing in again.',
    };
  }

  if (accessToken) {
    const expiresIn = parseInt(expiresInRaw || '3600', 10) || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, accessToken);
    localStorage.setItem(AUTH_STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
    localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'false');

    return { accessToken, expiresAt, error: null };
  }

  return { accessToken: null, expiresAt: null, error: null };
}

const initialRedirectResult = consumeOAuthRedirectHash();

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
  performSync: (
    transactions: Transaction[],
    budgets: Budget[],
    recurring: RecurringTransaction[],
    upiBalance: number,
    cashBalance: number,
    currencySymbol: string
  ) => Promise<boolean>;
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

  // Prioritize build-time VITE_GOOGLE_CLIENT_ID so stale localStorage overrides cannot break login
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
    return initialRedirectResult.accessToken || localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN) || null;
  });

  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(() => {
    if (initialRedirectResult.expiresAt) return initialRedirectResult.expiresAt;
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.EXPIRES_AT);
    return raw ? parseInt(raw, 10) : null;
  });

  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    if (initialRedirectResult.accessToken) return false;
    return localStorage.getItem(AUTH_STORAGE_KEYS.OFFLINE_MODE) === 'true';
  });

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(() => {
    return Boolean(initialRedirectResult.accessToken);
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

  const isTokenExpired = Boolean(
    accessToken && tokenExpiresAt && Date.now() > tokenExpiresAt - 60000 // 1 minute buffer
  );

  // Finish sign-in after returning from Google OAuth redirect (or when token exists without user profile)
  useEffect(() => {
    if (!accessToken || isTokenExpired) {
      setIsAuthenticating(false);
      return;
    }

    const needsAuthFinalize = Boolean(initialRedirectResult.accessToken) || !user;
    if (!needsAuthFinalize) {
      setIsAuthenticating(false);
      return;
    }

    let cancelled = false;

    const finalizeLogin = async () => {
      if (!user) {
        setIsAuthenticating(true);
      }
      setAuthError(null);
      try {
        const profile = await fetchGoogleUserInfo(accessToken);
        if (cancelled) return;

        setUser(profile);
        localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(profile));
        setIsOfflineMode(false);
        localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'false');
        setIsAuthenticating(false);

        // Discover or create the user's TrackWise Google Sheet in background
        setSyncInfo((prev) => ({ ...prev, syncState: 'syncing', errorMessage: undefined }));
        const sheet = await findOrCreateTrackWiseSheet(accessToken);
        if (cancelled) return;

        setSyncInfo((prev) => ({
          ...prev,
          spreadsheetId: sheet.spreadsheetId,
          spreadsheetUrl: sheet.spreadsheetUrl,
          syncState: 'idle',
        }));
        localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_ID, sheet.spreadsheetId);
        localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_URL, sheet.spreadsheetUrl);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Post-login initialization error:', err);
        const message =
          err?.message === 'TOKEN_EXPIRED'
            ? 'Your Google session expired. Please sign in again.'
            : err?.message || 'Failed to connect to Google Drive / Sheets.';
        setAuthError(message);
        setSyncInfo((prev) => ({
          ...prev,
          syncState: 'error',
          errorMessage: message,
        }));
        setIsAuthenticating(false);
      }
    };

    finalizeLogin();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  /**
   * Launch Google OAuth 2.0 Direct Redirect Flow.
   * Uses a full-page redirect instead of a popup window so it works reliably
   * across Opera, Chrome, Brave, Safari, Mobile browsers, and installed PWAs
   * with zero COOP / window.closed / popup-blocker issues.
   */
  const startGoogleOAuthRedirect = useCallback(
    (options?: { prompt?: string; loginHint?: string }) => {
      if (!effectiveClientId) {
        setAuthError('Google Client ID is not configured. Please check VITE_GOOGLE_CLIENT_ID.');
        return;
      }

      const state =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

      sessionStorage.setItem(AUTH_STORAGE_KEYS.OAUTH_STATE, state);

      const redirectUri = window.location.origin;
      const params = new URLSearchParams({
        client_id: effectiveClientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: OAUTH_SCOPES,
        include_granted_scopes: 'true',
        state,
      });

      if (options?.prompt) {
        params.set('prompt', options.prompt);
      }
      if (options?.loginHint) {
        params.set('login_hint', options.loginHint);
      }

      window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    },
    [effectiveClientId]
  );

  const loginWithGoogle = useCallback(() => {
    setAuthError(null);
    startGoogleOAuthRedirect({ prompt: 'select_account consent' });
  }, [startGoogleOAuthRedirect]);

  const reconnectSync = useCallback(() => {
    setAuthError(null);
    startGoogleOAuthRedirect({ loginHint: user?.email });
  }, [startGoogleOAuthRedirect, user?.email]);

  const logout = useCallback(() => {
    if (accessToken) {
      // Best-effort token revocation via Google's REST endpoint
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => {});
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
  }, [accessToken]);

  const continueOffline = useCallback(() => {
    setIsOfflineMode(true);
    setAuthError(null);
    localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'true');
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const setCustomClientId = useCallback((id: string) => {
    const trimmed = id.trim();
    setCustomClientIdState(trimmed);
    localStorage.setItem(AUTH_STORAGE_KEYS.CUSTOM_CLIENT_ID, trimmed);
  }, []);

  /**
   * Pull all transactions, budgets, and recurring bills from Google Sheets
   */
  const pullFromSheet = useCallback(
    async (): Promise<{ transactions: Transaction[]; budgets: Budget[]; recurring: RecurringTransaction[] } | null> => {
      if (!accessToken || !navigator.onLine) return null;
      try {
        let sheetId = syncInfo.spreadsheetId;
        if (!sheetId) {
          const sheet = await findOrCreateTrackWiseSheet(accessToken);
          sheetId = sheet.spreadsheetId;
          setSyncInfo((prev) => ({
            ...prev,
            spreadsheetId: sheet.spreadsheetId,
            spreadsheetUrl: sheet.spreadsheetUrl,
          }));
          localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_ID, sheet.spreadsheetId);
          localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_URL, sheet.spreadsheetUrl);
        }
        if (!sheetId) return null;

        setSyncInfo((prev) => ({ ...prev, syncState: 'syncing' }));
        const remoteData = await pullDataFromSheet(accessToken, sheetId);

        const now = new Date().toISOString();
        setSyncInfo((prev) => ({
          ...prev,
          syncState: 'synced',
          lastSyncedAt: now,
          pendingCount: 0,
        }));
        localStorage.setItem(AUTH_STORAGE_KEYS.LAST_SYNC, now);
        return remoteData;
      } catch (err: any) {
        console.error('Failed to pull from Google Sheet:', err);
        if (err.message === 'TOKEN_EXPIRED') {
          setSyncInfo((prev) => ({ ...prev, syncState: 'token_expired' }));
        } else {
          setSyncInfo((prev) => ({
            ...prev,
            syncState: 'error',
            errorMessage: err.message || 'Pull failed',
          }));
        }
        return null;
      }
    },
    [accessToken, syncInfo.spreadsheetId]
  );

  /**
   * Sync local engine with Google Sheet (Hybrid local-first push & pull)
   */
  const performSync = useCallback(
    async (
      transactions: Transaction[],
      budgets: Budget[],
      recurring: RecurringTransaction[],
      upiBalance: number,
      cashBalance: number,
      currencySymbol: string
    ): Promise<boolean> => {
      if (!accessToken || !user || !navigator.onLine) {
        return false;
      }

      if (isTokenExpired) {
        setSyncInfo((prev) => ({ ...prev, syncState: 'token_expired' }));
        return false;
      }

      setSyncInfo((prev) => ({ ...prev, syncState: 'syncing', errorMessage: undefined }));

      try {
        let sheetId = syncInfo.spreadsheetId;
        if (!sheetId) {
          const sheet = await findOrCreateTrackWiseSheet(accessToken);
          sheetId = sheet.spreadsheetId;
          setSyncInfo((prev) => ({
            ...prev,
            spreadsheetId: sheet.spreadsheetId,
            spreadsheetUrl: sheet.spreadsheetUrl,
          }));
          localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_ID, sheet.spreadsheetId);
          localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_URL, sheet.spreadsheetUrl);
        }

        // Push current data state to Google Sheet
        await pushDataToSheet(
          accessToken,
          sheetId,
          transactions,
          budgets,
          recurring,
          upiBalance,
          cashBalance,
          currencySymbol
        );

        const now = new Date().toISOString();
        setSyncInfo((prev) => ({
          ...prev,
          syncState: 'synced',
          lastSyncedAt: now,
          pendingCount: 0,
        }));
        localStorage.setItem(AUTH_STORAGE_KEYS.LAST_SYNC, now);
        return true;
      } catch (err: any) {
        console.error('Google Sheets sync error:', err);
        if (err.message === 'TOKEN_EXPIRED') {
          setSyncInfo((prev) => ({ ...prev, syncState: 'token_expired' }));
        } else {
          setSyncInfo((prev) => ({
            ...prev,
            syncState: 'error',
            errorMessage: err.message || 'Sync failed',
          }));
        }
        return false;
      }
    },
    [accessToken, user, isTokenExpired, syncInfo.spreadsheetId]
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
