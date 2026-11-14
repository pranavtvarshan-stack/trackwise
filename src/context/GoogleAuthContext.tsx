import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { GoogleUser, GoogleSyncInfo, SyncState, Transaction, Budget } from '../types';
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
    upiBalance: number,
    cashBalance: number,
    currencySymbol: string,
    onPullData?: (pulled: { transactions: Transaction[]; budgets: Budget[] }) => void
  ) => Promise<boolean>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const [customClientId, setCustomClientIdState] = useState<string>(() => {
    return localStorage.getItem(AUTH_STORAGE_KEYS.CUSTOM_CLIENT_ID) || '';
  });

  const effectiveClientId = customClientId.trim() || envClientId.trim();
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

  // Initialize or reconfigure Google Token Client
  useEffect(() => {
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2 || !effectiveClientId) {
      return;
    }

    try {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Google Auth callback error:', tokenResponse);
            setSyncInfo((prev) => ({
              ...prev,
              syncState: 'error',
              errorMessage: tokenResponse.error_description || tokenResponse.error,
            }));
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

              // Initial Sheet discovery
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
            }
          }
        },
      });
    } catch (err) {
      console.warn('Failed to initialize Google Token Client:', err);
    }
  }, [effectiveClientId]);

  const loginWithGoogle = useCallback(() => {
    if (!effectiveClientId) {
      alert('Google Client ID is not configured yet. Please enter a Client ID or use Offline Mode.');
      return;
    }

    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } else if (window.google?.accounts?.oauth2) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        callback: () => {},
      });
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } else {
      alert('Google Sign-In is still loading. Please check your internet connection and try again.');
    }
  }, [effectiveClientId]);

  const reconnectSync = useCallback(() => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: '' });
    } else {
      loginWithGoogle();
    }
  }, [loginWithGoogle]);

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
   * Sync local engine with Google Sheet (Hybrid local-first push & pull)
   */
  const performSync = useCallback(
    async (
      transactions: Transaction[],
      budgets: Budget[],
      upiBalance: number,
      cashBalance: number,
      currencySymbol: string,
      onPullData?: (pulled: { transactions: Transaction[]; budgets: Budget[] }) => void
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

        // Pull existing data if initial sync on a new device/browser
        if (transactions.length === 0 && onPullData) {
          try {
            const remoteData = await pullDataFromSheet(accessToken, sheetId);
            if (remoteData.transactions.length > 0 || remoteData.budgets.length > 0) {
              onPullData(remoteData);
            }
          } catch (pullErr) {
            console.warn('Initial pull failed, proceeding to push:', pullErr);
          }
        }

        // Push current data state to Google Sheet
        await pushDataToSheet(
          accessToken,
          sheetId,
          transactions,
          budgets,
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

