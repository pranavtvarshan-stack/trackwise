# Project Build & Architecture Document: TrackWise Pro

**Version:** 1.0.0  
**Last Updated:** November 2026  
**Author / Engineering Team:** TrackWise Pro Development Team  
**Status:** Production-Ready / Continuous Deployment  

---

## 1. Project Overview & Core Purpose

### 1.1 Executive Summary
**TrackWise Pro** is an open, modern, privacy-first personal finance tracking progressive web application (PWA). Engineered specifically around hybrid payment ecosystems (with first-class support for Indian UPI, cash, credit/debit cards, and bank transfers), TrackWise Pro eliminates user dependency on closed, subscription-gated third-party financial servers by adopting a **Local-First, Cloud-Synced Hybrid Architecture**.

### 1.2 Target Users & Market Positioning
- **Digital & Cash Transactors**: Users in hybrid cash/digital economies (specifically UPI users in India) who need transparent split tracking between virtual and physical wallets without rounding errors.
- **Privacy-Conscious Individuals**: Users who refuse to transmit sensitive financial ledgers, salary slips, and bank account credentials to proprietary fintech backends.
- **Cross-Device Mobile & Desktop Users**: Users requiring a lightweight, installable PWA that functions seamlessly across desktop browsers (Chrome, Opera, Edge, Brave, Safari), mobile browsers, and standalone PWA installations with resilient offline support.

### 1.3 Core Value Proposition
1. **True Data Ownership**: The application has no proprietary database backend. Data resides directly in the browser's persistent storage and synchronizes bidirectionally to a private spreadsheet on the user's personal Google Drive account.
2. **Instant Zero-Latency UI**: All ledger queries, analytics, category filters, and budget recalculations execute client-side in sub-millisecond timeframes.
3. **Automated Multi-Sheet Spreadsheet Architecture**: Syncs with Google Sheets via a structured 6-sheet schema (`Transactions`, `UPI Expenses`, `Cash Expenses`, `Budgets`, `Accounts`, `Recurring Bills`) allowing users to execute external analysis, pivot tables, or backups directly in Google Sheets.
4. **Popup-Free Cross-Browser Authentication**: Uses Google's official OAuth 2.0 Direct Redirect Flow (`response_type=token`) with CSRF `state` verification—eliminating popup blockers, COOP (`Cross-Origin-Opener-Policy`) conflicts, and third-party cookie failures across Opera, Brave, Safari, and installed PWAs.
5. **Resilient Offline Capabilities**: Operates offline via Service Worker v3 (`trackwise-v3`) asset caching and local storage fallback, syncing automatically when network connectivity and OAuth session validity are restored.

---

## 2. Tech Stack & Dependencies

TrackWise Pro is constructed using a high-performance, strictly typed modern web stack with zero legacy runtime overhead.

