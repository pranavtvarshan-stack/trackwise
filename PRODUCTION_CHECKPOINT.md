# Production Ready Checkpoint: TrackWise Pro v1.1.0

**Milestone:** Production-Ready Gold Master  
**Version:** `1.1.0`  
**Checkpoint Date:** November 19, 2026  
**Live Production URL:** [https://trackwise-ruddy.vercel.app/](https://trackwise-ruddy.vercel.app/)  
**Git Branch:** `main`  
**Base Commit Hash:** `a729e81`  

---

## 1. Checkpoint Verification Summary

This checkpoint certifies that TrackWise Pro has passed all functional, security, and architectural audits:

| Component | Status | Verification Detail |
| :--- | :--- | :--- |
| **Authentication Flow** | **VERIFIED** | OAuth 2.0 Direct Redirect with PKCE (S256) & CSRF state verification |
| **Token Security** | **VERIFIED** | Refresh tokens stored exclusively in `HttpOnly; Secure; SameSite=Lax` cookies |
| **Silent Refresh** | **VERIFIED** | Ephemeral access tokens renewed silently without hourly user interruption |
| **Local Storage Engine** | **VERIFIED** | Primary ledger stored in IndexedDB with per-email account isolation |
| **Storage Persistence** | **VERIFIED** | `navigator.storage.persist()` durability lock active against iOS eviction |
| **Incremental Sync** | **VERIFIED** | Live row-index reconciliation via Google Sheets API (no stale row caches) |
| **Split Wallets** | **VERIFIED** | Mathematical balance isolation between UPI, Cash, and Bank accounts |
| **Offline Resilience** | **VERIFIED** | Service Worker v4 with network-first navigation & static asset caching |
| **Mobile PWA** | **VERIFIED** | Web App Manifest with full PNG icon suite (`icon-192`, `icon-512`, maskable) |
| **TypeScript / Build** | **VERIFIED** | Zero compile errors on Vite 6 / TypeScript 5.6 (`tsc --noEmit` clean) |

---

## 2. Architecture Specifications at this Checkpoint

### 2.1 Security & OAuth 2.0 PKCE
* **Direct Redirect Initiation**:
  * Redirects browser top-level to `https://accounts.google.com/o/oauth2/v2/auth`.
  * Generates random CSRF `state` and 32-byte PKCE `code_verifier` with SHA-256 base64url `code_challenge`.
  * Preserves PKCE session in `localStorage` (`trackwise_oauth_pkce`) with a 10-minute TTL to survive mobile browser-to-PWA app switching.
  * Requests strictly minimal scopes: `openid email profile https://www.googleapis.com/auth/drive.file`.
* **StrictMode-Safe Single-Use Code Exchange**:
  * Immediately scrubs `?code=...&state=...` from the browser address bar via `window.history.replaceState` before React renders.
  * Module-level `redeemedCodeSet` (`Set<string>`) guarantees React 18 `<StrictMode>` double-mounting will never trigger duplicate token exchanges.
* **Serverless Backend Handlers**:
  * `/api/auth/exchange`: Validates authorization code with Google token endpoint, sets HttpOnly cookie for refresh token, and returns short-lived access token.
  * `/api/auth/refresh`: Silently rotates/refreshes access tokens via HttpOnly cookie. Returns `200 { authenticated: false }` when no cookie exists to prevent console noise.
  * `/api/auth/logout`: Revokes token on Google servers and clears the HttpOnly cookie.

### 2.2 IndexedDB Persistence ([src/utils/idbStorage.ts](file:///c:/Users/kitch/OneDrive/Documents/Expense%20Tracker/src/utils/idbStorage.ts))
* Object store tables: `transactions`, `categories`, `paymentMethods`, `budgets`, `recurring`.
* Isolation keys: Namespaced per logged-in user email (`trackwise_user_<email>`), falling back to `trackwise_user_guest` in offline mode.
* Automatic one-time migration of legacy `localStorage` keys into IndexedDB on initialization.
* `localStorage` is restricted to lightweight UI preferences (`trackwise_theme`, `trackwise_settings_v1`).

### 2.3 Live-Index Incremental Cloud Sync
* Cross-tab mutex managed by **Web Locks API** (`navigator.locks.request('trackwise_sheets_sync')`) with sequential promise chain fallback.
* Remote rows pulled via `values:batchGet` to construct an on-the-fly `Map<id, actualSheetRowNumber>`.
* Deterministic conflict resolution: monotonic `rev` precedence + ISO `updatedAt` tie-breaker.
* Soft-deleted records (tombstones) automatically pruned from local and remote stores after 30 days.
* Atomic writing: `values:batchUpdate` for modified rows, `values:append` for new rows, no-op when remote data is identical.

---

## 3. Environment Variables Reference

The following environment variables are required for deployment:

| Variable | Environment | Required In | Description |
| :--- | :--- | :--- | :--- |
| `VITE_GOOGLE_CLIENT_ID` | Client & Server | `.env` & Vercel Dashboard | Google Cloud OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Server-Only | `.env` & Vercel Dashboard | Google Cloud OAuth 2.0 Client Secret (Never exposed to client) |

---

## 4. Rollback & Recovery Guide

If you ever need to restore TrackWise Pro to this exact certified state:

```bash
# Fetch all tags and commits
git fetch --all

# Checkout to this checkpoint tag or commit
git checkout v1.1.0-production
# or
git checkout a729e81

# Clean install dependencies
npm ci

# Verify build
npm run build
```

---
*Signed off: TrackWise Pro Engineering Team*
