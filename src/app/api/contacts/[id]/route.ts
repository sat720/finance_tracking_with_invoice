import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();
    const { name, email, phone, billingAddress, gstin, state } = body;

    if (!name || !email || !billingAddress || !gstin || !state) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (gstin.trim().length !== 15) {
      return NextResponse.json({ error: 'GSTIN must be exactly 15 characters' }, { status: 400 });
    }

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: {
        name,
        email,
        phone: phone || '',
        billingAddress,
        gstin: gstin.toUpperCase().trim(),
        state: state.trim(),
      },
    });

    return NextResponse.json({ success: true, contact: updatedContact });
  } catch (error) {
    console.error('Failed to update contact:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'FOUNDER') {
      return NextResponse.json({ error: 'Unauthorized: Only Founders can delete master records' }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    await prisma.contact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Failed to delete contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
