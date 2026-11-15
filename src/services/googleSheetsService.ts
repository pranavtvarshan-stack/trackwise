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

  // Step 2: Create new spreadsheet with Transactions, UPI Expenses, Cash Expenses, Budgets, and Accounts tabs
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

  // Step 3: Populate header rows for all 5 sheets
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
        range: "'UPI Expenses'!A1:H1",
        values: [
          [
            'ID',
            'Date',
            'Title',
            'Category ID',
            'Amount',
            'Notes',
            'Tags',
            'Updated At',
          ],
        ],
      },
      {
        range: "'Cash Expenses'!A1:H1",
        values: [
          [
            'ID',
            'Date',
            'Title',
            'Category ID',
            'Amount',
            'Notes',
            'Tags',
            'Updated At',
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
 * Ensure all 5 required sheets exist in the spreadsheet (auto-upgrades older 3-sheet spreadsheets)
 */
async function ensureSheetsExist(accessToken: string, spreadsheetId: string): Promise<Set<string>> {
  const existingTitles = new Set<string>();
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!metaRes.ok) {
      console.warn('Failed to fetch spreadsheet metadata:', metaRes.status, metaRes.statusText);
      return existingTitles;
    }

    const metaData = await metaRes.json();
    (metaData.sheets || []).forEach((s: any) => {
      if (s.properties?.title) existingTitles.add(s.properties.title);
    });

    const requiredSheets = ['Transactions', 'UPI Expenses', 'Cash Expenses', 'Budgets', 'Accounts'];
    const missingSheets = requiredSheets.filter((title) => !existingTitles.has(title));

    if (missingSheets.length > 0) {
      const requests = missingSheets.map((title) => ({
        addSheet: {
          properties: {
            title,
          },
        },
      }));

      const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (batchRes.ok) {
        missingSheets.forEach((t) => existingTitles.add(t));
      } else {
        console.warn('Batch addSheet failed:', batchRes.status, await batchRes.text());
      }

      // Populate headers for any newly added sheets
      const newHeadersData: { range: string; values: any[][] }[] = [];
      if (missingSheets.includes('UPI Expenses') && existingTitles.has('UPI Expenses')) {
        newHeadersData.push({
          range: "'UPI Expenses'!A1:H1",
          values: [['ID', 'Date', 'Title', 'Category ID', 'Amount', 'Notes', 'Tags', 'Updated At']],
        });
      }
      if (missingSheets.includes('Cash Expenses') && existingTitles.has('Cash Expenses')) {
        newHeadersData.push({
          range: "'Cash Expenses'!A1:H1",
          values: [['ID', 'Date', 'Title', 'Category ID', 'Amount', 'Notes', 'Tags', 'Updated At']],
        });
      }
      if (missingSheets.includes('Transactions') && existingTitles.has('Transactions')) {
        newHeadersData.push({
          range: 'Transactions!A1:K1',
          values: [
            ['ID', 'Date', 'Title', 'Type', 'Category ID', 'Amount', 'Payment Method', 'Notes', 'Tags', 'Updated At', 'Is Deleted'],
          ],
        });
      }
      if (missingSheets.includes('Budgets') && existingTitles.has('Budgets')) {
        newHeadersData.push({
          range: 'Budgets!A1:F1',
          values: [['ID', 'Category ID', 'Monthly Limit', 'Alert Threshold', 'Updated At', 'Is Deleted']],
        });
      }
      if (missingSheets.includes('Accounts') && existingTitles.has('Accounts')) {
        newHeadersData.push({
          range: 'Accounts!A1:D1',
          values: [['Wallet / Account', 'Live Balance', 'Currency', 'Last Synced (UTC)']],
        });
      }

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
  } catch (err) {
    console.warn('Could not verify/add missing sheets in Google Sheets:', err);
  }
  return existingTitles;
}

/**
 * Push full current state (including soft deletes, 5-sheet structure with UPI/Cash expense totals) to Google Sheet
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
  // Ensure all 5 sheets exist (Transactions, UPI Expenses, Cash Expenses, Budgets, Accounts)
  const existingSheets = await ensureSheetsExist(accessToken, spreadsheetId);

  // Clear existing data rows below headers only for existing sheets
  const rangesToClear: string[] = [];
  if (existingSheets.size === 0 || existingSheets.has('Transactions')) rangesToClear.push('Transactions!A2:K');
  if (existingSheets.size === 0 || existingSheets.has('UPI Expenses')) rangesToClear.push("'UPI Expenses'!A2:H");
  if (existingSheets.size === 0 || existingSheets.has('Cash Expenses')) rangesToClear.push("'Cash Expenses'!A2:H");
  if (existingSheets.size === 0 || existingSheets.has('Budgets')) rangesToClear.push('Budgets!A2:F');
  if (existingSheets.size === 0 || existingSheets.has('Accounts')) rangesToClear.push('Accounts!A2:D');

  if (rangesToClear.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: rangesToClear,
      }),
    });
  }

  // 1. Prepare Transactions rows (all transactions ledger)
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

  // 2. Prepare UPI Expenses rows & Total
  const upiExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'UPI'
  );
  let totalUpiExpenses = 0;
  const upiRows: any[][] = upiExpenses.map((t) => {
    totalUpiExpenses += t.amount;
    return [
      t.id,
      t.date,
      t.title,
      t.categoryId,
      t.amount,
      t.notes || '',
      (t.tags || []).join(';'),
      t.updatedAt || t.createdAt || new Date().toISOString(),
    ];
  });
  // Add Total UPI Expenses summary row at the bottom
  upiRows.push(['', '', 'TOTAL UPI EXPENSES', '', totalUpiExpenses, '', '', '']);

  // 3. Prepare Cash Expenses rows & Total
  const cashExpenses = transactions.filter(
    (t) => !t.isDeleted && t.type === 'expense' && normalizePaymentMethod(t.paymentMethod) === 'Cash'
  );
  let totalCashExpenses = 0;
  const cashRows: any[][] = cashExpenses.map((t) => {
    totalCashExpenses += t.amount;
    return [
      t.id,
      t.date,
      t.title,
      t.categoryId,
      t.amount,
      t.notes || '',
      (t.tags || []).join(';'),
      t.updatedAt || t.createdAt || new Date().toISOString(),
    ];
  });
  // Add Total Cash Expenses summary row at the bottom
  cashRows.push(['', '', 'TOTAL CASH EXPENSES', '', totalCashExpenses, '', '', '']);

  // 4. Prepare Budgets rows
  const budgetRows = budgets.map((b) => [
    b.id,
    b.categoryId,
    b.monthlyLimit,
    b.alertThresholdPercentage,
    b.updatedAt || new Date().toISOString(),
    b.isDeleted ? 'TRUE' : 'FALSE',
  ]);

  // 5. Prepare Accounts rows (Wallet balances and total net balance)
  const nowIso = new Date().toISOString();
  const totalNetBalance = upiBalance + cashBalance;
  const accountRows = [
    ['UPI / Online Wallet', upiBalance, currencySymbol, nowIso],
    ['Liquid Cash Wallet', cashBalance, currencySymbol, nowIso],
    ['Total Net Balance', totalNetBalance, currencySymbol, nowIso],
  ];

  const updateData: { range: string; values: any[][] }[] = [];
  if (existingSheets.size === 0 || existingSheets.has('Transactions')) {
    updateData.push({ range: 'Transactions!A2:K', values: txRows });
  }
  if (existingSheets.size === 0 || existingSheets.has('UPI Expenses')) {
    updateData.push({ range: "'UPI Expenses'!A2:H", values: upiRows });
  }
  if (existingSheets.size === 0 || existingSheets.has('Cash Expenses')) {
    updateData.push({ range: "'Cash Expenses'!A2:H", values: cashRows });
  }
  if (existingSheets.size === 0 || existingSheets.has('Budgets')) {
    updateData.push({ range: 'Budgets!A2:F', values: budgetRows });
  }
  if (existingSheets.size === 0 || existingSheets.has('Accounts')) {
    updateData.push({ range: 'Accounts!A2:D', values: accountRows });
  }

  const updatePayload = {
    valueInputOption: 'USER_ENTERED',
    data: updateData,
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
    const errText = await res.text();
    console.error('Google Sheets sync error response:', res.status, errText);
    throw new Error(`Sync to sheet failed: ${res.statusText}`);
  }
}

