import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const contentType = request.headers.get('content-type') || '';
    let type: string;
    let category: string;
    let amount: number;
    let dateStr: string;
    let description: string;
    let contactId: string | null = null;
    let invoiceId: string | null = null;
    let receiptUrl: string | null | undefined = undefined;

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

    const updateData: any = {
      type,
      category,
      amount,
      date: new Date(dateStr),
      description,
      contactId,
      invoiceId,
    };

    if (receiptUrl !== undefined) {
      updateData.receiptUrl = receiptUrl;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTx = await tx.transaction.update({
        where: { id },
        data: updateData,
      });

      if (invoiceId) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PAID'
          }
        });
      }

      return updatedTx;
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'FOUNDER') {
      return NextResponse.json({ error: 'Unauthorized: Only Founders can delete transactions' }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
