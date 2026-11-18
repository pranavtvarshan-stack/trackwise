import { Transaction, Budget, RecurringTransaction, GoogleUser } from '../types';
import { normalizePaymentMethod } from '../utils/formatters';

const SHEET_TITLE = 'TrackWise Pro - Personal Finance';
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LEGACY_FALLBACK_UPDATED_AT = '2020-01-01T00:00:00.000Z';

const TX_HEADERS = [
  'ID',
  'Date',
  'Title',
  'Type',
  'Category ID',
  'Amount',
  'Payment Method',
  'Notes',
  'Tags',
  'Updated At',
  'Is Deleted',
  'Rev',
];

const WALLET_EXPENSE_HEADERS = [
  'Date',
  'Title',
  'Category ID',
  'Amount',
  'Notes',
  'Tags',
  'Updated At',
];

const BUDGET_HEADERS = [
  'ID',
  'Category ID',
  'Monthly Limit',
  'Alert Threshold',
  'Updated At',
  'Is Deleted',
  'Rev',
];

const ACCOUNT_HEADERS = [
  'Wallet / Account',
  'Live Balance',
  'Currency',
  'Last Synced (UTC)',
];

const RECURRING_HEADERS = [
  'ID',
  'Title',
  'Amount',
  'Type',
  'Category ID',
  'Payment Method',
  'Frequency',
  'Next Due Date',
  'Start Date',
  'Active',
  'Notes',
  'Rev',
  'Updated At',
  'Is Deleted',
];

declare global {
  interface Window {
    google?: any;
  }
}

export interface SyncableRecord {
  id: string;
  rev?: number;
  updatedAt?: string;
  isDeleted?: boolean;
  syncStatus?: 'pending' | 'synced';
}

export interface SheetDataWithLiveIndices {
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  txRowMap: Map<string, number>;
  budgetRowMap: Map<string, number>;
  recurringRowMap: Map<string, number>;
}

function parseRev(val: unknown): number {
  const num = typeof val === 'number' ? val : parseInt(String(val ?? '').trim(), 10);
  return Number.isFinite(num) && num >= 1 ? Math.floor(num) : 1;
}

function parseTimestampMs(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Returns true if a record is soft-deleted and its updatedAt is older than 30 days.
 */
export function isExpiredTombstone(item: SyncableRecord, nowMs: number = Date.now()): boolean {
  if (!item.isDeleted) return false;
  const updatedMs = parseTimestampMs(item.updatedAt);
  if (updatedMs <= 0) return false;
  return nowMs - updatedMs > TOMBSTONE_TTL_MS;
}

/**
 * Check if any soft-deleted tombstone in local or remote collections has expired and will be pruned.
 */
export function hasExpiredTombstones(
  localItems: SyncableRecord[],
  remoteItems: SyncableRecord[],
  nowMs: number = Date.now()
): boolean {
  for (const item of localItems) {
    if (isExpiredTombstone(item, nowMs)) return true;
  }
  for (const item of remoteItems) {
    if (isExpiredTombstone(item, nowMs)) return true;
  }
  return false;
}

/**
 * Deterministic per-ID reconciliation between local and remote collections:
 * 1. If an id exists only on one side, keep it (unless isDeleted === true and older than 30 days).
 * 2. If an id exists on both sides, higher monotonic `rev` wins (immune to clock drift).
 * 3. If `rev` is identical on both sides, the more recent `updatedAt` timestamp wins.
 * 4. Purge any winning soft-deleted tombstone older than 30 days.
 */
export function mergeEntityCollections<T extends SyncableRecord>(
  localItems: T[],
  remoteItems: T[],
  nowMs: number = Date.now()
): T[] {
  const localMap = new Map<string, T>();
  const remoteMap = new Map<string, T>();
  const orderedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const item of localItems) {
    if (!item || !item.id) continue;
    localMap.set(item.id, item);
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      orderedIds.push(item.id);
    }
  }

  for (const item of remoteItems) {
    if (!item || !item.id) continue;
    remoteMap.set(item.id, item);
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      orderedIds.push(item.id);
    }
  }

  const merged: T[] = [];

  for (const id of orderedIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    let winner: T;

    if (local && !remote) {
      winner = local;
    } else if (!local && remote) {
      winner = remote;
    } else {
      // Both exist — reconcile by monotonic rev first, then updatedAt tie-breaker
      const l = local as T;
      const r = remote as T;
      const localRev = parseRev(l.rev);
      const remoteRev = parseRev(r.rev);

      if (localRev > remoteRev) {
        winner = l;
      } else if (remoteRev > localRev) {
        winner = r;
      } else {
        const localTime = parseTimestampMs(l.updatedAt);
        const remoteTime = parseTimestampMs(r.updatedAt);
        winner = remoteTime > localTime ? r : l;
      }
    }

    // Purge soft-deleted tombstones older than 30 days
    if (isExpiredTombstone(winner, nowMs)) {
      continue;
    }

    merged.push({
      ...winner,
      rev: parseRev(winner.rev),
      isDeleted: Boolean(winner.isDeleted),
      syncStatus: 'synced',
    });
  }

  return merged;
}

