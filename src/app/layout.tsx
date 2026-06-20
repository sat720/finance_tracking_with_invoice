import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vriddhi Capital - Startup Financial Tracking & GST Invoicing App',
  description: 'The ultimate financial copilot for Indian startups and SMEs. Track profit, loss, cash flow, receivables, payables, and generate GST-compliant invoices with automated email and WhatsApp reminders.',
  keywords: 'fintech, GST invoicing, startup finance tracker, cash flow management, automated reminders, Indian tax compliance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
