import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        invoices: {
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        transactions: {
          include: {
            invoice: true,
          },
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Failed to fetch portal contact:', error);
    return NextResponse.json({ error: 'Failed to fetch portal details' }, { status: 500 });
  }
}
