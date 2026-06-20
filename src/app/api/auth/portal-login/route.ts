import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { search } = await request.json();

    if (!search || !search.trim()) {
      return NextResponse.json({ error: 'Please enter your registered Email or GSTIN.' }, { status: 400 });
    }

    const cleanSearch = search.trim();

    // Query for contact by email or GSTIN (case-insensitive lookup)
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { email: { equals: cleanSearch } },
          { email: { equals: cleanSearch.toLowerCase() } },
          { email: { equals: cleanSearch.toUpperCase() } },
          { gstin: { equals: cleanSearch } },
          { gstin: { equals: cleanSearch.toUpperCase() } },
          { gstin: { equals: cleanSearch.toLowerCase() } }
        ]
      }
    });

    if (!contact) {
      return NextResponse.json({
        error: 'No registered client or vendor found matching this Email or GSTIN. Please onboarding first.'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, contactId: contact.id });
  } catch (error) {
    console.error('Portal login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