function canonicalTransactionKey(t: Transaction): string {
  return JSON.stringify([
    t.id,
    t.date,
    t.title,
    t.type,
    t.categoryId,
    t.amount,
    normalizePaymentMethod(t.paymentMethod),
    t.notes || '',
    (t.tags || []).join(';'),
    t.updatedAt || '',
    Boolean(t.isDeleted),
    parseRev(t.rev),
  ]);
}

function canonicalBudgetKey(b: Budget): string {
  return JSON.stringify([
    b.id,
    b.categoryId,
    b.monthlyLimit,
    b.alertThresholdPercentage,
    b.updatedAt || '',
    Boolean(b.isDeleted),
    parseRev(b.rev),
  ]);
}

function canonicalRecurringKey(r: RecurringTransaction): string {
  return JSON.stringify([
    r.id,
    r.title,
    r.amount,
    r.type,
    r.categoryId,
    normalizePaymentMethod(r.paymentMethod),
    r.frequency,
    r.nextDueDate,
    r.startDate || '',
    Boolean(r.active),
    r.notes || '',
    r.updatedAt || '',
    Boolean(r.isDeleted),
    parseRev(r.rev),
  ]);
}

export function areTransactionsEqual(a: Transaction[], b: Transaction[]): boolean {
  if (a.length !== b.length) return false;
  const aKeys = a.map(canonicalTransactionKey).sort();
  const bKeys = b.map(canonicalTransactionKey).sort();
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  return true;
}

export function areBudgetsEqual(a: Budget[], b: Budget[]): boolean {
  if (a.length !== b.length) return false;
  const aKeys = a.map(canonicalBudgetKey).sort();
  const bKeys = b.map(canonicalBudgetKey).sort();
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  return true;
}

export function areRecurringEqual(a: RecurringTransaction[], b: RecurringTransaction[]): boolean {
  if (a.length !== b.length) return false;
  const aKeys = a.map(canonicalRecurringKey).sort();
  const bKeys = b.map(canonicalRecurringKey).sort();
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  return true;
}

export function computeSyncFingerprint(
  transactions: Transaction[],
  budgets: Budget[],
  recurring: RecurringTransaction[]
): string {
  const txPart = transactions.map(canonicalTransactionKey).sort().join('|');
  const bdPart = budgets.map(canonicalBudgetKey).sort().join('|');
  const recPart = recurring.map(canonicalRecurringKey).sort().join('|');
  return `${txPart}##${bdPart}##${recPart}`;
}

/**
 * Compute live all-time UPI & Liquid Cash balances directly from active (non-deleted) transactions.
 */
export function computeSplitWalletBalances(transactions: Transaction[]): {
  upiBalance: number;
  cashBalance: number;
} {
  let upiBalance = 0;
  let cashBalance = 0;

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    const pm = normalizePaymentMethod(tx.paymentMethod);
    if (pm === 'UPI') {
      upiBalance = tx.type === 'income' ? upiBalance + tx.amount : upiBalance - tx.amount;
    } else if (pm === 'Cash') {
      cashBalance = tx.type === 'income' ? cashBalance + tx.amount : cashBalance - tx.amount;
    }
  }

  return { upiBalance, cashBalance };
}

/**
 * Fetch Google User Info using the OAuth2 Access Token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.sub,
    name: data.name || data.email,
    email: data.email,
    picture: data.picture || '',
  };
}

/**
 * Discover existing TrackWise spreadsheet or create a new one
 */
