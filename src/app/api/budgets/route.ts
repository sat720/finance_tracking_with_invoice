import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const budgets = await prisma.budget.findMany();
    return NextResponse.json({ budgets });
  } catch (error) {
    console.error('Failed to fetch budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const body = await request.json();
    const { category, amount, periodStart, periodEnd } = body;

    if (!category || isNaN(parseFloat(amount)) || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const budgetAmount = parseFloat(amount);

    const budget = await prisma.budget.upsert({
      where: { category },
      update: {
        amount: budgetAmount,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
      create: {
        category,
        amount: budgetAmount,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
    });

    return NextResponse.json({ success: true, budget });
  } catch (error) {
    console.error('Failed to save budget:', error);
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}
