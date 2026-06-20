import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        contact: true,
        invoice: true,
      },
      orderBy: { date: 'asc' },
    });

    // Tally-style columns: Date, Voucher Type, Particulars, Voucher No., Debit (Expense), Credit (Income), Narration
    let csvContent = 'Date,Voucher Type,Particulars,Voucher No.,Debit (Expense),Credit (Income),Narration\n';

    transactions.forEach((tx) => {
      const dateStr = new Date(tx.date).toLocaleDateString('en-IN');
      const voucherType = tx.type === 'INCOME' ? 'Receipt' : 'Payment';
      
      const particulars = tx.contact?.name 
        ? `"${tx.contact.name.replace(/"/g, '""')}"` 
        : `"${tx.category.replace(/"/g, '""')}"`;
        
      const voucherNo = tx.invoice?.invoiceNumber || '';
      const debit = tx.type === 'EXPENSE' ? tx.amount.toFixed(2) : '0.00';
      const credit = tx.type === 'INCOME' ? tx.amount.toFixed(2) : '0.00';
      const narration = `"${tx.description.replace(/"/g, '""')}"`;

      csvContent += `${dateStr},${voucherType},${particulars},${voucherNo},${debit},${credit},${narration}\n`;
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=vriddhi_accounting_ledger.csv',
      },
    });
  } catch (error) {
    console.error('Failed to export financials:', error);
    return NextResponse.json({ error: 'Failed to export financials' }, { status: 500 });
  }
}
