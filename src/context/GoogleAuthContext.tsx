import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { GoogleUser, GoogleSyncInfo, SyncState, Transaction, Budget, RecurringTransaction } from '../types';
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
};

interface GoogleAuthContextType {
  user: GoogleUser | null;
  accessToken: string | null;
  isTokenExpired: boolean;
  isOfflineMode: boolean;
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
  const envClientId = String((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
  const [customClientId, setCustomClientIdState] = useState<string>(() => {
    return String(localStorage.getItem(AUTH_STORAGE_KEYS.CUSTOM_CLIENT_ID) || '').trim().replace(/^["']|["']$/g, '');
  });

  const effectiveClientId = customClientId || envClientId;
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

  const tokenClientRef = useRef<any>(null);

  const initGoogleTokenClient = useCallback(() => {
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2 || !effectiveClientId) {
      return null;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        error_callback: (nonOAuthError: any) => {
          console.error('Google Token Client non-OAuth error:', JSON.stringify(nonOAuthError));
          const type = nonOAuthError?.type || '';
          const msg = nonOAuthError?.message || type || 'Unknown error';

          if (type === 'popup_failed_to_open') {
            alert(
              `Google Sign-In popup was BLOCKED by your browser.\n\n` +
              `Fix:\n` +
              `1. Look for a blocked popup icon in your browser's address bar (top right of URL bar)\n` +
              `2. Click it and select "Always allow popups from ${window.location.hostname}"\n` +
              `3. Try signing in again.\n\n` +
              `Or: Check that https://${window.location.hostname} is listed in Authorized JavaScript Origins in Google Cloud Console.`
            );
          } else if (type === 'popup_closed_by_user') {
            // User closed it voluntarily — silent
          } else {
            alert(
              `Google Sign-In Error (${type || 'unknown'}): ${msg}\n\n` +
              `Possible causes:\n` +
              `1. This domain (${window.location.hostname}) is not in Authorized JavaScript Origins\n` +
              `2. Browser popup blocker\n` +
              `3. Google API not enabled\n\n` +
              `Check the browser console (F12 → Console) for more detail.`
            );
          }
        },
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Google Auth callback error:', tokenResponse);
            const errorDesc = tokenResponse.error_description || tokenResponse.error;
            setSyncInfo((prev) => ({
              ...prev,
              syncState: 'error',
              errorMessage: errorDesc,
            }));

            if (tokenResponse.error !== 'popup_closed_by_user') {
              if (tokenResponse.error === 'access_denied') {
                alert(`Google Sign-In Blocked (access_denied):\n\nYour Google OAuth app is in "Testing" mode. Only Google accounts added to "Test users" in Google Cloud Console can sign in.\n\nPlease add your Gmail to Test Users in Google Cloud Console -> OAuth consent screen, or publish the app.`);
              } else {
                alert(`Google Sign-In Error: ${errorDesc}`);
              }
            }
            return;
          }

          if (tokenResponse.access_token) {
            const token = tokenResponse.access_token;
            const expiresIn = parseInt(tokenResponse.expires_in, 10) || 3600;
            const expiresAt = Date.now() + expiresIn * 1000;

            setAccessToken(token);
            setTokenExpiresAt(expiresAt);
            localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
            localStorage.setItem(AUTH_STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
            localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'false');
            setIsOfflineMode(false);

            try {
              const profile = await fetchGoogleUserInfo(token);
              setUser(profile);
              localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(profile));

              // Initial Sheet discovery & preparation
              setSyncInfo((prev) => ({ ...prev, syncState: 'syncing' }));
              const sheet = await findOrCreateTrackWiseSheet(token);
              setSyncInfo((prev) => ({
                ...prev,
                spreadsheetId: sheet.spreadsheetId,
                spreadsheetUrl: sheet.spreadsheetUrl,
                syncState: 'idle',
              }));
              localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_ID, sheet.spreadsheetId);
              localStorage.setItem(AUTH_STORAGE_KEYS.SHEET_URL, sheet.spreadsheetUrl);
            } catch (err: any) {
              console.error('Post-login initialization error:', err);
              setSyncInfo((prev) => ({
                ...prev,
                syncState: 'error',
                errorMessage: err.message,
              }));
              alert(`Connected to Google, but failed to initialize Sheet: ${err.message}\n\nPlease check if Google Drive API and Google Sheets API are enabled in Google Cloud Console.`);
            }
          }
        },
      });
      tokenClientRef.current = client;
      return client;
    } catch (err) {
      console.warn('Failed to initialize Google Token Client:', err);
      return null;
    }
  }, [effectiveClientId]);

  // Keep checking until Google GSI script finishes loading
  useEffect(() => {
    if (!effectiveClientId) return;

    if (window.google?.accounts?.oauth2) {
      initGoogleTokenClient();
      return;
    }

    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        initGoogleTokenClient();
        clearInterval(interval);
      }
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [effectiveClientId, initGoogleTokenClient]);

  const loginWithGoogle = useCallback(() => {
    if (!effectiveClientId) {
      alert('Google Client ID is not configured yet. Please enter a Client ID or use Offline Mode.');
      return;
    }

    let client = tokenClientRef.current;
    if (!client) {
      client = initGoogleTokenClient();
    }

    if (client) {
      client.requestAccessToken({ prompt: 'consent' });
    } else {
      alert('Google Sign-In is still loading. Please check your internet connection and try again.');
    }
  }, [effectiveClientId, initGoogleTokenClient]);

  const reconnectSync = useCallback(() => {
    let client = tokenClientRef.current;
    if (!client) {
      client = initGoogleTokenClient();
    }

    if (client) {
      client.requestAccessToken({ prompt: '' });
    } else {
      loginWithGoogle();
    }
  }, [initGoogleTokenClient, loginWithGoogle]);

  const logout = useCallback(() => {
    if (accessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(accessToken, () => {});
      } catch (e) {
        console.warn('Failed to revoke Google token:', e);
      }
    }
    setUser(null);
    setAccessToken(null);
    setTokenExpiresAt(null);
    setIsOfflineMode(false);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(AUTH_STORAGE_KEYS.OFFLINE_MODE);
  }, [accessToken]);

  const continueOffline = useCallback(() => {
    setIsOfflineMode(true);
    localStorage.setItem(AUTH_STORAGE_KEYS.OFFLINE_MODE, 'true');
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

