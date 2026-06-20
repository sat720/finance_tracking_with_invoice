import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const logs = await prisma.notificationLog.findMany({
      orderBy: { timestamp: 'desc' },
    });
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Failed to fetch notification logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
