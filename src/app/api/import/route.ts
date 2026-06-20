import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const body = await request.json();
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided for import' }, { status: 400 });
    }

    // Insert all transactions in a single DB transaction
    const importedTransactions = await prisma.$transaction(
      transactions.map((tx: any) =>
        prisma.transaction.create({
          data: {
            type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
            category: tx.category,
            amount: parseFloat(tx.amount) || 0,
            date: new Date(tx.date),
            description: tx.description || 'Imported bank transaction',
            contactId: tx.contactId || null,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: importedTransactions.length,
    });
  } catch (error) {
    console.error('Failed to import transactions:', error);
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 });
  }
}
