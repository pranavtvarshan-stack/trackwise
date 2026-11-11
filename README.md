# TrackWise — Personal Expense & Wealth Tracker

A responsive, client-side personal finance and expense tracking web application built with **React**, **TypeScript**, **Tailwind CSS**, and **Recharts**.

---

## ✨ Key Features

1. **Interactive Dashboard & Cashflow Trends**:
   - Total Net Savings, Income, Expenses, and overall Savings Rate (%)
   - Visual monthly cashflow comparisons (Income vs Expenses)
   - Interactive category spending donut chart with percentage breakdown
   - Quick glance at recent transactions and active budget health

2. **Detailed Transaction Management**:
   - Full record history with date-based grouping
   - Flexible filters: Date range (This Month, Last Month, Last 30 Days, This Year, All), Transaction Type (Income/Expense), Category, and Payment Method
   - Search by title, notes, or tags
   - Sort by date or amount
   - Receipt attachment preview & tags support
   - Instant Add, Edit, and Delete actions

3. **Category Budgeting & Limit Alerts**:
   - Monthly budget ceilings per expense category
   - Visual progress bars with threshold alerts (Healthy < 75%, Warning 75-99%, Exceeded 100%+)
   - Remaining safe-to-spend calculations

4. **Recurring Subscriptions & Bills**:
   - Track monthly bills (Rent, Netflix, Spotify, Gym, Utilities, etc.)
   - Dynamic countdown ("Due in 3 days", "Due today!", "Overdue")
   - One-click **"Process Due Bills"** button to automatically log due bills into the transactions ledger

5. **Financial Analytics & Deep Reports**:
   - Payment method distribution (Credit Card, Debit, UPI/Fast Pay, Cash, Bank Transfer, PayPal)
   - Day of week spending heat patterns (Weekend vs Weekday analysis)
   - Complete Category Analytics Matrix with order counts and average transaction sizes

6. **Customization & Local Persistence**:
   - Support for 9+ international currencies ($, €, £, ₹, ¥, CA$, A$, etc.)
   - Add custom categories with custom icons and color palettes
   - 100% private, client-side persistent storage in browser `localStorage`
   - Complete Data Export (CSV & JSON) and JSON Backup Restore
   - Demo Sample Data reloader and clean data wipe option

---

## 🚀 Running the App Locally

Start the Vite development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

To create a production build:

```bash
npm run build
npm run preview
```

