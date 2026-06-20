import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        client: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already settled' }, { status: 400 });
    }

    const totalAmountSum = invoice.items.reduce((sum, item) => sum + item.totalAmount, 0);

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Update invoice status to PAID
      const inv = await tx.invoice.update({
        where: { id },
        data: {
          status: 'PAID',
        },
      });

      const rateCoeff = invoice.exchangeRate || 1.0;
      const baseInrAmount = totalAmountSum * rateCoeff;

      // 2. Create corresponding ledger transaction record
      // If it is a CLIENT invoice, it represents INCOME for the company.
      // If it is a VENDOR invoice, it represents EXPENSE.
      const isClient = invoice.client.type === 'CLIENT';
      await tx.transaction.create({
        data: {
          type: isClient ? 'INCOME' : 'EXPENSE',
          category: isClient ? 'PRODUCT_SALES' : 'VENDOR_PAYMENTS',
          amount: baseInrAmount,
          date: new Date(),
          description: `Payment for Invoice ${invoice.invoiceNumber} (${invoice.currency})`,
          contactId: invoice.clientId,
          invoiceId: invoice.id,
        },
      });

      return inv;
    });

    return NextResponse.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error('Failed to process portal invoice payment:', error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}