export async function findOrCreateTrackWiseSheet(
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; wasCreated: boolean }> {
  const query = encodeURIComponent(
    `name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!driveRes.ok) {
    if (driveRes.status === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Drive search failed: ${driveRes.statusText}`);
  }

  const driveData = await driveRes.json();
  if (driveData.files && driveData.files.length > 0) {
    const existing = driveData.files[0];
    return {
      spreadsheetId: existing.id,
      spreadsheetUrl: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
      wasCreated: false,
    };
  }

  // Create new spreadsheet with 6 core tabs
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SHEET_TITLE,
      },
      sheets: [
        { properties: { title: 'Transactions' } },
        { properties: { title: 'UPI Expenses' } },
        { properties: { title: 'Cash Expenses' } },
        { properties: { title: 'Budgets' } },
        { properties: { title: 'Accounts' } },
        { properties: { title: 'Recurring Bills' } },
      ],
    }),
  });

  if (!createRes.ok) {
    if (createRes.status === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Failed to create spreadsheet: ${createRes.statusText}`);
  }

  const newSheet = await createRes.json();
  const spreadsheetId = newSheet.spreadsheetId;
  const spreadsheetUrl = newSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Populate header rows for all 6 sheets
  const headersPayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Transactions!A1:L1', values: [TX_HEADERS] },
      { range: "'UPI Expenses'!A1:G1", values: [WALLET_EXPENSE_HEADERS] },
      { range: "'Cash Expenses'!A1:G1", values: [WALLET_EXPENSE_HEADERS] },
      { range: 'Budgets!A1:G1', values: [BUDGET_HEADERS] },
      { range: 'Accounts!A1:D1', values: [ACCOUNT_HEADERS] },
      { range: "'Recurring Bills'!A1:N1", values: [RECURRING_HEADERS] },
    ],
  };

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(headersPayload),
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    wasCreated: true,
  };
}

/**
 * Pull all rows from Transactions, Budgets, and Recurring Bills sheets.
 * Builds and returns live Map<id, actualSheetRowNumber> directly from the pulled response
 * so no static row numbers are ever cached locally.
 */
export async function pullDataFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetDataWithLiveIndices> {
  const existingSheets = await ensureSheetsExist(accessToken, spreadsheetId);

  const queryRanges: string[] = ['Transactions!A2:L', 'Budgets!A2:I'];
  const hasRecurring = existingSheets.has('Recurring Bills');
  if (hasRecurring) {
    queryRanges.push("'Recurring Bills'!A2:N");
  }

  const rangeQuery = queryRanges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeQuery}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    const errText = await res.text();
    console.error('Failed to fetch sheet data:', res.status, errText);
    throw new Error(`Failed to fetch sheet data: ${res.statusText}`);
  }

  const data = await res.json();
  const txValueRange = data.valueRanges?.[0]?.values || [];
  const budgetValueRange = data.valueRanges?.[1]?.values || [];
  const recurringValueRange = hasRecurring ? data.valueRanges?.[2]?.values || [] : [];

  const txRowMap = new Map<string, number>();
  const budgetRowMap = new Map<string, number>();
  const recurringRowMap = new Map<string, number>();

  const transactions: Transaction[] = [];
  txValueRange.forEach((row: any[], idx: number) => {
    if (!row || !row[0] || String(row[0]).toUpperCase() === 'ID') return;
    const actualRowNumber = idx + 2; // Row 1 is header, data starts at A2
    const id = String(row[0]);
    txRowMap.set(id, actualRowNumber);

    const isDeleted = row[10] === 'TRUE' || row[10] === true || row[10] === 'true';
    const updatedAt = row[9] ? String(row[9]) : LEGACY_FALLBACK_UPDATED_AT;
    transactions.push({
      id,
      date: String(row[1] || new Date().toISOString().split('T')[0]),
      title: String(row[2] || 'Untitled'),
      type: row[3] === 'income' ? 'income' : 'expense',
      categoryId: String(row[4] || 'cat_food'),
      amount: parseFloat(row[5]) || 0,
      paymentMethod: normalizePaymentMethod(row[6]),
      notes: row[7] ? String(row[7]) : undefined,
      tags: row[8] ? String(row[8]).split(';').filter(Boolean) : [],
      createdAt: updatedAt,
      updatedAt,
      isDeleted,
      rev: parseRev(row[11]),
      syncStatus: 'synced',
    });
  });

  const budgets: Budget[] = [];
  budgetValueRange.forEach((row: any[], idx: number) => {
    if (!row || !row[0] || String(row[0]).toUpperCase() === 'ID') return;
    const actualRowNumber = idx + 2;
    const id = String(row[0]);
    budgetRowMap.set(id, actualRowNumber);

    const isDeleted = row[5] === 'TRUE' || row[5] === true || row[5] === 'true';
    const updatedAt = row[4] ? String(row[4]) : LEGACY_FALLBACK_UPDATED_AT;
    budgets.push({
      id,
      categoryId: String(row[1]),
      monthlyLimit: parseFloat(row[2]) || 0,
      alertThresholdPercentage: parseFloat(row[3]) || 80,
      updatedAt,
      isDeleted,
      rev: parseRev(row[6]),
      syncStatus: 'synced',
    });
  });

  const recurring: RecurringTransaction[] = [];
  recurringValueRange.forEach((row: any[], idx: number) => {
    if (!row || !row[0] || String(row[0]).trim() === '' || String(row[0]).toUpperCase() === 'ID') return;
    const actualRowNumber = idx + 2;
    const id = String(row[0]);
    recurringRowMap.set(id, actualRowNumber);

    const active =
      row[9] === 'TRUE' || row[9] === true || row[9] === 'true' || row[9] === undefined || row[9] === '';
    const freq = String(row[6] || 'monthly').toLowerCase();
    const validFreq = ['daily', 'weekly', 'monthly', 'yearly'].includes(freq) ? freq : 'monthly';
    const isDeleted = row[13] === 'TRUE' || row[13] === true || row[13] === 'true';
    const updatedAt = row[12] ? String(row[12]) : LEGACY_FALLBACK_UPDATED_AT;
    recurring.push({
      id,
      title: String(row[1] || 'Recurring Bill'),
      amount: parseFloat(row[2]) || 0,
      type: row[3] === 'income' ? 'income' : 'expense',
      categoryId: String(row[4] || 'cat_utilities'),
      paymentMethod: normalizePaymentMethod(row[5]),
      frequency: validFreq as any,
      nextDueDate: String(row[7] || new Date().toISOString().split('T')[0]),
      startDate: String(row[8] || new Date().toISOString().split('T')[0]),
      active,
      notes: row[10] ? String(row[10]) : undefined,
      rev: parseRev(row[11]),
      updatedAt,
      isDeleted,
      syncStatus: 'synced',
    });
  });

  return { transactions, budgets, recurring, txRowMap, budgetRowMap, recurringRowMap };
}

/**
 * Ensure all 6 required sheets exist in the spreadsheet (auto-upgrades older spreadsheets)
 */
async function ensureSheetsExist(accessToken: string, spreadsheetId: string): Promise<Set<string>> {
  const existingTitles = new Set<string>();
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metaRes.ok) {
      if (metaRes.status === 401) throw new Error('TOKEN_EXPIRED');
      return existingTitles;
    }

    const meta = await metaRes.json();
    for (const s of meta.sheets || []) {
      if (s.properties?.title) existingTitles.add(s.properties.title);
    }

    const requiredSheets = ['Transactions', 'UPI Expenses', 'Cash Expenses', 'Budgets', 'Accounts', 'Recurring Bills'];
    const missingSheets = requiredSheets.filter((title) => !existingTitles.has(title));

    if (missingSheets.length > 0) {
      const addSheetRequests = missingSheets.map((title) => ({
        addSheet: { properties: { title } },
      }));

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: addSheetRequests }),
      });

      missingSheets.forEach((t) => existingTitles.add(t));

      const newHeadersData: { range: string; values: any[][] }[] = [];
      if (missingSheets.includes('Transactions')) newHeadersData.push({ range: 'Transactions!A1:L1', values: [TX_HEADERS] });
      if (missingSheets.includes('UPI Expenses')) newHeadersData.push({ range: "'UPI Expenses'!A1:G1", values: [WALLET_EXPENSE_HEADERS] });
      if (missingSheets.includes('Cash Expenses')) newHeadersData.push({ range: "'Cash Expenses'!A1:G1", values: [WALLET_EXPENSE_HEADERS] });
      if (missingSheets.includes('Budgets')) newHeadersData.push({ range: 'Budgets!A1:G1', values: [BUDGET_HEADERS] });
      if (missingSheets.includes('Accounts')) newHeadersData.push({ range: 'Accounts!A1:D1', values: [ACCOUNT_HEADERS] });
      if (missingSheets.includes('Recurring Bills')) newHeadersData.push({ range: "'Recurring Bills'!A1:N1", values: [RECURRING_HEADERS] });

      if (newHeadersData.length > 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: newHeadersData,
          }),
        });
      }
    }
  } catch (err: any) {
    if (err?.message === 'TOKEN_EXPIRED') throw err;
    console.warn('Could not verify/add missing sheets in Google Sheets:', err);
  }
  return existingTitles;
}

/**
 * Format a Transaction row for Google Sheets (A..L)
 */
function formatTransactionRow(t: Transaction, nowIso: string): any[] {
  return [
    t.id,
    t.date,
    t.title,
    t.type,
    t.categoryId,
    t.amount,
    normalizePaymentMethod(t.paymentMethod),
    t.notes || '',
    (t.tags || []).join(';'),
    t.updatedAt || t.createdAt || nowIso,
    t.isDeleted ? 'TRUE' : 'FALSE',
    parseRev(t.rev),
  ];
}

/**
 * Format a Budget row for Google Sheets (A..G)
 */
function formatBudgetRow(b: Budget, nowIso: string): any[] {
  return [
    b.id,
    b.categoryId,
    b.monthlyLimit,
    b.alertThresholdPercentage,
    b.updatedAt || nowIso,
    b.isDeleted ? 'TRUE' : 'FALSE',
    parseRev(b.rev),
  ];
}

/**
 * Format a Recurring Bill row for Google Sheets (A..N)
 */
function formatRecurringRow(r: RecurringTransaction, nowIso: string): any[] {
  return [
    r.id,
    r.title,
    r.amount,
    r.type,
    r.categoryId,
    normalizePaymentMethod(r.paymentMethod),
    r.frequency,
    r.nextDueDate,
    r.startDate || '',
    r.active ? 'TRUE' : 'FALSE',
    r.notes || '',
    parseRev(r.rev),
    r.updatedAt || nowIso,
    r.isDeleted ? 'TRUE' : 'FALSE',
  ];
}

/**
 * Push reconciled state using Live-Index Incremental Updates:
 * - If 30-day tombstone purge occurred OR remote is freshly initialized: values:batchClear + full rewrite.
 * - Otherwise:
 *     - If nothing changed remotely (!remoteChanged): skip write calls completely.
 *     - Update modified rows at their live actualSheetRowNumber via values:batchUpdate.
 *     - Append brand-new rows via values:append.
 *     - Refresh dynamic =SUMIFS formulas in UPI and Cash Expense tabs.
 */
export async function pushIncrementalDataToSheet(
  accessToken: string,
  spreadsheetId: string,
  reconciledTx: Transaction[],
  reconciledBudgets: Budget[],
  reconciledRecurring: RecurringTransaction[],
  remoteData: SheetDataWithLiveIndices,
  tombstonePurged: boolean,
  upiBalance: number,
  cashBalance: number,
  currencySymbol: string = '₹'
): Promise<void> {
  const isInitialSetup = remoteData.transactions.length === 0 && remoteData.budgets.length === 0;

  // If tombstone pruning occurred or this is a brand-new sheet setup: execute full clean rewrite
  if (tombstonePurged || isInitialSetup) {
    console.log('[TrackWise Sync] Executing full clear + rewrite (tombstone purge or initial setup)');
    await pushDataToSheet(
      accessToken,
      spreadsheetId,
      reconciledTx,
      reconciledBudgets,
      reconciledRecurring,
      upiBalance,
      cashBalance,
      currencySymbol
    );
    return;
  }

  // ── Incremental Mode ───────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const existingSheets = await ensureSheetsExist(accessToken, spreadsheetId);

  // 1. Transactions Diff
  const remoteTxMap = new Map(remoteData.transactions.map((t) => [t.id, t]));
  const txBatchUpdates: { range: string; values: any[][] }[] = [];
  const txToAppend: any[][] = [];

  for (const t of reconciledTx) {
    const rowNum = remoteData.txRowMap.get(t.id);
    if (rowNum !== undefined) {
      const remoteItem = remoteTxMap.get(t.id);
      if (!remoteItem || canonicalTransactionKey(remoteItem) !== canonicalTransactionKey(t)) {
        txBatchUpdates.push({
          range: `Transactions!A${rowNum}:L${rowNum}`,
          values: [formatTransactionRow(t, nowIso)],
        });
      }
    } else {
      txToAppend.push(formatTransactionRow(t, nowIso));
    }
  }

  // 2. Budgets Diff
  const remoteBudgetMap = new Map(remoteData.budgets.map((b) => [b.id, b]));
  const budgetBatchUpdates: { range: string; values: any[][] }[] = [];
  const budgetsToAppend: any[][] = [];

  for (const b of reconciledBudgets) {
    const rowNum = remoteData.budgetRowMap.get(b.id);
    if (rowNum !== undefined) {
      const remoteItem = remoteBudgetMap.get(b.id);
      if (!remoteItem || canonicalBudgetKey(remoteItem) !== canonicalBudgetKey(b)) {
        budgetBatchUpdates.push({
          range: `Budgets!A${rowNum}:G${rowNum}`,
          values: [formatBudgetRow(b, nowIso)],
        });
      }
    } else {
      budgetsToAppend.push(formatBudgetRow(b, nowIso));
    }
  }

  // 3. Recurring Bills Diff
  const remoteRecMap = new Map(remoteData.recurring.map((r) => [r.id, r]));
  const recBatchUpdates: { range: string; values: any[][] }[] = [];
  const recurringToAppend: any[][] = [];

  for (const r of reconciledRecurring) {
    const rowNum = remoteData.recurringRowMap.get(r.id);
    if (rowNum !== undefined) {
      const remoteItem = remoteRecMap.get(r.id);
      if (!remoteItem || canonicalRecurringKey(remoteItem) !== canonicalRecurringKey(r)) {
        recBatchUpdates.push({
          range: `'Recurring Bills'!A${rowNum}:N${rowNum}`,
          values: [formatRecurringRow(r, nowIso)],
        });
      }
    } else {
      recurringToAppend.push(formatRecurringRow(r, nowIso));
    }
  }

  const hasRecordChanges =
    txBatchUpdates.length > 0 ||
    txToAppend.length > 0 ||
    budgetBatchUpdates.length > 0 ||
    budgetsToAppend.length > 0 ||
    recBatchUpdates.length > 0 ||
    recurringToAppend.length > 0;

  // If nothing changed remotely, skip all write calls completely
  if (!hasRecordChanges) {
    console.log('[TrackWise Sync] Remote data is already identical. Skipping all write calls.');
    return;
  }

  console.log(
    `[TrackWise Sync] Incremental push: ${txBatchUpdates.length} tx updates, ${txToAppend.length} tx appends, ` +
      `${budgetBatchUpdates.length} budget updates, ${budgetsToAppend.length} budget appends, ` +
      `${recBatchUpdates.length} rec updates, ${recurringToAppend.length} rec appends`
  );

  // 4. Summary Tabs: Refresh UPI Expenses, Cash Expenses & Accounts with dynamic =SUMIFS
  const totalNetBalance = upiBalance + cashBalance;
  const accountRows = [
    ['UPI / Online Wallet', upiBalance, currencySymbol, nowIso],
    ['Liquid Cash Wallet', cashBalance, currencySymbol, nowIso],
    ['Total Net Balance', totalNetBalance, currencySymbol, nowIso],
  ];

  const upiExpenses = reconciledTx.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'UPI'
  );
  const upiRows: any[][] = upiExpenses.map((t) => [
    t.date,
    t.title,
    t.categoryId,
    t.amount,
    t.notes || '',
    (t.tags || []).join(';'),
    t.updatedAt || t.createdAt || nowIso,
  ]);
  upiRows.push([
    '',
    'TOTAL UPI EXPENSES',
    '',
    '=SUMIFS(Transactions!F2:F, Transactions!D2:D, "expense", Transactions!G2:G, "UPI", Transactions!K2:K, FALSE)',
    '',
    '',
    '',
  ]);

  const cashExpenses = reconciledTx.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'Cash'
  );
  const cashRows: any[][] = cashExpenses.map((t) => [
    t.date,
    t.title,
    t.categoryId,
    t.amount,
    t.notes || '',
    (t.tags || []).join(';'),
    t.updatedAt || t.createdAt || nowIso,
  ]);
  cashRows.push([
    '',
    'TOTAL CASH EXPENSES',
    '',
    '=SUMIFS(Transactions!F2:F, Transactions!D2:D, "expense", Transactions!G2:G, "Cash", Transactions!K2:K, FALSE)',
    '',
    '',
    '',
  ]);

  // Combine all batch updates
  const combinedBatchUpdates: { range: string; values: any[][] }[] = [
    ...txBatchUpdates,
    ...budgetBatchUpdates,
    ...recBatchUpdates,
  ];

  if (existingSheets.size === 0 || existingSheets.has('Accounts')) {
    combinedBatchUpdates.push({
      range: 'Accounts!A2:D4',
      values: accountRows,
    });
  }

  // Clear and rewrite UPI & Cash expense tabs if transactions changed
  if (txBatchUpdates.length > 0 || txToAppend.length > 0) {
    if (existingSheets.size === 0 || existingSheets.has('UPI Expenses')) {
      // Clear trailing UPI lines and rewrite
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'UPI Expenses'!A2:H:clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      }).catch(() => {});
      combinedBatchUpdates.push({
        range: "'UPI Expenses'!A2:G",
        values: upiRows,
      });
    }

    if (existingSheets.size === 0 || existingSheets.has('Cash Expenses')) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Cash Expenses'!A2:H:clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      }).catch(() => {});
      combinedBatchUpdates.push({
        range: "'Cash Expenses'!A2:G",
        values: cashRows,
      });
    }
  }

  // Execute batch updates for modified rows
  if (combinedBatchUpdates.length > 0) {
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: combinedBatchUpdates,
        }),
      }
    );

    if (!updateRes.ok) {
      if (updateRes.status === 401) throw new Error('TOKEN_EXPIRED');
      const errText = await updateRes.text();
      console.error('Incremental batchUpdate error:', updateRes.status, errText);
      throw new Error(`Incremental batchUpdate failed: ${updateRes.statusText}`);
    }
  }

  // Execute appends for brand-new rows
  if (txToAppend.length > 0) {
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:L:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: txToAppend }),
      }
    );
    if (!appendRes.ok && appendRes.status === 401) throw new Error('TOKEN_EXPIRED');
  }

  if (budgetsToAppend.length > 0) {
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Budgets!A:G:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: budgetsToAppend }),
      }
    );
    if (!appendRes.ok && appendRes.status === 401) throw new Error('TOKEN_EXPIRED');
  }

  if (recurringToAppend.length > 0) {
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Recurring Bills'!A:N:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: recurringToAppend }),
      }
    );
    if (!appendRes.ok && appendRes.status === 401) throw new Error('TOKEN_EXPIRED');
  }
}

/**
 * Full clean rewrite of all 6 Google Sheets tabs (used for initial sheet setup or 30-day tombstone pruning)
 */
export async function pushDataToSheet(
  accessToken: string,
  spreadsheetId: string,
  transactions: Transaction[],
  budgets: Budget[],
  recurring: RecurringTransaction[],
  upiBalance: number,
  cashBalance: number,
  currencySymbol: string = '₹'
): Promise<void> {
  const existingSheets = await ensureSheetsExist(accessToken, spreadsheetId);

  // Clear data ranges to eliminate ghost rows
  const rangesToClear: string[] = [];
  if (existingSheets.size === 0 || existingSheets.has('Transactions')) rangesToClear.push('Transactions!A2:L');
  if (existingSheets.size === 0 || existingSheets.has('UPI Expenses')) rangesToClear.push("'UPI Expenses'!A2:H");
  if (existingSheets.size === 0 || existingSheets.has('Cash Expenses')) rangesToClear.push("'Cash Expenses'!A2:H");
  if (existingSheets.size === 0 || existingSheets.has('Budgets')) rangesToClear.push('Budgets!A2:I');
  if (existingSheets.size === 0 || existingSheets.has('Accounts')) rangesToClear.push('Accounts!A2:D');
  if (existingSheets.size === 0 || existingSheets.has('Recurring Bills')) rangesToClear.push("'Recurring Bills'!A2:N");

  if (rangesToClear.length > 0) {
    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ranges: rangesToClear }),
      }
    );

    if (!clearRes.ok) {
      if (clearRes.status === 401) throw new Error('TOKEN_EXPIRED');
      const errText = await clearRes.text();
      console.error('Google Sheets batchClear error:', clearRes.status, errText);
      throw new Error(`Clear sheet data failed: ${clearRes.statusText}`);
    }
  }

  const nowIso = new Date().toISOString();

  // 1. Transactions (A1:L)
  const txRows = transactions.map((t) => formatTransactionRow(t, nowIso));

  // 2. UPI Expenses with dynamic =SUMIFS against Transactions
  const upiExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'UPI'
  );
  const upiRows: any[][] = upiExpenses.map((t) => [
    t.date,
    t.title,
    t.categoryId,
    t.amount,
    t.notes || '',
    (t.tags || []).join(';'),
    t.updatedAt || t.createdAt || nowIso,
  ]);
  upiRows.push([
    '',
    'TOTAL UPI EXPENSES',
    '',
    '=SUMIFS(Transactions!F2:F, Transactions!D2:D, "expense", Transactions!G2:G, "UPI", Transactions!K2:K, FALSE)',
    '',
    '',
    '',
  ]);

  // 3. Cash Expenses with dynamic =SUMIFS against Transactions
  const cashExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'Cash'
  );
  const cashRows: any[][] = cashExpenses.map((t) => [
    t.date,
    t.title,
    t.categoryId,
    t.amount,
    t.notes || '',
    (t.tags || []).join(';'),
    t.updatedAt || t.createdAt || nowIso,
  ]);
  cashRows.push([
    '',
    'TOTAL CASH EXPENSES',
    '',
    '=SUMIFS(Transactions!F2:F, Transactions!D2:D, "expense", Transactions!G2:G, "Cash", Transactions!K2:K, FALSE)',
    '',
    '',
    '',
  ]);

  // 4. Budgets (A1:G)
  const budgetRows = budgets.map((b) => formatBudgetRow(b, nowIso));

  // 5. Accounts (A1:D)
  const totalNetBalance = upiBalance + cashBalance;
  const accountRows = [
    ['UPI / Online Wallet', upiBalance, currencySymbol, nowIso],
    ['Liquid Cash Wallet', cashBalance, currencySymbol, nowIso],
    ['Total Net Balance', totalNetBalance, currencySymbol, nowIso],
  ];

  // 6. Recurring Bills (A1:N)
  const recurringRows = (recurring || []).map((r) => formatRecurringRow(r, nowIso));

  const updateData: { range: string; values: any[][] }[] = [];

  if (existingSheets.size === 0 || existingSheets.has('Transactions')) {
    updateData.push({ range: 'Transactions!A1:L', values: [TX_HEADERS, ...txRows] });
  }
  if (existingSheets.size === 0 || existingSheets.has('UPI Expenses')) {
    updateData.push({ range: "'UPI Expenses'!A1:H1", values: [[...WALLET_EXPENSE_HEADERS, '']] });
    updateData.push({ range: "'UPI Expenses'!A2:G", values: upiRows });
  }
  if (existingSheets.size === 0 || existingSheets.has('Cash Expenses')) {
    updateData.push({ range: "'Cash Expenses'!A1:H1", values: [[...WALLET_EXPENSE_HEADERS, '']] });
    updateData.push({ range: "'Cash Expenses'!A2:G", values: cashRows });
  }
  if (existingSheets.size === 0 || existingSheets.has('Budgets')) {
    updateData.push({ range: 'Budgets!A1:G', values: [BUDGET_HEADERS, ...budgetRows] });
  }
  if (existingSheets.size === 0 || existingSheets.has('Accounts')) {
    updateData.push({ range: 'Accounts!A1:D', values: [ACCOUNT_HEADERS, ...accountRows] });
  }
  if (existingSheets.size === 0 || existingSheets.has('Recurring Bills')) {
    updateData.push({ range: "'Recurring Bills'!A1:N", values: [RECURRING_HEADERS, ...recurringRows] });
  }

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updateData,
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    const errText = await res.text();
    console.error('Google Sheets sync error response:', res.status, errText);
    throw new Error(`Sync to sheet failed: ${res.statusText}`);
  }
}