### 2.1 Core Framework & Language
| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime & Bundler** | [Vite](https://vitejs.dev/) | `^6.0.3` | High-speed ESM dev server and optimized Rollup production bundler |
| **UI Framework** | [React](https://react.dev/) | `^18.3.1` | Component-driven declarative UI engine (StrictMode enabled) |
| **DOM Renderer** | React DOM | `^18.3.1` | Browser DOM rendering layer |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.6.3` | Static typing, interface contracts, and compile-time correctness |
| **Vite React Plugin** | `@vitejs/plugin-react` | `^4.3.4` | Fast Refresh and JSX compilation |

### 2.2 Styling & Presentation
| Package | Version | Purpose |
| :--- | :--- | :--- |
| **CSS Framework** | [Tailwind CSS](https://tailwindcss.com/) | `^3.4.16` | Utility-first, mobile-responsive light/dark theme design system |
| **CSS Post-Processor** | [PostCSS](https://postcss.org/) | `^8.4.49` | Modern CSS transformation pipeline |
| **CSS Vendor Prefixer** | [Autoprefixer](https://github.com/postcss/autoprefixer) | `^10.4.20` | Cross-browser CSS ruleset optimization |
| **Class Merger** | [tailwind-merge](https://github.com/dcastil/tailwind-merge) | `^2.5.5` | Dynamic Tailwind class deduplication and conflict resolution |
| **Utility Helper** | [clsx](https://github.com/lukeed/clsx) | `^2.1.1` | Conditional class composition engine |

### 2.3 Visualization, Utilities & Icons
| Package | Version | Purpose |
| :--- | :--- | :--- |
| **Data Visualization** | [Recharts](https://recharts.org/) | `^2.15.0` | SVG-based responsive charting (Area, Bar, Pie, Radar charts) |
| **Iconography** | [Lucide React](https://lucide.dev/) | `^0.468.0` | Comprehensive financial, navigation, and state SVG icons |
| **Date Engine** | [date-fns](https://date-fns.org/) | `^4.1.0` | Lightweight, immutable date manipulation and formatting |
| **Micro-Interactions** | [canvas-confetti](https://github.com/catdad/canvas-confetti) | `^1.9.4` | Canvas-based celebratory particle FX for budget/goal milestones |

### 2.4 Cloud & External APIs
| Service / Endpoint | Version / URL | Purpose |
| :--- | :--- | :--- |
| **Google OAuth 2.0 Endpoint** | `https://accounts.google.com/o/oauth2/v2/auth` | Direct full-page redirect implicit authorization (`response_type=token`) |
| **Google Token Revocation** | `https://oauth2.googleapis.com/revoke` | Best-effort REST token revocation on sign-out |
| **Google UserInfo API** | `https://www.googleapis.com/oauth2/v3/userinfo` | Authenticated Google user profile & avatar retrieval |
| **Google Drive API** | `v3` | Spreadsheet file discovery, metadata validation, and workbook lookup |
| **Google Sheets API** | `v4` | Workbook creation, `ensureSheetsExist`, `values:batchGet`, and atomic `values:batchUpdate` |
| **Web Service Worker** | Cache API (`trackwise-v3`) | Static asset caching (stale-while-revalidate), network-first HTML navigation, and Google domain bypass |

---

## 3. Directory & File Structure

The project follows a modular, feature-oriented structure separating state contexts, service clients, reusable components, and utility libraries.

```
c:\Users\kitch\OneDrive\Documents\Expense Tracker\
├── .env                              # Local environment variables (VITE_GOOGLE_CLIENT_ID)
├── .env.example                      # Documented template for environment setup
├── .gitignore                        # Git exclusion rules (node_modules, dist, .env)
├── index.html                        # HTML5 SPA entry point, zero-flash theme script, splash screen
├── package.json                      # Dependency manifests, scripts, and build configuration
├── package-lock.json                 # Pinned dependency lockfile
├── postcss.config.js                 # PostCSS plugin registration (Tailwind, Autoprefixer)
├── PROJECT_DOCS.md                   # Complete Project Build & Architecture Document
├── README.md                         # Project introduction and quick-start instructions
├── tailwind.config.js                # Design tokens, color palette, animations, and container specs
├── tsconfig.json                     # TypeScript compiler options and strictness rules
├── vite.config.ts                    # Vite dev server (port 5173) & Rollup manual chunk splitting
│
├── public/                           # Static production assets
│   ├── apple-touch-icon.png          # iOS home screen web-clip icon
│   ├── favicon.svg                   # Vector SVG browser tab favicon
│   ├── icon-192.png                  # Standard 192x192 PWA launcher icon
│   ├── icon-512.png                  # High-density 512x512 PWA splash icon
│   ├── manifest.json                 # Web App Manifest (PWA installation metadata)
│   └── sw.js                         # Service Worker v3 (network-first HTML, Google API bypass, asset cache)
│
└── src/                              # Application source tree
    ├── App.tsx                       # Master root orchestrator (Tab routing, startup cloud pull, 1.5s debounce sync)
    ├── index.css                     # Global Tailwind directives, scrollbar rules, custom utilities
    ├── main.tsx                      # React 18 StrictMode DOM mount point, ErrorBoundary & SW registration
    ├── registerServiceWorker.ts      # Service Worker lifecycle registration helper
    │
    ├── components/                   # Modular UI presentation and domain components
    │   ├── analytics/
    │   │   └── AnalyticsReports.tsx  # Advanced trends, category distributions, spending radar, bar charts
    │   ├── auth/
    │   │   └── LoginPortal.tsx       # Entry login gate with loading spinner, inline OAuth error banner & offline mode
    │   ├── budgets/
    │   │   └── BudgetManager.tsx     # Monthly budget limits, progress indicators, alert thresholds
    │   ├── common/
    │   │   ├── CategoryIcon.tsx      # Dynamic category icon resolver with fallback glyphs
    │   │   └── ErrorBoundary.tsx     # React component crash boundary with recovery UI
    │   ├── dashboard/
    │   │   └── OverviewDashboard.tsx # Executive finance view (Expandable cards, stacked UPI/Cash pills, charts)
    │   ├── layout/
    │   │   ├── Header.tsx            # Top bar (Currency pill, cloud sync status, no-referrer avatar + fallback, menu)
    │   │   └── Navbar.tsx            # Desktop navigation tabs / Mobile bottom sticky navigation bar
    │   ├── modals/
    │   │   ├── BudgetModal.tsx       # Create/edit budget allocation modal
    │   │   ├── CsvImportModal.tsx    # Drag-and-drop CSV parser and bulk transaction importer
    │   │   ├── ExportModal.tsx       # Filterable JSON/CSV ledger data export modal
    │   │   ├── RecurringModal.tsx    # Create/edit recurring bill subscription modal
    │   │   └── TransactionModal.tsx  # Create/edit income/expense entry modal
    │   ├── recurring/
    │   │   └── RecurringManager.tsx  # Recurring bills & subscription manager (Frequencies, due tracking)
    │   ├── settings/
    │   │   └── SettingsView.tsx      # Categories, payment methods, Google Drive status, JSON/CSV backup & wipe
    │   └── transactions/
    │       └── TransactionList.tsx   # Paginated, filterable, multi-sort transaction ledger
    │
    ├── constants/
    │   └── defaults.ts               # Default categories, payment methods, icons, colors, and initial seed datasets
    │
    ├── context/
    │   ├── ExpenseContext.tsx        # Central financial state machine (Transactions, exact balances, filters)
    │   └── GoogleAuthContext.tsx     # OAuth 2.0 Direct Redirect auth, CSRF state check, token expiry, Drive/Sheets sync
    │
    ├── services/
    │   └── googleSheetsService.ts    # REST client for Google Drive v3 & Google Sheets v4 API (6-sheet engine)
    │
    ├── types/
    │   └── index.ts                  # Canonical TypeScript interfaces, type unions, and API contracts
    │
    └── utils/
        ├── formatters.ts             # Currency (INR, decimal-accurate), date parsers, payment method normalizers
        └── storage.ts                # Namespaced LocalStorage persistence, seed guards, CSV/JSON encoders
```

---

## 4. System Architecture & Data Flow

TrackWise Pro utilizes a **Local-First, Dual-Tier Storage Architecture** paired with a **Popup-Free OAuth 2.0 Direct Redirect Flow**. User actions commit instantaneously to local state and `localStorage`, while an asynchronous synchronization engine debounces and pushes updates to Google Sheets in the background.

### 4.1 High-Level Architecture Diagram

```mermaid
flowchart TD
    User([User Device / Browser / PWA]) -->|User Interaction| ReactApp[TrackWise Pro React Application]
    
    subgraph ClientLayer [Client Execution Context]
        ReactApp --> StateEngine[ExpenseContext State Machine\nActive Views + Tombstone Store]
        StateEngine --> Calculation[Financial Engine: Exact Balances & Stats]
        StateEngine -->|Synchronous Write with rev + Tombstones| LocalStore[(Browser LocalStorage\ntrackwise_*)]
        
        SW[Service Worker sw.js v3] -.->|Caches Static Assets Only\nNetwork-First HTML & Google Bypass| ReactApp
    end

    subgraph SyncEngine [Hardened Multi-Device Sync & Redirect Auth Engine]
        ReactApp --> AuthContext[GoogleAuthContext]
        AuthContext -->|Full-Page Redirect + CSRF State| OAuthEndpoint[Google OAuth 2.0\n/o/oauth2/v2/auth]
        OAuthEndpoint -->|Redirect #access_token Hash| HashParser[Module-Level Hash Consumer\nScrubs URL via replaceState]
        HashParser --> AuthContext
        StateEngine -.->|1.5s Debounced / 15s Focus / Online Trigger| Mutex[Web Locks Mutex\ntrackwise_sheets_sync]
        Mutex --> MergeEngine[Pull-Before-Push Merge Engine\nrev -> updatedAt -> 30d Prune]
        MergeEngine --> GoogleSheetsClient[googleSheetsService.ts]
    end

    subgraph GoogleCloud [Google Cloud Platform Services]
        AuthContext -->|Profile Lookup| UserInfoAPI[Google UserInfo v3 API]
        GoogleSheetsClient -->|Drive API v3: Find Spreadsheet| DriveAPI[Google Drive REST API]
        GoogleSheetsClient -->|Sheets API v4: batchGet, batchClear, batchUpdate| SheetsAPI[Google Sheets REST API]
        DriveAPI --> TargetSheet[TrackWise Pro Spreadsheet\n6 Managed Sheets]
        SheetsAPI --> TargetSheet
    end
```

### 4.2 End-to-End Authentication & Data Synchronization Lifecycle

1. **OAuth 2.0 Direct Redirect Handshake (Popup-Free)**:
   - When the user clicks **"Sign in with Google"** or **"Sign in to Backup"**, `GoogleAuthContext.tsx` generates a cryptographically random CSRF `state` nonce (stored in `sessionStorage` under `trackwise_oauth_state`) and redirects the current browser tab to `https://accounts.google.com/o/oauth2/v2/auth` with:
     - `response_type=token`
     - `redirect_uri=window.location.origin` (no trailing slash)
     - `scope=openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets`
     - `prompt=select_account consent` (or `login_hint=user.email` during `reconnectSync()`).
   - Because authentication happens in the full browser tab rather than a cross-origin popup, it completely avoids COOP (`Cross-Origin-Opener-Policy`), `window.closed` polling errors, popup blockers, and Opera/Brave/Safari cross-window restrictions.

2. **StrictMode-Safe Hash Consumption & URL Scrubbing**:
   - When Google redirects back to `${origin}/#state=...&access_token=...&expires_in=3599`, `consumeOAuthRedirectHash()` runs **once at module load** before React mounts—preventing React 18 `<StrictMode>` double-mounts from dropping the token.
   - It validates the CSRF `state`, persists `trackwise_google_token` and `trackwise_google_expires_at` to `localStorage`, clears `trackwise_offline_mode`, and immediately removes the token from the URL bar using `window.history.replaceState`.
   - `GoogleAuthProvider`'s effect (keyed on `[accessToken]`) fetches the Google profile via `fetchGoogleUserInfo()`, unlocks the Dashboard immediately, and resolves/creates the spreadsheet in the background.

3. **Multi-Tab Mutex & Atomic Pull-Before-Push Reconciliation**:
   - Every sync (`performSync`) acquires a cross-tab mutex via the browser **Web Locks API** (`navigator.locks.request('trackwise_sheets_sync', ...)`), with an in-memory promise-queue fallback lock when `navigator.locks` is unavailable—preventing two open tabs on the same device from executing overlapping sync cycles.
   - Inside the lock, `performSync` **always pulls remote rows first** (`values:batchGet` with URL-encoded ranges) before writing anything.
   - Local and remote collections (`Transactions`, `Budgets`, `Recurring Bills`) are reconciled per `id` via `mergeEntityCollections()`:
     1. **Single-side ID**: Kept unless `isDeleted === true` and `updatedAt` is older than 30 days.
     2. **Dual-side ID (Monotonic Revision Precedence)**: The record with the higher `rev` wins (protecting against device system clock drift).
     3. **Equal `rev` Tie-Breaker**: When two devices edit the same record independently offline at the same `rev`, the more recent `updatedAt` ISO timestamp wins.
     4. **30-Day Tombstone Pruning**: Soft-deleted records older than 30 days are automatically purged from both local state and Google Sheets.
   - Live UPI and Cash wallet balances are recomputed directly from the merged active transactions (`computeSplitWalletBalances`) so the `Accounts` tab always matches reconciled state.

4. **Trailing Ghost Row Elimination & Atomic Push**:
   - Immediately before writing, `pushDataToSheet()` calls `values:batchClear` across all 6 data ranges (`Transactions!A2:L`, `'UPI Expenses'!A2:H`, `'Cash Expenses'!A2:H`, `Budgets!A2:I`, `Accounts!A2:D`, `'Recurring Bills'!A2:N`)—preserving row-1 headers and eliminating leftover ghost rows when datasets shrink.
   - It then writes upgraded headers + reconciled rows atomically via `values:batchUpdate` (`USER_ENTERED`), using dynamic `=SUMIFS` formulas in `UPI Expenses` and `Cash Expenses`.

5. **Loop-Free Local State Updates & Throttled Focus Sync**:
   - `App.tsx` updates local React state & `localStorage` **only** when `localChanged.*` indicates the merged collection differs from local state, recording a canonical data fingerprint (`computeSyncFingerprint`) beforehand to prevent infinite re-render/sync loops.
   - Sync triggers automatically on initial login, 1.5s debounced local edits, `online` reconnects, manual **"Sync Now"**, and throttled `visibilitychange` / `window.focus` events (at most once every 15 seconds when switching back to the app/tab).

---

## 5. Database Schema & Data Models

### 5.1 Browser Storage Keys (`localStorage` & `sessionStorage`)

#### Financial & App State Keys (`src/utils/storage.ts` & `index.html`)
*Note: `ExpenseContext.tsx` persists full arrays (including soft-delete tombstones) under these keys and exposes active-only filtered views (`!isDeleted`) to all UI components while exposing full arrays (`allTransactions`, `allBudgets`, `allRecurring`) to the sync engine.*

| Storage | Key Name | Type | Description |
| :--- | :--- | :--- | :--- |
| `localStorage` | `trackwise_transactions_v1` | `Transaction[]` | Full transaction ledger including `rev`, `updatedAt`, and soft-delete tombstones |
| `localStorage` | `trackwise_categories_v1` | `Category[]` | Custom and default category definitions with icons and colors |
| `localStorage` | `trackwise_payment_methods_v1` | `PaymentMethodItem[]` | Configured payment methods (UPI, Cash, Credit Card, Bank, etc.) |
| `localStorage` | `trackwise_budgets_v1` | `Budget[]` | Category budget caps including `rev`, `updatedAt`, and soft-delete tombstones |
| `localStorage` | `trackwise_recurring_v1` | `RecurringTransaction[]` | Subscriptions & bills including `rev`, `updatedAt`, and soft-delete tombstones |
| `localStorage` | `trackwise_settings_v1` | `UserSettings` | Currency formatting, notifications, and app preferences |
| `localStorage` | `trackwise_is_initialized_v1` | `'true'` | Guard flag preventing demo data from re-seeding after user wipes data |
| `localStorage` | `trackwise_theme` | `'dark' \| 'light'` | Persisted theme preference read before React mounts for zero-flash rendering |

#### Authentication & Cloud Sync Keys (`src/context/GoogleAuthContext.tsx`)
| Storage | Key Name | Type | Description |
| :--- | :--- | :--- | :--- |
| `localStorage` | `trackwise_google_user` | `GoogleUser` (JSON) | Cached Google user profile (`id`, `name`, `email`, `picture`) |
| `localStorage` | `trackwise_google_token` | `string` | Active OAuth 2.0 Bearer access token |
| `localStorage` | `trackwise_google_expires_at` | `string` (epoch ms) | Access token expiration timestamp (checked with 60s safety buffer) |
| `localStorage` | `trackwise_offline_mode` | `'true' \| 'false'` | Tracks whether user bypassed login into local-only offline mode |
| `localStorage` | `trackwise_sheet_id` | `string` | Linked Google Spreadsheet ID |
| `localStorage` | `trackwise_sheet_url` | `string` | Direct Google Sheets browser URL |
| `localStorage` | `trackwise_last_sync` | `string` (ISO 8601) | Timestamp of last completed cloud pull/push |
| `localStorage` | `trackwise_custom_client_id` | `string` | Legacy fallback Client ID (only used if `VITE_GOOGLE_CLIENT_ID` is empty) |
| `sessionStorage` | `trackwise_oauth_state` | `string` | Short-lived CSRF nonce validated on OAuth redirect callback |

### 5.2 Google Sheets 6-Tab Workbook Schema

The application creates and maintains a dedicated Google Sheets workbook entitled **`TrackWise Pro - Personal Finance`**. Missing/empty `Rev` cells on legacy sheets automatically default to `1`.

#### Sheet 1: `Transactions` (`A1:L`, cleared on `A2:L`)
*Stores every historical transaction record including soft-delete tombstones and monotonic revision numbers.*
| Col | Field Name | Type | Description / Example |
| :--- | :--- | :--- | :--- |
| **A** | ID | `string` | Unique identifier (UUID or `tx_*`) |
| **B** | Date | `string` | ISO 8601 Date (`YYYY-MM-DD`) |
| **C** | Title | `string` | Transaction description (e.g., "Grocery Shopping") |
| **D** | Type | `string` | `expense` \| `income` |
| **E** | Category ID | `string` | Category ID (e.g., `cat_groceries`) |
| **F** | Amount | `number` | Monetary value with full decimal precision (`450.50`) |
| **G** | Payment Method | `string` | `UPI` \| `Cash` \| `Credit Card` \| `Debit Card` \| `Net Banking` |
| **H** | Notes | `string` | Optional descriptive context |
| **I** | Tags | `string` | Semicolon-separated tags (`"food;weekend"`) |
| **J** | Updated At | `string` | ISO timestamp of last modification |
| **K** | Is Deleted | `boolean` | Soft-delete tombstone flag (`FALSE` / `TRUE`) |
| **L** | Rev | `number` | Monotonic revision counter (`1`, `2`, `3`...) |

#### Sheet 2: `UPI Expenses` (`A1:G`, cleared on `A2:H`)
*Auto-filtered active view containing only non-deleted UPI expenses, with a dynamic `=SUMIFS` total.*
- **Header (Row 1)**: `Date`, `Title`, `Category ID`, `Amount`, `Notes`, `Tags`, `Updated At`
- **Rows 2..N**: Active expense records where `isDeleted === false` and `paymentMethod === 'UPI'`
- **Footer Row**: Labelled **"TOTAL UPI EXPENSES"** with dynamic formula:
  `=SUMIFS(Transactions!F2:F, Transactions!D2:D, "expense", Transactions!G2:G, "UPI", Transactions!K2:K, FALSE)`

#### Sheet 3: `Cash Expenses` (`A1:G`, cleared on `A2:H`)
*Auto-filtered active view containing only non-deleted Liquid Cash expenses, with a dynamic `=SUMIFS` total.*
- **Header (Row 1)**: `Date`, `Title`, `Category ID`, `Amount`, `Notes`, `Tags`, `Updated At`
- **Rows 2..N**: Active expense records where `isDeleted === false` and `paymentMethod === 'Cash'`
- **Footer Row**: Labelled **"TOTAL CASH EXPENSES"** with dynamic formula:
  `=SUMIFS(Transactions!F2:F, Transactions!D2:D, "expense", Transactions!G2:G, "Cash", Transactions!K2:K, FALSE)`

#### Sheet 4: `Budgets` (`A1:G`, cleared on `A2:I`)
*Configured monthly spending limits, alert thresholds, tombstones, and revisions.*
| Col | Field Name | Type | Description / Example |
| :--- | :--- | :--- | :--- |
| **A** | ID | `string` | Budget record ID |
| **B** | Category ID | `string` | Category identifier |
| **C** | Monthly Limit | `number` | Monthly budget ceiling |
| **D** | Alert Threshold | `number` | Percentage warning threshold (e.g., `80`) |
| **E** | Updated At | `string` | ISO timestamp |
| **F** | Is Deleted | `boolean` | Soft-delete tombstone flag (`FALSE` / `TRUE`) |
| **G** | Rev | `number` | Monotonic revision counter (`1`, `2`, `3`...) |

#### Sheet 5: `Accounts` (`A1:D`, cleared on `A2:D`)
*Live account summary recomputed directly from merged active transactions.*
- **Header (Row 1)**: `Wallet / Account`, `Live Balance`, `Currency`, `Last Synced (UTC)`
- **Row 2**: `UPI / Online Wallet`, `[Reconciled Net UPI Balance]`, `₹`, `[ISO Timestamp]`
- **Row 3**: `Liquid Cash Wallet`, `[Reconciled Net Cash Balance]`, `₹`, `[ISO Timestamp]`
- **Row 4**: `Total Net Balance`, `[UPI Balance + Cash Balance]`, `₹`, `[ISO Timestamp]`

#### Sheet 6: `Recurring Bills` (`A1:N`, cleared on `A2:N`)
*Subscription tracker and repeating bill definitions with monotonic revision tracking and tombstones.*
| Col | Field Name | Type | Description / Example |
| :--- | :--- | :--- | :--- |
| **A** | ID | `string` | Unique bill identifier |
| **B** | Title | `string` | Subscription name (e.g., "Netflix Premium") |
| **C** | Amount | `number` | Recurring cost with decimal precision (`649.00`) |
| **D** | Type | `string` | `expense` \| `income` |
| **E** | Category ID | `string` | Category identifier (`cat_utilities`) |
| **F** | Payment Method | `string` | Assigned payment method (`UPI`, `Cash`, etc.) |
| **G** | Frequency | `string` | `daily` \| `weekly` \| `monthly` \| `yearly` |
| **H** | Next Due Date | `string` | ISO due date (`YYYY-MM-DD`) |
| **I** | Start Date | `string` | ISO start date (`YYYY-MM-DD`) |
| **J** | Active | `boolean` | `TRUE` / `FALSE` |
| **K** | Notes | `string` | Optional notes/reminders |
| **L** | Rev | `number` | Monotonic revision counter (`1`, `2`, `3`...) |
| **M** | Updated At | `string` | ISO timestamp of last modification |
| **N** | Is Deleted | `boolean` | Soft-delete tombstone flag (`FALSE` / `TRUE`) |

---

## 6. Core Features & Implementation Details

### 6.1 Executive Dashboard (`src/components/dashboard/OverviewDashboard.tsx`)
- **Expandable Metrics Cards (Mobile & Desktop)**:
  - *Net Savings Card*: Displays net savings, savings rate, and vertically stacked **UPI** and **Cash** balance pills with exact decimal precision (`tabular-nums`, zero rounding, zero horizontal text overlap on compact mobile screens). Expandable on mobile to inspect wallet breakdowns.
  - *Total Income Card*: Displays aggregated period income; expands on click in both mobile and desktop views to show an itemized breakdown of every income source.
  - *Total Expenses Card*: Displays aggregated period expenses; expands on click to list every expense item.
  - *Top Category Card*: Highlights the highest spending category; expands on click to show all expenses in that category.
- **Dynamic Cash Flow Chart**: Recharts `AreaChart` rendering income versus expenses across periods.
- **Category Spend Distribution**: Recharts `PieChart` / `DonutChart` displaying proportional spend breakdown.
- **Recent Activity Ledger**: Quick-access list of recent transactions with inline edit/delete controls.

### 6.2 Transaction Management (`src/components/transactions/TransactionList.tsx` & `TransactionModal.tsx`)
- **Advanced Filtering Engine**: Filter across search keywords, transaction types (`all`, `income`, `expense`), categories, payment methods, and date ranges.
- **Multi-Field Sorting & Pagination**: Sort by date, amount, title, or category; paginate large ledgers smoothly.
- **Decimal-Accurate Monetary Input**: Preserves exact paise/cents across input, storage, dashboard cards, and Google Sheets sync.
- **Tagging & Notes**: Structured metadata tags and notes per transaction.

### 6.3 Budgeting & Financial Guardrails (`src/components/budgets/BudgetManager.tsx` & `BudgetModal.tsx`)
- **Dynamic Progress Meters**: Color-coded utilization bars (`< 70%` Emerald, `70%–90%` Amber, `> 90%` Rose).
- **Threshold Alerts & Milestones**: Visual warning badges when spending approaches ceilings, plus `canvas-confetti` celebration feedback.

### 6.4 Recurring Bills & Subscriptions (`src/components/recurring/RecurringManager.tsx` & `RecurringModal.tsx`)
- **Frequency Scheduling**: Supports `weekly`, `monthly`, `quarterly`, and `yearly` recurrences with due-date countdowns and header overdue badges.
- **One-Click Settlement**: Logs a recurring bill directly as a transaction and advances `nextDueDate`.
- **Full Cloud Sync**: Syncs bidirectionally with the dedicated `'Recurring Bills'` Google Sheet tab across devices.

### 6.5 Financial Analytics & Reporting (`src/components/analytics/AnalyticsReports.tsx`)
- **Income vs. Expense Comparison**: Multi-month bar charts and cash flow visualizations.
- **Category Radar & Savings Rate Trends**: Spending profile breakdown and monthly retention tracking.

### 6.6 Header, Navigation & Resilient Avatars (`src/components/layout/Header.tsx` & `Navbar.tsx`)
- **Cloud Sync Status Pill**: Displays live states (`Synced`, `Syncing...`, `Reconnect` on token expiry, or `Sign in to Backup` in offline mode).
- **Resilient Google Profile Avatars**: Renders user photos with `referrerPolicy="no-referrer"` (preventing Google CDN `403` blocks) and automatic `onError` fallback to an initial badge in both `Header.tsx` and `SettingsView.tsx`.
- **Global Shortcuts**: Keyboard shortcuts (`N` or `Ctrl/Cmd+K`) open the Add Transaction modal from anywhere.

### 6.7 Data Portability & Settings (`src/components/settings/SettingsView.tsx`, `CsvImportModal.tsx`, `ExportModal.tsx`)
- **CSV Bulk Import & Export**: Client-side CSV parser for imports and instant `.csv` / `.json` snapshot exports.
- **Locked Production OAuth Config**: The custom Client ID input is intentionally omitted from Settings UI so users cannot break cloud sync by misconfiguring credentials.
- **Clean Data Wipe**: Permanently wipes local transactions while setting `trackwise_is_initialized_v1` so demo seed data does not automatically reappear.

---

## 7. Environment Variables, Configuration & Build Setup

### 7.1 Environment Variables
All client-exposed environment variables use the `VITE_` prefix:

```ini
# .env.example
# Google Cloud Console OAuth 2.0 Client ID (Web Application type)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

> **Security Note:** The Google OAuth Client ID is a public client identifier. Token issuance is strictly restricted by Google Cloud Console's **Authorized JavaScript Origins** and **Authorized Redirect URIs** rules.

#### Required Google Cloud Console OAuth Settings:
- **Application Type**: Web application
- **Authorized JavaScript Origins** (no trailing slash `/`):
  - `http://localhost:5173`
  - `http://localhost:5174`
  - `https://trackwise-git-main-pranav-28ae.vercel.app`
  - `https://trackwise-ruddy.vercel.app`
- **Authorized Redirect URIs** (Required for Direct Redirect Flow, no trailing slash `/`):
  - `http://localhost:5173`
  - `http://localhost:5174`
  - `https://trackwise-git-main-pranav-28ae.vercel.app`
  - `https://trackwise-ruddy.vercel.app`
- **OAuth Consent Screen**:
  - Add your Gmail address(es) under **Test users** while in Testing mode, or click **Publish App** for general access.
- **Enabled APIs in GCP Console**:
  1. Google Drive API
  2. Google Sheets API

### 7.2 Local Development Setup

#### Prerequisites
- Node.js `v18.0.0` or higher (Node.js 20+ recommended)
- npm `v9.0.0` or higher

#### Step-by-Step Installation
```bash
# 1. Clone repository
git clone https://github.com/pranavtvarshan-stack/trackwise.git
cd trackwise

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set VITE_GOOGLE_CLIENT_ID

# 4. Start local development server
npm run dev
```
The dev server starts on strict port `http://localhost:5173/`.

### 7.3 Build & Code Splitting Optimization

`vite.config.ts` splits heavy vendor dependencies into dedicated cacheable chunks via Rollup's functional `manualChunks`:

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          if (id.includes('recharts') || id.includes('d3')) {
            return 'vendor-charts';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          return 'vendor';
        }
      }
    }
  },
  chunkSizeWarningLimit: 900
}
```

#### Production Build Command
```bash
# Type check and build optimized production bundle
npm run build
```
Emitted `/dist` bundles:
- `dist/index.html` (~9.9 kB)
- `dist/assets/index-[hash].css` (~63.6 kB)
- `dist/assets/index-[hash].js` (~238.3 kB)
- `dist/assets/vendor-[hash].js` (~252.7 kB)
- `dist/assets/vendor-charts-[hash].js` (~332.3 kB)
- `dist/assets/vendor-icons-[hash].js` (~780.1 kB)

### 7.4 Deployment Configuration (Vercel)

Structured for zero-configuration continuous deployment on [Vercel](https://vercel.com):
- **Framework Preset**: Vite
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Environment Variables**: Configure `VITE_GOOGLE_CLIENT_ID` in Vercel Project Settings → Environment Variables.

---

## 8. Current Status, Known Gaps & Next Steps

### 8.1 Completed Milestones
- [x] Strictly typed React 18 + TypeScript financial state engine with LocalStorage persistence.
- [x] Popup-free **Google OAuth 2.0 Direct Redirect Flow** with CSRF `state` verification, StrictMode-safe hash parsing, and automatic URL token scrubbing.
- [x] Hardened **Multi-Device Pull-Before-Push Sync Engine**:
  - Monotonic `rev` revision counters + `updatedAt` tie-breakers (immune to device clock drift).
  - Soft-delete tombstones (`isDeleted: true`) preventing deleted rows from resurrecting across devices, with automatic 30-day tombstone pruning.
  - Cross-tab **Web Locks API** mutex (`trackwise_sheets_sync`) with in-memory fallback lock.
  - Throttled `visibilitychange` / `window.focus` sync (at most once every 15 seconds) and canonical fingerprint anti-loop protection.
- [x] Dedicated 6-Sheet Google Spreadsheet synchronization (`Transactions`, `UPI Expenses`, `Cash Expenses`, `Budgets`, `Accounts`, `Recurring Bills`) with explicit `values:batchClear` trailing ghost-row cleanup and dynamic `=SUMIFS` formulas.
- [x] Decimal-accurate UPI & Cash balances with non-overlapping vertically stacked pills and expandable detail cards across mobile and desktop.
- [x] Resilient Google profile avatars (`referrerPolicy="no-referrer"` + `onError` initial-badge fallback).
- [x] Service Worker v3 (`trackwise-v3`) with network-first HTML delivery, Google domain bypass, and safe response cloning.
- [x] Clean data wipe propagation (soft-deletes active rows + `trackwise_is_initialized_v1` guard).

### 8.2 Known Gaps & Technical Considerations
1. **1-Hour OAuth Access Token Expiry (Implicit Flow Limitation)**:
   - Client-side OAuth 2.0 implicit tokens expire after 3,600 seconds (1 hour) without refresh tokens (because refresh tokens require a backend client secret).
   - *Current Behavior*: When expired, the app displays a non-intrusive **"Reconnect Sync"** banner while saving all changes locally; clicking it triggers a fast `login_hint` redirect to refresh the token.
   - *Future Option*: Migrate to Authorization Code Flow + PKCE with a lightweight serverless token-refresh endpoint (e.g. Vercel Edge Function) for indefinite background sessions.
2. **Legacy GIS Script Tag in `index.html`**:
   - `index.html` still includes `<script src="https://accounts.google.com/gsi/client" async defer></script>` from the previous popup implementation. It is harmless, but can be removed to eliminate one unnecessary third-party script download.
3. **Google OAuth App Verification (Production Publishing)**:
   - While the GCP OAuth Consent Screen remains in **Testing** mode, only manually listed Test Users can sign in. Publishing the app (or completing Google's sensitive-scope verification for `spreadsheets`/`drive.file`) is required for unrestricted public onboarding.

### 8.3 Recommended Next Steps & Roadmap
- **Remove Unused GIS Script**: Clean up the unused `accounts.google.com/gsi/client` script tag in `index.html`.
- **Multi-Currency & FX Conversion**: Support foreign currency transactions with automatic conversion to the user's base currency.
- **Biometric App Lock (WebAuthn)**: Optional device PIN / fingerprint lock for enhanced local privacy on shared devices.
- **Automated PDF Monthly Statements**: Export formatted monthly financial reports and tax-ready category summaries.

---
*End of Document. Updated to reflect current codebase architecture and production status.*
