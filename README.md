# 📊 Vriddhi Capital — Startup Finance & GST Compliance Copilot

Vriddhi Capital is a state-of-the-art web application designed for Indian startups and SMEs to track finances, manage cash flows, monitor budgets, and issue GST-compliant tax invoices. The system features a responsive, premium glassmorphism dark-mode theme, unified ledger logs, interactive charts, client/vendor portals, and real-time notification dispatches.

---

## ✨ Features Checklist & Capabilites

### 1. 📊 Financial Copilot & KPIs
- **Real-Time KPIs**: Track Net Profit, Total Revenue, Total Expenses, Cash Position, Receivables, and Payables dynamically within selected period ranges.
- **Interactive SVG Charts**: Dynamic Monthly Income vs Expense charts and MoM Expense Category Breakdown donut charts.
- **GST Compliance Estimator**: Computes CGST, SGST, IGST collected and paid to display net GST payables and projected corporate income taxes.

### 2. 📝 Invoices & Billing Engine
- **Client vs Vendor Segregation**: Integrated tabs to separate *Customer Invoices (Receivable)* from *Vendor Bills (Payable)*.
- **Client Invoicing Form**: Generate detailed invoices with multiple line items, custom HSN/SAC codes, dynamic state-based GST rates (intra-state CGST+SGST vs. inter-state IGST), and automated PDF downloads.
- **Vendor Settlements**: Settle vendor bills directly from the dashboard. Doing so changes the invoice status to `PAID` and automatically records a corresponding `EXPENSE` outflow transaction.
- **Client Portal**: Publicly accessible, tokenless client dashboards allowing customers to view profiles, print/save invoices as PDF, and click *Simulate Payment* to log real-time `INCOME` inflows.

### 3. 💼 Ledger & Budget Tracker
- **Unified Transactions Ledger**: Filter transactions by type (income/expense), category tags, or date. Displays direct manual entries as well as automated invoice-linked transactions.
- **Import Bank Statements**: Import transactions using a CSV file (supported headers: Date, Type, Category, Amount, Description).
- **Category-Based Budgets**: Configure, review, and adjust monthly budget targets (Salaries, Rent, Marketing, Utilities, Vendor Payments) with visual progress gauges.

### 4. 🔗 Multi-Role User Authentication
The system comes preloaded with three distinct user roles (accessible via quick-login buttons on the `/login` screen):
- **Founder**: Full access including override controls (editing amounts, deleting entries) and system communication logs.
- **Accountant**: Full edit access (record transactions, create invoices, import CSVs). Restrcted from deleting ledger records and viewing system logs.
- **Viewer**: Read-only access to review dashboards, invoices, reports, and directories. Restrictive action buttons are disabled with warning tooltips.

---

## 🛠️ Technology Stack
- **Framework**: [Next.js](https://nextjs.org/) (React 19, Turbopack)
- **Database ORM**: [Prisma](https://www.prisma.io/) with Local [SQLite](https://www.sqlite.org/) (`prisma/dev.db`)
- **Styling**: Vanilla CSS (custom glassmorphism dark-theme `#09070f`)
- **Email Transporter**: [Nodemailer](https://nodemailer.com/) (real SMTP delivery support)
- **WhatsApp API**: Twilio SDK integration

---

## 🚀 How to Run Locally

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18 or higher) and `npm` installed.

### 2. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/sat720/finance_tracking_with_invoice.git
cd m3
npm install
```

### 3. Database Initialization & Seeding
Set up SQLite and seed the database with **10 customer invoices** and **10 vendor invoices** along with all budgets, admin users, and matching ledger history:
```bash
npx prisma db push
npx prisma db seed
```

### 4. Configure Environmental Variables
Copy or create a `.env` file in the root directory:
```env
# Database Connection (SQLite)
DATABASE_URL="file:./dev.db"

# Security Salts (for password hashing and session tokens)
AUTH_SALT="vriddhi_salt_2026_production_secure_value"
JWT_SECRET="vriddhi_jwt_secret_key_2026_production_secure_value"

# Email Configuration (SMTP) - To send real emails via Gmail
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-digit-gmail-app-password"
```

### 5. Running the Application
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📧 Real Email Delivery Setup (Gmail App Password)
To send real invoice delivery emails to clients:
1. Turn on **2-Step Verification** on your Google Account.
2. Go to Google Account Settings -> Search for **App passwords**.
3. Create a new App Password named `Vriddhi Capital`.
4. Copy the generated 16-character code and paste it into the `SMTP_PASS` field in `.env`.
5. Enter a real email during customer onboarding, inspect a generated invoice, and click **Deliver Invoice** or **Overdue Reminder**! You can audit SMTP delivery results under `/admin`.

---

## ☁️ Google Cloud Deployment (Cloud Run)

This application is containerized using Docker and deployed on **Google Cloud Run**.

To deploy to Cloud Run manually under your Google Cloud CLI session:
```bash
# Deploy to Google Cloud Run in the summersaas26 project
gcloud run deploy finance-tracking \
  --source . \
  --project=summersaas26 \
  --region=asia-southeast1 \
  --allow-unauthenticated
```
This builds your container automatically using **Google Cloud Build** and provisions a public URL.
