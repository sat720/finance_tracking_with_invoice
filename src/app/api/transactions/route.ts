import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // "INCOME" or "EXPENSE"
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (type === 'INCOME' || type === 'EXPENSE') {
      where.type = type;
    }
    if (category) {
      where.category = category;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        contact: true,
        invoice: true,
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    
    let type: string;
    let category: string;
    let amount: number;
    let dateStr: string;
    let description: string;
    let contactId: string | null = null;
    let invoiceId: string | null = null;
    let receiptUrl: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      type = formData.get('type') as string;
      category = formData.get('category') as string;
      amount = parseFloat(formData.get('amount') as string);
      dateStr = formData.get('date') as string;
      description = formData.get('description') as string;
      contactId = (formData.get('contactId') as string) || null;
      invoiceId = (formData.get('invoiceId') as string) || null;

      const file = formData.get('receipt') as File | null;
      if (file && file.size > 0) {
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const path = join(uploadDir, fileName);
        await writeFile(path, buffer);
        receiptUrl = `/uploads/${fileName}`;
      }
    } else {
      const body = await request.json();
      type = body.type;
      category = body.category;
      amount = parseFloat(body.amount);
      dateStr = body.date;
      description = body.description;
      contactId = body.contactId || null;
      invoiceId = body.invoiceId || null;
      receiptUrl = body.receiptUrl || null;
    }

    if (!type || !category || isNaN(amount) || !dateStr || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const createdTx = await tx.transaction.create({
        data: {
          type,
          category,
          amount,
          date: new Date(dateStr),
          description,
          contactId,
          invoiceId,
          receiptUrl,
        },
      });

      if (invoiceId) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PAID'
          }
        });
      }

      return createdTx;
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
