import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const incomeCategories: Record<string, number> = {};
    const expenseCategories: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'INCOME') {
        incomeCategories[tx.category] = (incomeCategories[tx.category] || 0) + tx.amount;
        totalIncome += tx.amount;
      } else if (tx.type === 'EXPENSE') {
        expenseCategories[tx.category] = (expenseCategories[tx.category] || 0) + tx.amount;
        totalExpense += tx.amount;
      }
    });

    const netProfit = totalIncome - totalExpense;

    return NextResponse.json({
      summary: {
        totalIncome,
        totalExpense,
        netProfit,
      },
      incomeCategories,
      expenseCategories,
      transactions,
    });
  } catch (error) {
    console.error('Failed to generate P&L report:', error);
    return NextResponse.json({ error: 'Failed to generate P&L report' }, { status: 500 });
  }
}
