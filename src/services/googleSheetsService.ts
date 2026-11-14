import { Transaction, Budget, GoogleUser } from '../types';
import { normalizePaymentMethod } from '../utils/formatters';

const SHEET_TITLE = 'TrackWise Pro - Personal Finance';
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

declare global {
  interface Window {
    google?: any;
  }
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
  // Step 1: Query Google Drive API for existing spreadsheet
  const query = encodeURIComponent(`name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
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

  // Step 2: Create new spreadsheet with Transactions, Budgets, and Accounts tabs
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
        { properties: { title: 'Budgets' } },
        { properties: { title: 'Accounts' } },
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

  // Step 3: Populate header rows
  const headersPayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: 'Transactions!A1:K1',
        values: [
          [
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
          ],
        ],
      },
      {
        range: 'Budgets!A1:F1',
        values: [
          [
            'ID',
            'Category ID',
            'Monthly Limit',
            'Alert Threshold',
            'Updated At',
            'Is Deleted',
          ],
        ],
      },
      {
        range: 'Accounts!A1:D1',
        values: [
          ['Wallet / Account', 'Live Balance', 'Currency', 'Last Synced (UTC)'],
        ],
      },
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
 * Pull all rows from Transactions and Budgets sheets
 */
export async function pullDataFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ transactions: Transaction[]; budgets: Budget[] }> {
  const rangeQuery = 'ranges=Transactions!A2:K&ranges=Budgets!A2:F';
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
    throw new Error(`Failed to fetch sheet data: ${res.statusText}`);
  }

  const data = await res.json();
  const txValueRange = data.valueRanges?.[0]?.values || [];
  const budgetValueRange = data.valueRanges?.[1]?.values || [];

  const transactions: Transaction[] = txValueRange
    .filter((row: any[]) => row && row[0])
    .map((row: any[]) => {
      const isDeleted = row[10] === 'TRUE' || row[10] === true || row[10] === 'true';
      return {
        id: String(row[0]),
        date: String(row[1] || new Date().toISOString().split('T')[0]),
        title: String(row[2] || 'Untitled'),
        type: row[3] === 'income' ? 'income' : 'expense',
        categoryId: String(row[4] || 'cat_food'),
        amount: parseFloat(row[5]) || 0,
        paymentMethod: normalizePaymentMethod(row[6]),
        notes: row[7] ? String(row[7]) : undefined,
        tags: row[8] ? String(row[8]).split(';').filter(Boolean) : [],
        createdAt: row[9] || new Date().toISOString(),
        updatedAt: row[9] || new Date().toISOString(),
        isDeleted,
        syncStatus: 'synced',
      };
    });

  const budgets: Budget[] = budgetValueRange
    .filter((row: any[]) => row && row[0])
    .map((row: any[]) => {
      const isDeleted = row[5] === 'TRUE' || row[5] === true || row[5] === 'true';
      return {
        id: String(row[0]),
        categoryId: String(row[1]),
        monthlyLimit: parseFloat(row[2]) || 0,
        alertThresholdPercentage: parseFloat(row[3]) || 80,
        updatedAt: row[4] || new Date().toISOString(),
        isDeleted,
        syncStatus: 'synced',
      };
    });

  return { transactions, budgets };
}

/**
 * Push full current state (including soft deletes and live account balances) to Google Sheet
 */
export async function pushDataToSheet(
  accessToken: string,
  spreadsheetId: string,
  transactions: Transaction[],
  budgets: Budget[],
  upiBalance: number,
  cashBalance: number,
  currencySymbol: string = '₹'
): Promise<void> {
  // Clear existing data rows below headers to avoid stale rows
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ranges: ['Transactions!A2:K', 'Budgets!A2:F', 'Accounts!A2:D'],
    }),
  });

  // Prepare Transactions rows
  const txRows = transactions.map((t) => [
    t.id,
    t.date,
    t.title,
    t.type,
    t.categoryId,
    t.amount,
    normalizePaymentMethod(t.paymentMethod),
    t.notes || '',
    (t.tags || []).join(';'),
    t.updatedAt || t.createdAt || new Date().toISOString(),
    t.isDeleted ? 'TRUE' : 'FALSE',
  ]);

  // Prepare Budgets rows
  const budgetRows = budgets.map((b) => [
    b.id,
    b.categoryId,
    b.monthlyLimit,
    b.alertThresholdPercentage,
    b.updatedAt || new Date().toISOString(),
    b.isDeleted ? 'TRUE' : 'FALSE',
  ]);

  // Prepare Accounts rows
  const nowIso = new Date().toISOString();
  const accountRows = [
    ['UPI / Online Wallet', upiBalance, currencySymbol, nowIso],
    ['Liquid Cash Wallet', cashBalance, currencySymbol, nowIso],
  ];

  const updatePayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: 'Transactions!A2:K',
        values: txRows,
      },
      {
        range: 'Budgets!A2:F',
        values: budgetRows,
      },
      {
        range: 'Accounts!A2:D',
        values: accountRows,
      },
    ],
  };

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Sync to sheet failed: ${res.statusText}`);
  }
}

