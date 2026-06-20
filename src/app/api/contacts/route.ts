import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // "CLIENT" or "VENDOR"

    const where: any = {};
    if (type === 'CLIENT' || type === 'VENDOR') {
      where.type = type;
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const body = await request.json();
    const { type, name, email, phone, billingAddress, gstin, state } = body;

    if (!type || !email) {
      return NextResponse.json({ error: 'Missing required fields (type, email)' }, { status: 400 });
    }

    if (type !== 'CLIENT' && type !== 'VENDOR') {
      return NextResponse.json({ error: 'Invalid contact type' }, { status: 400 });
    }

    // GSTIN simple validation
    const cleanGstin = (gstin || '').trim().toUpperCase();
    if (type === 'VENDOR') {
      if (!cleanGstin || cleanGstin.length !== 15) {
        return NextResponse.json({ error: 'GSTIN is required for vendors and must be exactly 15 characters' }, { status: 400 });
      }
    } else {
      if (cleanGstin && cleanGstin.length !== 15) {
        return NextResponse.json({ error: 'GSTIN must be exactly 15 characters' }, { status: 400 });
      }
    }

    // Default Name if empty
    const finalName = (name || '').trim() || (type === 'CLIENT' ? email.split('@')[0] : `Vendor - ${cleanGstin}`);

    const contact = await prisma.contact.create({
      data: {
        type,
        name: finalName,
        email: email.trim(),
        phone: phone || '',
        billingAddress: (billingAddress || '').trim() || 'Not Provided',
        gstin: cleanGstin,
        state: (state || '').trim() || 'Delhi',
      },
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error('Failed to create contact:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
